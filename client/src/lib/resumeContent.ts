/** Strip tags for emptiness checks (keeps logic aligned with server parsing). */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
}

/**
 * Remove blank lines from plain or lightly-marked resume text.
 * Collapses runs of empty line breaks into nothing (single newlines between content).
 */
export function collapseEmptyBreaks(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .filter((line) => stripTags(line) !== '')
    .join('\n');
}

/**
 * Convert ChatGPT-style <strong data-start=…> and normal strong/b/em/i
 * into simple <b>/<i> for the contentEditable editor.
 */
function normalizeInlineFormatTags(raw: string): string {
  let s = raw;

  for (let n = 0; n < 30; n++) {
    const next = s
      .replace(
        /<\s*(?:strong|b)\b[^>]*>([\s\S]*?)<\s*\/\s*(?:strong|b)\s*>/gi,
        '<b>$1</b>'
      )
      .replace(
        /<\s*(?:em|i)\b[^>]*>([\s\S]*?)<\s*\/\s*(?:em|i)\s*>/gi,
        '<i>$1</i>'
      );
    if (next === s) break;
    s = next;
  }

  s = s.replace(/<\s*(?:strong|b)\b[^>]*>/gi, '<b>');
  s = s.replace(/<\s*\/\s*(?:strong|b)\s*>/gi, '</b>');
  s = s.replace(/<\s*(?:em|i)\b[^>]*>/gi, '<i>');
  s = s.replace(/<\s*\/\s*(?:em|i)\s*>/gi, '</i>');

  return balanceOrphanInlineOpens(s);
}

function balanceOrphanInlineOpens(s: string): string {
  let out = '';
  let bold = false;
  let italic = false;
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const openB = rest.match(/^<\s*b\s*>/i);
    const closeB = rest.match(/^<\s*\/\s*b\s*>/i);
    const openI = rest.match(/^<\s*i\s*>/i);
    const closeI = rest.match(/^<\s*\/\s*i\s*>/i);
    if (openB) {
      if (bold) out += '</b>';
      out += '<b>';
      bold = true;
      i += openB[0].length;
      continue;
    }
    if (closeB) {
      if (bold) out += '</b>';
      bold = false;
      i += closeB[0].length;
      continue;
    }
    if (openI) {
      if (italic) out += '</i>';
      out += '<i>';
      italic = true;
      i += openI[0].length;
      continue;
    }
    if (closeI) {
      if (italic) out += '</i>';
      italic = false;
      i += closeI[0].length;
      continue;
    }
    out += s[i];
    i += 1;
  }
  if (bold) out += '</b>';
  if (italic) out += '</i>';
  return out;
}

/**
 * Turn pasted HTML into contentEditable-friendly markup without empty lines,
 * preserving bold/italic only.
 */
export function cleanPastedResumeHtml(html: string): string {
  let s = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (/&lt;\s*\/?\s*(?:strong|b|em|i)\b/i.test(s)) {
    s = s
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"');
  }

  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<(div|p|li|h[1-6]|tr)[^>]*>/gi, '')
    .replace(/<\/?(ul|ol|table|tbody|thead|span|font|meta|style|html|body|head)[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  s = normalizeInlineFormatTags(s);
  s = s.replace(/<\/?(?!\/?[bi]\b)[a-zA-Z][^>]*>/g, '');
  s = s.replace(/&nbsp;/gi, ' ');

  const lines = collapseEmptyBreaks(s)
    .split('\n')
    .map((line) => {
      let L = line;
      const bOpen = (L.match(/<b>/gi) || []).length;
      const bClose = (L.match(/<\/b>/gi) || []).length;
      const iOpen = (L.match(/<i>/gi) || []).length;
      const iClose = (L.match(/<\/i>/gi) || []).length;
      if (bOpen > bClose) L += '</b>'.repeat(bOpen - bClose);
      if (iOpen > iClose) L += '</i>'.repeat(iOpen - iClose);
      return L;
    });
  if (!lines.length || (lines.length === 1 && !lines[0])) return '';
  return lines.map((line) => `<div>${line}</div>`).join('');
}

/** Prefer HTML clipboard; fall back to plain text. Always drops empty lines. */
export function cleanClipboardResumeContent(html: string, plain: string): string {
  const plainHasTags = /<\s*(?:strong|b|em|i)\b/i.test(plain || '');
  if (html?.trim()) {
    return cleanPastedResumeHtml(html);
  }
  if (plainHasTags) {
    return cleanPastedResumeHtml(plain);
  }
  const lines = collapseEmptyBreaks(plain || '');
  if (!lines) return '';
  return lines
    .split('\n')
    .map((line) => {
      const safe = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<div>${safe}</div>`;
    })
    .join('');
}
