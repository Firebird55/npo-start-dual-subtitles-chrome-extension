export const DEFAULT_PROVIDER = "deepl" as const;
export const DEFAULT_TARGET_LANGUAGE = "en" as const;

export type TranslationProvider = "deepl" | "claude" | "openai";
export type TargetLanguage = "en" | "zh";

export type TranslationSettings = {
  provider: TranslationProvider;
  apiKey: string;
  targetLanguage: TargetLanguage;
};

export type TranslationRequestPayload = {
  subtitle: string;
  videoId: string;
};

export type TranslationFinishedPayload = {
  sourceText: string;
  translatedText: string;
};

export type TranslationStatusPayload = {
  available: boolean;
  message: string;
};

export type TestConnectionResult = {
  success: boolean;
  message: string;
};

export type ChromeRuntimeMessage = {
  type: ChromeRuntimeMessageType;
  payload?: string | TranslationRequestPayload | TranslationFinishedPayload | TranslationStatusPayload | TestConnectionResult | null;
};

export enum ChromeRuntimeMessageType {
  InitiateMonitoring = "initiateMonitoring",
  Translate = "translate",
  TranslateFinished = "translateFinished",
  InitiateOneClickConfiguration = "initiateOneClickConfiguration",
  TranslationStatus = "translationStatus",
  TestTranslationSettings = "testTranslationSettings",
  TestTranslationSettingsFinished = "testTranslationSettingsFinished",
}
