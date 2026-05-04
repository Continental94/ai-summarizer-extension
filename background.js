chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate message structure
  if (!message || typeof message !== 'object' || !message.type) {
    sendResponse({ error: 'Invalid message format' });
    return true;
  }

  // Only accept messages from extension itself
  if (sender.id !== chrome.runtime.id && !sender.tab) {
    sendResponse({ error: 'Unauthorized sender' });
    return true;
  }

  if (message.type === 'SUMMARIZE') {
    // Validate content
    if (!message.content || typeof message.content !== 'string') {
      sendResponse({ error: 'Invalid content' });
      return true;
    }
    handleSummarize(message.content, message.url)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'SAVE_API_KEY') {
    // Validate API key format
    if (!message.key || typeof message.key !== 'string' || message.key.length < 10) {
      sendResponse({ error: 'Invalid API key format' });
      return true;
    }
    chrome.storage.local.set({ geminiApiKey: message.key }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_API_KEY') {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      sendResponse({ key: result.geminiApiKey || null });
    });
    return true;
  }

  sendResponse({ error: 'Unknown message type' });
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUMMARIZE') {
    handleSummarize(message.content, message.url)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'GET_CACHED') {
    sendResponse(null);
    return true;
  }

  if (message.type === 'SAVE_API_KEY') {
    chrome.storage.local.set({ geminiApiKey: message.key }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_API_KEY') {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      sendResponse({ key: result.geminiApiKey || null });
    });
    return true;
  }
});

async function handleSummarize(content, url) {
  const result = await chrome.storage.local.get(['geminiApiKey']);
  const apiKey = result.geminiApiKey;

  if (!apiKey) {
    throw new Error('No API key found. Please add your Gemini API key in Settings.');
  }

  const truncated = content.slice(0, 12000);

  const prompt = `You are a helpful assistant that summarizes web pages clearly and concisely.

Analyze the following webpage content and provide:

1. **Summary**: A clear 2-3 sentence overview of the main topic
2. **Key Points**: 5 bullet points of the most important information
3. **Key Insights**: 2-3 deeper insights or takeaways
4. **Reading Time**: Estimated reading time for the original content

Format your response EXACTLY like this:
SUMMARY:
[Your 2-3 sentence summary here]

KEY POINTS:
- [Point 1]
- [Point 2]
- [Point 3]
- [Point 4]
- [Point 5]

KEY INSIGHTS:
- [Insight 1]
- [Insight 2]
- [Insight 3]

READING TIME:
[X minute read]

Webpage content:
${truncated}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'API request failed');
  }

  const data = await response.json();
  const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!summary) {
    throw new Error('No summary generated. Please try again.');
  }

  return { summary, fromCache: false };
}