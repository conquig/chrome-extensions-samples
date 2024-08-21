// The underlying model has a context of 1,024 tokens, out of which 26 are used by the internal prompt,
// leaving about 998 tokens for the input text. Each token corresponds, roughly, to about 4 characters, so 4,000
// is used as a limit to warn the user the content might be too long to summarize.
const MAX_MODEL_CHARS = 4000;

let pageContent = '';

chrome.storage.session.get('pageContent', ({ pageContent }) => {
  onContentChange(pageContent);
});

chrome.storage.session.onChanged.addListener((changes) => {
  const pageContent = changes['pageContent'];
  onContentChange(pageContent.newValue);
});

const summaryElement = document.body.querySelector('#summary');
const warningElement = document.body.querySelector('#warning');

async function onContentChange(newContent) {
  if (pageContent == newContent) {
    console.log('no new content');
    return;
  }
  pageContent = newContent;
  let summary;
  if (newContent) {
    if (newContent.length > MAX_MODEL_CHARS) {
      showWarning(
        `Text is too long for summarization with ${newContent.length} characters (maximum supported content length is ~4000 characters).`
      );
    } else {
      showWarning('');
    }
    showSummary('Loading...');
    summary = await generateSummary(newContent);
    summary = escapeHTML(summary);
  } else {
    summary = "There's nothing to summarize";
  }
  showSummary(summary);
}

async function generateSummary(text) {
  try {
    let session = await createSummarizationSession();
    let summary = await session.summarize(text);
    session.destroy();
    return summary;
  } catch (e) {
    console.log('Summary generation failed');
    console.error(e);
    console.log('Prompt:\n\n' + text);
    return 'Error: ' + e.message;
  }
}

async function createSummarizationSession(downloadProgressCallback) {
  if (!window.ai.summarizer) {
    throw new Error('AI Summarization is not supported');
  }
  const canSummarize = await window.ai.summarizer.capabilities();
  if (canSummarize.available === 'no') {
    throw new Error('AI Summarization is not availabe');
  }

  const summarizationSession = await window.ai.summarizer.create();
  if (canSummarize.available === 'after-download') {
    if (downloadProgressCallback) {
      summarizationSession.addEventListener(
        'downloadprogress',
        downloadProgressCallback
      );
    }
    await summarizationSession.ready;
  }

  return summarizationSession;
}

async function showSummary(text) {
  // Make sure to preserve line breaks in the response
  summaryElement.textContent = '';
  const paragraphs = text.split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (paragraph) {
      summaryElement.appendChild(document.createTextNode(paragraph));
    }
    summaryElement.appendChild(document.createElement('BR'));
  }
}

async function showWarning(text) {
  warningElement.textContent = text;
  if (text) {
    warningElement.removeAttribute('hidden');
  } else {
    warningElement.setAttribute('hidden', '');
  }
}

function escapeHTML(str) {
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[tag] || tag
  );
}
