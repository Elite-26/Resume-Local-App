import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  id?: string;
  removable?: boolean;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Compact trigger for table cells / dense forms */
  size?: 'md' | 'sm';
  id?: string;
  'aria-label'?: string;
  name?: string;
  /** Draw the menu in a portal so it is not clipped by a scrolling table. */
  portal?: boolean;
  clearable?: boolean;
  renderValue?: (option: SelectOption) => ReactNode;
  renderOption?: (option: SelectOption) => ReactNode;
  onCreate?: (label: string) => Promise<void> | void;
  onRemove?: (option: SelectOption) => void;
};

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className = '',
  size = 'md',
  id,
  'aria-label': ariaLabel,
  name,
  portal = false,
  clearable = false,
  renderValue,
  renderOption,
  onCreate,
  onRemove,
}: SelectProps) {
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [box, setBox] = useState({ top: 0, left: 0, width: 220, openUp: false });

  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);
  const enabledOptions = useMemo(
    () => shown.filter((o) => !o.disabled),
    [shown]
  );

  function placeMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, onCreate ? 240 : rect.width);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > spaceBelow;
    setBox({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left,
      width,
      openUp,
    });
  }

  useEffect(() => {
    if (!open) return;

    function onDocPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((prev) => {
          const list = enabledOptions;
          if (!list.length) return -1;
          if (prev < 0) {
            const currentIdx = list.findIndex((o) => o.value === value);
            return currentIdx >= 0 ? currentIdx : 0;
          }
          const delta = e.key === 'ArrowDown' ? 1 : -1;
          return (prev + delta + list.length) % list.length;
        });
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        if (highlight >= 0 && enabledOptions[highlight]) {
          onChange(enabledOptions[highlight].value);
          setOpen(false);
        }
      }
    }

    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    function onScroll() {
      if (portal) setOpen(false);
    }
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, enabledOptions, highlight, onChange, value, portal]);

  useEffect(() => {
    if (!open) {
      setHighlight(-1);
      setQuery('');
      setCreateError('');
      return;
    }
    const idx = enabledOptions.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : enabledOptions.length ? 0 : -1);
  }, [open, value, enabledOptions]);

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    const label = query.trim();
    if (!label || !onCreate) return;
    const exact = options.find((option) => option.label.toLowerCase() === label.toLowerCase());
    if (exact) {
      onChange(exact.value);
      setOpen(false);
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await onCreate(label);
      setOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not add option');
    } finally {
      setCreating(false);
    }
  }

  const triggerPad = size === 'sm' ? '!py-1.5 !px-2.5 text-sm' : '';

  const menu = (
    <div
      ref={menuRef}
      style={
        portal
          ? {
              position: 'fixed',
              top: box.top,
              left: box.left,
              width: box.width,
              transform: box.openUp ? 'translateY(-100%)' : undefined,
              zIndex: 80,
            }
          : undefined
      }
      className={`flex max-h-[min(18rem,50vh)] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-panel-dark ${
        portal ? '' : 'absolute z-50 mt-1.5 w-full'
      }`}
    >
      <ul
        id={listboxId}
        role="listbox"
        aria-activedescendant={highlight >= 0 ? `${listboxId}-opt-${highlight}` : undefined}
        className="overflow-auto py-1"
      >
        {clearable && (
          <li
            className="cursor-pointer px-3.5 py-2 text-sm text-muted hover:bg-black/5 dark:hover:bg-white/5"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            Clear
          </li>
        )}
        {shown.length === 0 ? (
          <li className="px-3.5 py-2 text-sm text-muted">No options</li>
        ) : (
          shown.map((opt) => {
            const enabledIdx = enabledOptions.findIndex((o) => o.value === opt.value);
            const isSelected = opt.value === value;
            const isHighlighted = enabledIdx === highlight;
            return (
              <li
                key={opt.value === '' ? `__empty-${opt.label}` : opt.value}
                id={enabledIdx >= 0 ? `${listboxId}-opt-${enabledIdx}` : undefined}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                className={`flex flex-row flex-nowrap items-center justify-between gap-2 px-3.5 py-2 text-sm ${
                  opt.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                } ${
                  isHighlighted && !opt.disabled
                    ? 'bg-sage/15 text-sage dark:text-leaf'
                    : ''
                } ${isSelected && !isHighlighted ? 'bg-black/[0.03] dark:bg-white/5' : ''}`}
                onMouseEnter={() => {
                  if (!opt.disabled && enabledIdx >= 0) setHighlight(enabledIdx);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">
                  {renderOption ? renderOption(opt) : opt.label}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {isSelected && <Check size={14} className="text-sage" />}
                  {onRemove && (
                    <button
                      type="button"
                      className="rounded p-1 text-muted hover:bg-black/5 hover:text-ember"
                      aria-label={`Remove ${opt.label}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemove(opt);
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              </li>
            );
          })
        )}
      </ul>
      {onCreate && (
        <form
          onSubmit={submitCreate}
          className="flex gap-1 border-t border-black/10 p-1.5 dark:border-white/10"
        >
          <input
            className="input !px-2 !py-1"
            value={query}
            placeholder="Add label"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className="btn-primary !px-2.5 !py-1" disabled={creating || !query.trim()}>
            Add
          </button>
        </form>
      )}
      {createError && <p className="px-2 pb-1.5 text-xs text-ember">{createError}</p>}
    </div>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        className={`input flex flex-row flex-nowrap items-center justify-between gap-2 text-left cursor-pointer ${triggerPad} ${
          open ? 'border-sage ring-2 ring-sage/20' : ''
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        onClick={() => {
          if (disabled) return;
          if (!open && portal) placeMenu();
          setOpen((current) => !current);
        }}
      >
        <span className="flex min-w-0 flex-1 items-center">
          {selected && renderValue ? (
            renderValue(selected)
          ) : (
            <span className={`truncate ${selected ? '' : 'text-muted/70'}`}>
              {selected?.label || placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          size={size === 'sm' ? 14 : 16}
          className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (portal ? createPortal(menu, document.body) : menu)}
    </div>
  );
}
