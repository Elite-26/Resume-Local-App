export type RichSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type RichParagraph = RichSegment[];

/** Decode common HTML entities after tag stripping. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * Convert ChatGPT-style <strong data-start=…> and normal strong/b/em/i
 * (with or without attributes) into simple <b>/<i>. Paired tags are
 * preserved; orphan opens stay as <b>/<i> (bold/italic through end of line).
 */
export function normalizeInlineFormatTags(raw: string): string {
  let s = raw;

  // Collapse properly closed pairs first (handles attributes on the open tag).
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

  // Remaining opens/closes (including ChatGPT annotation tags without closes).
  s = s.replace(/<\s*(?:strong|b)\b[^>]*>/gi, '<b>');
  s = s.replace(/<\s*\/\s*(?:strong|b)\s*>/gi, '</b>');
  s = s.replace(/<\s*(?:em|i)\b[^>]*>/gi, '<i>');
  s = s.replace(/<\s*\/\s*(?:em|i)\s*>/gi, '</i>');

  // Auto-close unclosed <b>/<i> before the next open of the same kind, and at EOL-ish via parseInlineMarkup.
  s = balanceOrphanInlineOpens(s);
  return s;
}

/** Insert </b> or </i> before a new open when a previous open was never closed. */
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
 * Normalize pasted / rich-editor HTML into line-oriented markup that keeps
 * only <b>/<i> inline tags. Empty lines are removed.
 */
export function normalizeResumeMarkup(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Decode escaped tags that sometimes appear when copying as plain text
  if (/&lt;\s*\/?\s*(?:strong|b|em|i)\b/i.test(s)) {
    s = s
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"');
  }

  if (/<\/?[a-z][\s\S]*>/i.test(s)) {
    s = s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<(div|p|li|h[1-6]|tr)[^>]*>/gi, '')
      .replace(/<\/?(ul|ol|table|tbody|thead|span|font)[^>]*>/gi, '');

    s = normalizeInlineFormatTags(s);
    // Drop any remaining non b/i tags
    s = s.replace(/<\/?(?!\/?[bi]\b)[a-zA-Z][^>]*>/g, '');
  }

  // Close bold/italic at each line end so a later line does not stay bold.
  s = s
    .split('\n')
    .map((line) => {
      let L = line.replace(/[ \t]+$/g, '');
      const bOpen = (L.match(/<b>/gi) || []).length;
      const bClose = (L.match(/<\/b>/gi) || []).length;
      const iOpen = (L.match(/<i>/gi) || []).length;
      const iClose = (L.match(/<\/i>/gi) || []).length;
      if (bOpen > bClose) L += '</b>'.repeat(bOpen - bClose);
      if (iOpen > iClose) L += '</i>'.repeat(iOpen - iClose);
      return L;
    })
    .filter((line) => stripInlineTags(line).trim() !== '')
    .join('\n');

  return decodeEntities(s).trim();
}

/** Strip inline tags for heading / section matching. */
export function stripInlineTags(s: string): string {
  return s.replace(/<\/?[bi]\b[^>]*>/gi, '');
}

export function parseInlineMarkup(line: string): RichSegment[] {
  const segments: RichSegment[] = [];
  let bold = false;
  let italic = false;
  let i = 0;
  let buf = '';

  const flush = () => {
    if (!buf) return;
    segments.push({
      text: buf,
      ...(bold ? { bold: true } : {}),
      ...(italic ? { italic: true } : {}),
    });
    buf = '';
  };

  while (i < line.length) {
    const rest = line.slice(i);
    const openB = rest.match(/^<\s*(?:strong|b)\b[^>]*>/i);
    const closeB = rest.match(/^<\s*\/\s*(?:strong|b)\s*>/i);
    const openI = rest.match(/^<\s*(?:em|i)\b[^>]*>/i);
    const closeI = rest.match(/^<\s*\/\s*(?:em|i)\s*>/i);

    if (openB) {
      flush();
      bold = true;
      i += openB[0].length;
      continue;
    }
    if (closeB) {
      flush();
      bold = false;
      i += closeB[0].length;
      continue;
    }
    if (openI) {
      flush();
      italic = true;
      i += openI[0].length;
      continue;
    }
    if (closeI) {
      flush();
      italic = false;
      i += closeI[0].length;
      continue;
    }

    buf += line[i];
    i += 1;
  }
  flush();
  return segments.length ? segments : [{ text: '' }];
}

export function markupToParagraphs(markup: string): RichParagraph[] {
  const lines = markup.replace(/\r\n/g, '\n').split('\n');
  return lines.map((line) => parseInlineMarkup(line));
}

export function plainTextFromMarkup(markup: string): string {
  return stripInlineTags(markup);
}

function serializeSegments(segs: RichSegment[]): string {
  return segs
    .map((s) => {
      let t = s.text;
      if (s.italic) t = `<i>${t}</i>`;
      if (s.bold) t = `<b>${t}</b>`;
      return t;
    })
    .join('');
}

/** Bold text through the first ":" (category head) on a skill line. */
export function boldCategoryHeadSegments(segs: RichSegment[]): RichSegment[] {
  const plain = segs.map((s) => s.text).join('');
  const colon = plain.indexOf(':');
  if (colon <= 0) return segs;

  const headEnd = colon + 1;
  const result: RichSegment[] = [];
  let pos = 0;
  for (const seg of segs) {
    const start = pos;
    const end = pos + seg.text.length;
    if (end <= headEnd) {
      result.push({ text: seg.text, bold: true, ...(seg.italic ? { italic: true } : {}) });
    } else if (start >= headEnd) {
      result.push(seg);
    } else {
      const headPart = seg.text.slice(0, headEnd - start);
      const restPart = seg.text.slice(headEnd - start);
      if (headPart) {
        result.push({
          text: headPart,
          bold: true,
          ...(seg.italic ? { italic: true } : {}),
        });
      }
      if (restPart) {
        result.push({
          text: restPart,
          ...(seg.bold ? { bold: true } : {}),
          ...(seg.italic ? { italic: true } : {}),
        });
      }
    }
    pos = end;
  }
  return result;
}

/**
 * Skill lines look like "Category: items…". Force every category head
 * (text through the first ":") to bold, including the first line.
 */
export function boldSkillCategoryHeads(markup: string): string {
  if (!markup?.trim()) return markup || '';
  return markup
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const bullet = line.match(/^\s*[-•*◦▪▸➤]+\s*/)?.[0] || '';
      const body = line.slice(bullet.length);
      const segs = boldCategoryHeadSegments(parseInlineMarkup(body));
      return bullet + serializeSegments(segs);
    })
    .join('\n');
}


