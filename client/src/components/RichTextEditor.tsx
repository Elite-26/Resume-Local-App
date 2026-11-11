import { useEffect, useRef, type ClipboardEvent } from 'react';
import { cleanClipboardResumeContent } from '../lib/resumeContent';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Lightweight rich-text area that preserves bold/italic from pasted content.
 * Paste strips empty line breaks so the editor matches server analysis.
 */
export function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const ready = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!ready.current) {
      el.innerHTML = value || '';
      lastEmitted.current = value;
      ready.current = true;
      return;
    }
    if (value !== lastEmitted.current) {
      el.innerHTML = value || '';
      lastEmitted.current = value;
    }
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML === '<br>' ? '' : el.innerHTML;
    lastEmitted.current = html;
    onChange(html);
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    const cleaned = cleanClipboardResumeContent(html, plain);
    if (!cleaned) return;

    const el = ref.current;
    el?.focus();
    document.execCommand('insertHTML', false, cleaned);
    emit();
  }

  const showPlaceholder = !value || value === '<br>';

  return (
    <div className={`flex flex-col min-h-0 ${className || ''}`}>
      <div className="relative flex-1 flex flex-col min-h-0">
        {showPlaceholder && placeholder && (
          <div
            className="pointer-events-none absolute inset-0 input font-mono text-xs leading-relaxed text-muted/70 whitespace-pre-wrap overflow-hidden"
            aria-hidden
          >
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          className="input flex-1 min-h-0 h-full font-mono text-xs leading-relaxed overflow-auto whitespace-pre-wrap relative bg-transparent"
          contentEditable
          role="textbox"
          aria-multiline
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
        />
      </div>
    </div>
  );
}
