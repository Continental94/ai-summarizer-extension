chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    const content = extractPageContent();
    sendResponse({ content, title: document.title, url: window.location.href });
  }
  return true;
});

function extractPageContent() {
  // Remove unwanted elements
  const unwanted = [
    'script', 'style', 'nav', 'header', 'footer',
    'aside', 'iframe', 'noscript', '.ads', '.cookie',
    '.popup', '.modal', '.sidebar', '.menu', '.navigation',
    '.comments', '[role="banner"]', '[role="navigation"]',
    '[role="complementary"]', '[aria-hidden="true"]'
  ];

  const body = document.body.cloneNode(true);

  unwanted.forEach(selector => {
    try {
      body.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {}
  });

  // Try article selectors first
  const articleSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.post-body',
    '.article-body',
    '.story-body',
    '.content-body',
    '.page-content',
    '.single-content',
    '#content',
    '#main',
    '.content',
    '.post',
  ];

  let mainContent = null;
  for (const selector of articleSelectors) {
    const el = body.querySelector(selector);
    if (el) {
      const text = el.innerText || el.textContent || '';
      if (text.trim().length > 100) {
        mainContent = el;
        break;
      }
    }
  }

  // Fall back to paragraphs if no article found
  if (!mainContent) {
    const paragraphs = Array.from(body.querySelectorAll('p'));
    const longParagraphs = paragraphs.filter(p => {
      const text = p.innerText || p.textContent || '';
      return text.trim().length > 40;
    });

    if (longParagraphs.length > 2) {
      return longParagraphs
        .map(p => p.innerText || p.textContent || '')
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  }

  // Final fallback — use whole body
  const target = mainContent || body;
  const text = target.innerText || target.textContent || '';

  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{3,}/g, ' ')
    .trim();
}