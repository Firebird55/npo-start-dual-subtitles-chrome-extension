import { DEFAULT_PROVIDER, DEFAULT_TARGET_LANGUAGE, TargetLanguage, TestConnectionResult, TranslationProvider, TranslationSettings } from "./types";

const SETTINGS_KEY = "translationSettings";
const TARGET_LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  en: "English",
  zh: "Mandarin Chinese",
};

export const getDefaultSettings = (): TranslationSettings => ({
  provider: DEFAULT_PROVIDER,
  apiKey: "",
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
});

export const getTranslationSettings = async (): Promise<TranslationSettings> => {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return {
    ...getDefaultSettings(),
    ...(stored[SETTINGS_KEY] ?? {}),
  } as TranslationSettings;
};

export const setTranslationSettings = async (settings: TranslationSettings): Promise<void> => {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
};

export const getVideoTranslationCacheKey = (
  videoId: string,
  provider: TranslationProvider,
  targetLanguage: TargetLanguage
): string => `translationCache_${videoId}_${provider}_${targetLanguage}`;

const getTargetLanguageLabel = (targetLanguage: TargetLanguage): string => TARGET_LANGUAGE_LABELS[targetLanguage];

const splitTranslatedLines = (translatedText: string, expectedCount: number): string[] => {
  const lines = translatedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === expectedCount) {
    return lines;
  }

  return translatedText
    .split("|||TRANSLATION_BOUNDARY|||")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, expectedCount);
};

const translateWithDeepL = async (apiKey: string, targetLanguage: TargetLanguage, lines: string[]): Promise<string[]> => {
  const body = new URLSearchParams();
  body.append("target_lang", targetLanguage === "zh" ? "ZH" : "EN");
  body.append("source_lang", "NL");
  lines.forEach((line) => body.append("text", line));

  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`DeepL request failed (${response.status})`);
  }

  const data = await response.json() as { translations?: Array<{ text: string }> };
  return (data.translations ?? []).map((item) => item.text.trim());
};

const translateWithAnthropic = async (apiKey: string, targetLanguage: TargetLanguage, lines: string[]): Promise<string[]> => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: `Translate the following Dutch subtitle text to ${getTargetLanguageLabel(targetLanguage)}. Return ONLY the translated text, no explanation. Preserve line breaks exactly.`,
      messages: [
        {
          role: "user",
          content: lines.join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude request failed (${response.status})`);
  }

  const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
  return splitTranslatedLines(text, lines.length);
};

const translateWithOpenAI = async (apiKey: string, targetLanguage: TargetLanguage, lines: string[]): Promise<string[]> => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `Translate the following Dutch subtitle text to ${getTargetLanguageLabel(targetLanguage)}. Return ONLY the translated text, no explanation. Preserve line breaks exactly.`,
        },
        {
          role: "user",
          content: lines.join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status})`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  return splitTranslatedLines(text, lines.length);
};

export const translateBatch = async (settings: TranslationSettings, lines: string[]): Promise<string[]> => {
  if (!settings.apiKey.trim()) {
    throw new Error("Missing API key");
  }

  if (lines.length === 0) {
    return [];
  }

  switch (settings.provider) {
    case "deepl":
      return translateWithDeepL(settings.apiKey.trim(), settings.targetLanguage, lines);
    case "claude":
      return translateWithAnthropic(settings.apiKey.trim(), settings.targetLanguage, lines);
    case "openai":
      return translateWithOpenAI(settings.apiKey.trim(), settings.targetLanguage, lines);
    default:
      return [];
  }
};

export const testTranslationConnection = async (): Promise<TestConnectionResult> => {
  const settings = await getTranslationSettings();
  if (!settings.apiKey.trim()) {
    return { success: false, message: "Add an API key to enable translation." };
  }

  try {
    const translated = await translateBatch(settings, ["Hallo wereld"]);
    return {
      success: translated.length > 0,
      message: translated.length > 0 ? `${settings.provider === "deepl" ? "DeepL" : settings.provider === "claude" ? "Claude" : "OpenAI"} connected` : "Translation test returned no text.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation test failed.";
    return { success: false, message };
  }
};

export const getProviderLabel = (provider: TranslationProvider): string => {
  switch (provider) {
    case "deepl":
      return "DeepL";
    case "claude":
      return "Claude";
    case "openai":
      return "OpenAI";
  }
};
