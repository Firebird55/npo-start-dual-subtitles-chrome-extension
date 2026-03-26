import { clickSettingsButton, openSubtitleSettings, turnOffSubtitles, turnOnSubtitles } from "./onboarding-helper";
import {
  ChromeRuntimeMessage,
  ChromeRuntimeMessageType,
  TranslationFinishedPayload,
  TranslationStatusPayload,
} from "./types";

const subtitleOverlaySelector = ".bmpui-ui-subtitle-overlay";
const subtitleLabelSelector = ".bmpui-ui-subtitle-label";
const translatedSubtitleColor = "#1eb7d3";
const bannerId = "npo-translation-banner";

let lastText = "";
let lastTranslatedText = "";
let monitoringStarted = false;

chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage) => {
  if (req.type === ChromeRuntimeMessageType.InitiateMonitoring) {
    monitorDomChanges();
  }

  if (req.type === ChromeRuntimeMessageType.TranslateFinished && req.payload) {
    const payload = req.payload as TranslationFinishedPayload;
    if (payload.sourceText !== lastText) {
      return;
    }

    addTranslatedSubtitle(payload.translatedText);
    lastTranslatedText = payload.translatedText;
  }

  if (req.type === ChromeRuntimeMessageType.InitiateOneClickConfiguration) {
    startOnboarding();
  }

  if (req.type === ChromeRuntimeMessageType.TranslationStatus && req.payload) {
    const payload = req.payload as TranslationStatusPayload;
    toggleBanner(!payload.available || Boolean(payload.message), payload.message);
  }
});

const monitorDomChanges = (): void => {
  if (monitoringStarted) {
    return;
  }

  const targetNode = document.querySelector(subtitleOverlaySelector);
  if (!targetNode) {
    return;
  }

  monitoringStarted = true;
  const observer = new MutationObserver(() => {
    void handleMutations();
  });
  observer.observe(targetNode, { attributes: false, childList: true, subtree: true, characterData: true });
};

const getVideoId = (): string => {
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? window.location.href;
  return canonical.replace(/[^a-zA-Z0-9_-]/g, "_");
};

const handleMutations = async (): Promise<void> => {
  removeExistingTranslatedSubtitle();

  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement | null;
  if (!subtitleParentElement) {
    return;
  }

  const textToTranslate = subtitleParentElement.innerText
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  if (!textToTranslate) {
    return;
  }

  if (textToTranslate === lastText && lastTranslatedText) {
    addTranslatedSubtitle(lastTranslatedText);
    return;
  }

  lastText = textToTranslate;
  lastTranslatedText = "";

  chrome.runtime.sendMessage({
    type: ChromeRuntimeMessageType.Translate,
    payload: {
      subtitle: textToTranslate,
      videoId: getVideoId(),
    },
  } as ChromeRuntimeMessage);
};

const removeExistingTranslatedSubtitle = (): void => {
  const parent = document.querySelector(subtitleLabelSelector) as HTMLElement | null;
  if (!parent) {
    return;
  }

  parent.querySelectorAll(".translated").forEach((node) => node.remove());
  parent.querySelectorAll(".translated-break").forEach((node) => node.remove());
};

const addTranslatedSubtitle = (subtitle: string): void => {
  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement | null;
  if (!subtitleParentElement || !subtitle) {
    return;
  }

  removeExistingTranslatedSubtitle();
  const newSpan = createTranslatedSpan(subtitle);
  insertTranslatedSpan(subtitleParentElement, newSpan);
};

const createTranslatedSpan = (subtitle: string): HTMLElement => {
  const newSpan = document.createElement("span");
  newSpan.innerText = subtitle;
  newSpan.classList.add("translated");
  newSpan.style.color = translatedSubtitleColor;
  newSpan.style.backgroundColor = "black";
  return newSpan;
};

const insertTranslatedSpan = (parent: HTMLElement, newSpan: HTMLElement): void => {
  const br = document.createElement("br");
  br.classList.add("translated-break");
  parent.insertBefore(br, parent.firstChild);
  parent.insertBefore(newSpan, parent.firstChild);
};

const toggleBanner = (show: boolean, message: string): void => {
  let banner = document.getElementById(bannerId);

  if (!show) {
    banner?.remove();
    return;
  }

  if (!banner) {
    banner = document.createElement("div");
    banner.id = bannerId;
    banner.style.position = "fixed";
    banner.style.top = "12px";
    banner.style.right = "12px";
    banner.style.zIndex = "999999";
    banner.style.background = "rgba(0, 0, 0, 0.8)";
    banner.style.color = "#fff";
    banner.style.padding = "8px 12px";
    banner.style.borderRadius = "6px";
    banner.style.fontSize = "12px";
    banner.style.fontFamily = "Arial, sans-serif";
    document.body.appendChild(banner);
  }

  banner.textContent = message;
};

const startOnboarding = (): void => {
  clickSettingsButton();
  setTimeout(() => {
    openSubtitleSettings();
  }, 200);
  setTimeout(() => {
    turnOffSubtitles();
  }, 400);
  setTimeout(() => {
    openSubtitleSettings();
  }, 600);
  setTimeout(() => {
    turnOnSubtitles();
  }, 800);
  setTimeout(() => {
    clickSettingsButton();
  }, 1000);
  setTimeout(() => {
    monitorDomChanges();
  }, 1200);
};
