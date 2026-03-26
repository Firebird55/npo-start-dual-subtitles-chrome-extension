import { ChromeRuntimeMessageType, TargetLanguage, TestConnectionResult, TranslationProvider, TranslationSettings } from "./types";
import { getDefaultSettings, getProviderLabel, getTranslationSettings, setTranslationSettings } from "./translation";

const providerSelector = document.getElementById("provider-selector") as HTMLSelectElement;
const languageSelector = document.getElementById("language-selector") as HTMLSelectElement;
const apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement;
const statusIndicator = document.getElementById("status-indicator") as HTMLDivElement;
const saveButton = document.getElementById("save-button") as HTMLButtonElement;
const testButton = document.getElementById("test-button") as HTMLButtonElement;
const activateButton = document.getElementById("activate-button") as HTMLButtonElement;
const oneClickButton = document.getElementById("one-click-button") as HTMLButtonElement;

const providers: Array<{ value: TranslationProvider; label: string }> = [
  { value: "deepl", label: "DeepL API Free" },
  { value: "claude", label: "Anthropic Claude API" },
  { value: "openai", label: "OpenAI API" },
];

const languages: Array<{ code: TargetLanguage; name: string }> = [
  { code: "en", name: "English" },
  { code: "zh", name: "中文 / Mandarin" },
];

const renderSelectOptions = (): void => {
  providers.forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider.value;
    option.textContent = provider.label;
    providerSelector.appendChild(option);
  });

  languages.forEach((language) => {
    const option = document.createElement("option");
    option.value = language.code;
    option.textContent = language.name;
    languageSelector.appendChild(option);
  });
};

const updateStatus = (message: string, success = false): void => {
  statusIndicator.textContent = message;
  statusIndicator.dataset.success = success ? "true" : "false";
};

const saveSettings = async (): Promise<TranslationSettings> => {
  const settings: TranslationSettings = {
    provider: providerSelector.value as TranslationProvider,
    apiKey: apiKeyInput.value.trim(),
    targetLanguage: languageSelector.value as TargetLanguage,
  };

  await setTranslationSettings(settings);
  updateStatus(`Saved ${getProviderLabel(settings.provider)} settings.`, true);
  return settings;
};

const loadSettings = async (): Promise<void> => {
  const settings = { ...getDefaultSettings(), ...(await getTranslationSettings()) };
  providerSelector.value = settings.provider;
  languageSelector.value = settings.targetLanguage;
  apiKeyInput.value = settings.apiKey;
  updateStatus(settings.apiKey ? `${getProviderLabel(settings.provider)} ready to test.` : "Add an API key to enable translation.");
};

renderSelectOptions();
void loadSettings();

saveButton.addEventListener("click", () => {
  void saveSettings();
});

testButton.addEventListener("click", () => {
  void (async () => {
    await saveSettings();
    updateStatus("Testing connection...");

    chrome.runtime.sendMessage(
      { type: ChromeRuntimeMessageType.TestTranslationSettings },
      (response: TestConnectionResult | undefined) => {
        if (chrome.runtime.lastError) {
          updateStatus(chrome.runtime.lastError.message || "Unable to test connection.");
          return;
        }

        if (!response) {
          updateStatus("No response from background service.");
          return;
        }

        updateStatus(`${response.success ? "✓" : "✕"} ${response.message}`, response.success);
      }
    );
  })();
});

activateButton.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: ChromeRuntimeMessageType.InitiateMonitoring });
    }
  });
});

oneClickButton.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: ChromeRuntimeMessageType.InitiateOneClickConfiguration });
    }
  });
});
