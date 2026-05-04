// ── DOM Elements ──────────────────────────────
const summarizeBtn = document.getElementById('summarizeBtn');
const clearBtn = document.getElementById('clearBtn');
const loadingState = document.getElementById('loadingState');
const errorBox = document.getElementById('errorBox');
const errorText = document.getElementById('errorText');
const summaryOutput = document.getElementById('summaryOutput');
const summaryText = document.getElementById('summaryText');
const keyPointsList = document.getElementById('keyPointsList');
const keyInsightsList = document.getElementById('keyInsightsList');
const readingTime = document.getElementById('readingTime');
const pageTitle = document.getElementById('pageTitle');
const pageUrl = document.getElementById('pageUrl');
const cacheBadge = document.getElementById('cacheBadge');
const copyBtn = document.getElementById('copyBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const mainPanel = document.getElementById('mainPanel');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const keyStatus = document.getElementById('keyStatus');

// ── State ─────────────────────────────────────
let currentTab = null;
let currentSummary = '';

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  pageTitle.textContent = tab.title || 'Unknown Page';
  pageUrl.textContent = tab.url || '';

  const keyResult = await sendMessage({ type: 'GET_API_KEY' });
  if (!keyResult.key) {
    showError('No API key found. Click ⚙️ to add your Gemini API key.');
  }
});

// ── Settings Toggle ───────────────────────────
settingsBtn.addEventListener('click', () => {
  const isHidden = settingsPanel.hidden;
  settingsPanel.hidden = !isHidden;
  mainPanel.hidden = isHidden;
  settingsBtn.setAttribute('aria-expanded', String(isHidden));

  if (!isHidden) return;

  sendMessage({ type: 'GET_API_KEY' }).then((result) => {
    if (result.key) {
      apiKeyInput.placeholder = '••••••••••••••••••••••••••••••••';
      keyStatus.textContent = '✓ API key is saved';
      keyStatus.className = 'key-status success';
    }
  });
});

// ── Save API Key ──────────────────────────────
saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = 'Please enter a valid API key';
    keyStatus.className = 'key-status error';
    return;
  }

  const result = await sendMessage({ type: 'SAVE_API_KEY', key });
  if (result.error) {
    keyStatus.textContent = result.error;
    keyStatus.className = 'key-status error';
    return;
  }

  apiKeyInput.value = '';
  apiKeyInput.placeholder = '••••••••••••••••••••••••••••••••';
  keyStatus.textContent = '✓ API key saved successfully!';
  keyStatus.className = 'key-status success';

  setTimeout(() => {
    settingsPanel.hidden = true;
    mainPanel.hidden = false;
    hideError();
  }, 1000);
});

// ── Summarize ─────────────────────────────────
summarizeBtn.addEventListener('click', async () => {
  const keyResult = await sendMessage({ type: 'GET_API_KEY' });
  if (!keyResult.key) {
    showError('Please add your Gemini API key in Settings ⚙️');
    return;
  }

  showLoading();

  try {
    let content = '';
    try {
      const extracted = await chrome.tabs.sendMessage(currentTab.id, {
        type: 'EXTRACT_CONTENT',
      }).catch(() => null);

      if (extracted?.content) {
        content = extracted.content;
      } else {
        const results = await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => {
            const unwanted = ['script','style','nav','header','footer','aside','iframe','noscript'];
            const body = document.body.cloneNode(true);
            unwanted.forEach(tag => {
              body.querySelectorAll(tag).forEach(el => el.remove());
            });
            const selectors = ['article','main','[role="main"]','.post-content','.entry-content','#content','.content'];
            for (const sel of selectors) {
              const el = body.querySelector(sel);
              if (el && (el.innerText || '').trim().length > 100) {
                return (el.innerText || '').trim();
              }
            }
            const paras = Array.from(body.querySelectorAll('p'))
              .map(p => (p.innerText || '').trim())
              .filter(t => t.length > 40);
            if (paras.length > 2) return paras.join('\n\n');
            return (document.body.innerText || '').slice(0, 8000).trim();
          }
        });
        content = results?.[0]?.result || '';
      }
    } catch (e) {
      throw new Error('Cannot access this page. Try on a regular website.');
    }

    if (!content || content.length < 100) {
      throw new Error('Not enough content found on this page to summarize.');
    }

    const result = await sendMessage({
      type: 'SUMMARIZE',
      content,
      url: currentTab.url,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    showSummary(result.summary, result.fromCache);

  } catch (error) {
    showError(error.message);
  }
});

// ── Clear ─────────────────────────────────────
clearBtn.addEventListener('click', () => {
  hideAll();
  clearBtn.hidden = true;
  summarizeBtn.hidden = false;
  currentSummary = '';
});

// ── Copy ─────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!currentSummary) return;
  try {
    await navigator.clipboard.writeText(currentSummary);
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
  } catch (e) {
    copyBtn.textContent = 'Failed';
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
  }
});

// ── Display Functions ─────────────────────────
function showLoading() {
  hideAll();
  loadingState.hidden = false;
  summarizeBtn.disabled = true;
}

function hideAll() {
  loadingState.hidden = true;
  errorBox.hidden = true;
  summaryOutput.hidden = true;
  cacheBadge.hidden = true;
  summarizeBtn.disabled = false;
}

function showError(message) {
  hideAll();
  errorText.textContent = sanitize(message);
  errorBox.hidden = false;
}

function hideError() {
  errorBox.hidden = true;
}

function showSummary(rawSummary, fromCache = false) {
  hideAll();
  currentSummary = rawSummary;

  const parsed = parseSummary(rawSummary);

  // Summary - sanitized
  summaryText.textContent = sanitize(parsed.summary);

  // Key points - sanitized
  keyPointsList.innerHTML = '';
  parsed.keyPoints.forEach((point) => {
    const li = document.createElement('li');
    li.textContent = sanitize(point);
    keyPointsList.appendChild(li);
  });

  // Key insights - sanitized
  keyInsightsList.innerHTML = '';
  parsed.keyInsights.forEach((insight) => {
    const li = document.createElement('li');
    li.textContent = sanitize(insight);
    keyInsightsList.appendChild(li);
  });

  // Reading time + word count
  const wordCount = rawSummary.split(/\s+/).filter(w => w.length > 0).length;
  readingTime.textContent = (parsed.readingTime || '') + ` · ${wordCount} words`;

  if (fromCache) {
    cacheBadge.hidden = false;
  }

  summaryOutput.hidden = false;
  clearBtn.hidden = false;
  summarizeBtn.hidden = true;
}

// ── Parse AI Response ─────────────────────────
function parseSummary(text) {
  const result = {
    summary: '',
    keyPoints: [],
    keyInsights: [],
    readingTime: '',
  };

  try {
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|$)/i);
    if (summaryMatch) result.summary = summaryMatch[1].trim();

    const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]*?)(?=KEY INSIGHTS:|$)/i);
    if (keyPointsMatch) {
      result.keyPoints = keyPointsMatch[1]
        .split('\n')
        .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
        .filter((l) => l.length > 0);
    }

    const insightsMatch = text.match(/KEY INSIGHTS:\s*([\s\S]*?)(?=READING TIME:|$)/i);
    if (insightsMatch) {
      result.keyInsights = insightsMatch[1]
        .split('\n')
        .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
        .filter((l) => l.length > 0);
    }

    const readingMatch = text.match(/READING TIME:\s*([\s\S]*?)$/i);
    if (readingMatch) result.readingTime = '⏱ ' + readingMatch[1].trim();

    if (!result.summary) result.summary = text.slice(0, 300);

  } catch (e) {
    result.summary = text.slice(0, 300);
  }

  return result;
}

// ── XSS Sanitization ──────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Message Helper ────────────────────────────
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}