AI Page Summarizer — Chrome Extension

A Chrome Extension (Manifest V3) that extracts content from any webpage and uses Google Gemini AI to generate structured summaries instantly.

🎥 Demo Video
[Watch Demo] https://www.loom.com/share/471f390b9e0d424085072312f277eaa8

✨ Features
- 📄 Bullet-point summary of any webpage
- 🎯 Key points extraction
- 💡 Key insights
- ⏱ Estimated reading time
- ⚡ Caches results per URL
- 🔐 Secure API key storage
- 🧹 Clear/reset functionality

🛠️ Tech Stack
- Chrome Extension Manifest V3
- Vanilla JavaScript
- Google Gemini AI API
- Chrome Storage API

🔐 Security
- API key stored securely in `chrome.storage.local`
- All AI calls made from background service worker only
- API key never exposed in content scripts
- No secrets committed to repository

📦 Installation (Local)

 Step 1 — Clone the repository
```bash
git clone https://github.com/Continental94/ai-summarizer-extension.git
```

Step 2 — Get a Gemini API Key
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **"Get API Key"**
3. Click "Create API Key"
4. Copy the key

Step 3 — Load the extension in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Toggle "Developer mode" ON (top right)
3. Click **"Load unpacked"**
4. Select the cloned `ai-summarizer-extension` folder
5. The extension will appear in your toolbar

 Step 4 — Add your API Key
1. Click the extension icon in Chrome toolbar
2. Click the ⚙️ settings icon
3. Paste your Gemini API key
4. Click "Save"

Step 5 — Summarize any page
1. Navigate to any article or blog post
2. Click the extension icon
3. Click "Summarize This Page"
4. Wait a few seconds for the AI summary

🏗️ Architecture
ai-summarizer-extension/
├── manifest.json      ← Extension config (Manifest V3)
├── background.js      ← Service worker — handles all AI API calls
├── content.js         ← Extracts readable content from webpages
├── popup.html         ← Extension popup UI
├── popup.js           ← Popup logic and message passing
├── popup.css          ← Popup styles
└── icons/             ← Extension icons
├── icon16.png
├── icon48.png
└── icon128.png

How it works
1. User clicks "Summarize This Page" in popup
2. `popup.js` sends message to `content.js` to extract page text
3. `content.js` strips navigation/ads and returns clean article content
4. `popup.js` sends content to `background.js` via Chrome messaging
5. `background.js` calls Gemini AI API securely
6. AI returns structured summary which is displayed in popup

 🤖 AI Integration
- Provider: Google Gemini AI (`gemini-2.5-flash` model)
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- Why Gemini: Free tier available, fast responses, excellent summarization
- Security: API key stored in `chrome.storage.local`, never in source code

 ⚖️ Trade-offs
- Local extension only (not on Chrome Web Store)
- Requires user to provide their own API key
- Free tier has rate limits (60 requests/minute)
- Works best on article/blog pages, not web apps

 🔑 Permissions Used
- `activeTab` — Access current tab content
- `storage` — Store API key and cached summaries
- `scripting` — Inject content script
- `tabs` — Get current tab info