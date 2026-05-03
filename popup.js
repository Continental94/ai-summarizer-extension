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
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  // Show page title and URL
  pageTitle.textContent = tab.title || 'Unknown Page';
  pageUrl.textContent = tab.url || '';

  // Check for cached summary
  const cached = await sendMessage({ type: 'GET_CACHED', url: tab.url });
  if (cached && cached.summary) {
    showSummary(cached.summary, true);
  }

  // Check if API key exists
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

  // Load existing key into input (masked)
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

  await sendMessage({ type: 'SAVE_API_KEY', key });
  apiKeyInput.value = '';
  apiKeyInput.placeholder = '••••••••••••••••••••••••••••••••';
  keyStatus.textContent = '✓ API key saved successfully!';
  keyStatus.className = 'key-status success';

  // Switch back to main panel after saving
  setTimeout(() => {
    settingsPanel.hidden = true;
    mainPanel.hidden = false;
    hideError();
  }, 1000);
});

// ── Summarize ─────────────────────────────────
summarizeBtn.addEventListener('click', async () => {
  // Check API key first
  const keyResult = await sendMessage({ type: 'GET_API_KEY' });
  if (!keyResult.key) {
    showError('Please add your Gemini API key in Settings ⚙️');
    return;
  }

  // Show loading
  showLoading();

  try {
    // Extract content from page
    let content = '';
    try {
      const extracted = await chrome.tabs.sendMessage(currentTab.id, {
        type: 'EXTRACT_CONTENT',
      });
      content = extracted?.content || '';
    } catch (e) {
      // Content script may not be injected on special pages
      throw new Error('Cannot summarize this page. Try on a regular article or blog post.');
    }

    if (!content || content.length < 100) {
      throw new Error('Not enough content found on this page to summarize.');
    }

    // Send to background for AI processing
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
  errorText.textContent = message;
  errorBox.hidden = false;
}

function hideError() {
  errorBox.hidden = true;
}

function showSummary(rawSummary, fromCache = false) {
  hideAll();
  currentSummary = rawSummary;

  // Parse the structured response
  const parsed = parseSummary(rawSummary);

  // Fill in summary
  summaryText.textContent = parsed.summary;

  // Fill key points
  keyPointsList.innerHTML = '';
  parsed.keyPoints.forEach((point) => {
    const li = document.createElement('li');
    li.textContent = point;
    keyPointsList.appendChild(li);
  });

  // Fill key insights
  keyInsightsList.innerHTML = '';
  parsed.keyInsights.forEach((insight) => {
    const li = document.createElement('li');
    li.textContent = insight;
    keyInsightsList.appendChild(li);
  });

  // Reading time
  readingTime.textContent = parsed.readingTime || '';

  // Show cache badge
  if (fromCache) {
    cacheBadge.hidden = false;
  }

  // Show output
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
    // Extract Summary
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|$)/i);
    if (summaryMatch) result.summary = summaryMatch[1].trim();

    // Extract Key Points
    const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]*?)(?=KEY INSIGHTS:|$)/i);
    if (keyPointsMatch) {
      result.keyPoints = keyPointsMatch[1]
        .split('\n')
        .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
        .filter((l) => l.length > 0);
    }

    // Extract Key Insights
    const insightsMatch = text.match(/KEY INSIGHTS:\s*([\s\S]*?)(?=READING TIME:|$)/i);
    if (insightsMatch) {
      result.keyInsights = insightsMatch[1]
        .split('\n')
        .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
        .filter((l) => l.length > 0);
    }

    // Extract Reading Time
    const readingMatch = text.match(/READING TIME:\s*([\s\S]*?)$/i);
    if (readingMatch) result.readingTime = '⏱ ' + readingMatch[1].trim();

    // Fallback if parsing fails
    if (!result.summary) result.summary = text.slice(0, 300);

  } catch (e) {
    result.summary = text.slice(0, 300);
  }

  return result;
}

// ── Message Helper ────────────────────────────
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}