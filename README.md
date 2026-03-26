# NPO Start Dual Subtitles

NPO Start Dual Subtitles is a Chrome extension designed for language learning. It keeps the original Dutch subtitles on-screen and can add an English or Mandarin translation underneath.

## Features

- Automatically monitors subtitle changes on NPO Start.
- Preserves the original Dutch subtitle line and adds a translated second line.
- Supports user-provided DeepL, Anthropic Claude, or OpenAI API keys.
- Batches subtitle cues to reduce API calls and caches translated episodes locally.
- Falls back to Dutch-only subtitles if translation is not configured or a request fails.

## Installation

1. Clone the repository to your local machine:
   ```sh
   git clone https://github.com/yourusername/npo-subtitle-translator.git
   ```
2. Install the required packages and build:
   ```sh
   npm install
   npm run build
   ```
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the `dist` folder.

## Usage

1. Navigate to [NPO Start](https://npo.start.nl/) and open a video.
2. Turn on the Dutch subtitles in the player settings.
3. Open the extension popup.
4. Choose **DeepL API Free**, **Anthropic Claude API**, or **OpenAI API**.
5. Paste your own API key, select **English** or **中文 / Mandarin**, and click **Save Settings**.
6. Click **Test Connection** to confirm the selected provider works.
7. Click **Activate Translation** or use the one-click flow.

## Notes

- The extension stores provider settings in `chrome.storage.sync`.
- Per-video translated subtitle caches are stored in `chrome.storage.local`.
- No API keys are bundled with the extension.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
