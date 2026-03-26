import {
  ChromeRuntimeMessage,
  ChromeRuntimeMessageType,
  TranslationFinishedPayload,
  TranslationRequestPayload,
} from "./types";
import { getTranslationSettings, getVideoTranslationCacheKey, testTranslationConnection, translateBatch } from "./translation";

type PendingCue = {
  tabId: number;
  videoId: string;
  subtitle: string;
};

const BATCH_SIZE = 20;
const BATCH_FLUSH_DELAY_MS = 800;
const MAX_CONCURRENT_REQUESTS = 5;

const pendingCues: PendingCue[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage, sender, sendResponse): boolean | void => {
  if (req.type === ChromeRuntimeMessageType.Translate && sender.tab?.id && req.payload) {
    queueSubtitleTranslation(sender.tab.id, req.payload as TranslationRequestPayload);
    return;
  }

  if (req.type === ChromeRuntimeMessageType.TestTranslationSettings) {
    void testTranslationConnection().then((result) => sendResponse(result));
    return true;
  }
});

const runLimited = async <T>(task: () => Promise<T>): Promise<T> => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => requestQueue.push(resolve));
  }

  activeRequests += 1;

  try {
    return await task();
  } finally {
    activeRequests -= 1;
    requestQueue.shift()?.();
  }
};

const queueSubtitleTranslation = (tabId: number, payload: TranslationRequestPayload): void => {
  pendingCues.push({ tabId, videoId: payload.videoId, subtitle: payload.subtitle });

  if (pendingCues.length >= BATCH_SIZE) {
    void flushPendingCues();
    return;
  }

  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    void flushPendingCues();
  }, BATCH_FLUSH_DELAY_MS);
};

const flushPendingCues = async (): Promise<void> => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }

  if (pendingCues.length === 0) {
    return;
  }

  const batch = pendingCues.splice(0, BATCH_SIZE);
  const settings = await getTranslationSettings();

  if (!settings.apiKey.trim()) {
    const uniqueTabs = new Set(batch.map((cue) => cue.tabId));
    uniqueTabs.forEach((tabId) => {
      chrome.tabs.sendMessage(tabId, {
        type: ChromeRuntimeMessageType.TranslationStatus,
        payload: { available: false, message: "Set your translation API key in extension settings." },
      } as ChromeRuntimeMessage);
    });
    return;
  }

  const groupedByVideo = new Map<string, PendingCue[]>();
  batch.forEach((cue) => {
    const key = cue.videoId;
    const group = groupedByVideo.get(key) ?? [];
    group.push(cue);
    groupedByVideo.set(key, group);
  });

  await Promise.all(
    Array.from(groupedByVideo.values()).map(async (group) => {
      const cacheKey = getVideoTranslationCacheKey(group[0].videoId, settings.provider, settings.targetLanguage);
      const stored = await chrome.storage.local.get(cacheKey);
      const cache = (stored[cacheKey] ?? {}) as Record<string, string>;

      const uniqueMissing = Array.from(new Set(group.map((cue) => cue.subtitle).filter((subtitle) => !cache[subtitle])));

      if (uniqueMissing.length > 0) {
        try {
          const translatedLines = await runLimited(() => translateBatch(settings, uniqueMissing));
          uniqueMissing.forEach((subtitle, index) => {
            cache[subtitle] = translatedLines[index] ?? subtitle;
          });
          await chrome.storage.local.set({ [cacheKey]: cache });
        } catch (error) {
          console.error(error);
          const uniqueTabs = new Set(group.map((cue) => cue.tabId));
          uniqueTabs.forEach((tabId) => {
            chrome.tabs.sendMessage(tabId, {
              type: ChromeRuntimeMessageType.TranslationStatus,
              payload: { available: true, message: "Translation failed. Showing Dutch subtitles only." },
            } as ChromeRuntimeMessage);
          });
          return;
        }
      }

      group.forEach((cue) => {
        const translatedText = cache[cue.subtitle];
        if (!translatedText) {
          return;
        }

        const payload: TranslationFinishedPayload = {
          sourceText: cue.subtitle,
          translatedText,
        };

        chrome.tabs.sendMessage(cue.tabId, {
          type: ChromeRuntimeMessageType.TranslateFinished,
          payload,
        } as ChromeRuntimeMessage);
      });

      const uniqueTabs = new Set(group.map((cue) => cue.tabId));
      uniqueTabs.forEach((tabId) => {
        chrome.tabs.sendMessage(tabId, {
          type: ChromeRuntimeMessageType.TranslationStatus,
          payload: { available: true, message: "" },
        } as ChromeRuntimeMessage);
      });
    })
  );
};
