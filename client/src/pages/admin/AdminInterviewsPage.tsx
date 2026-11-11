import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Select, type SelectOption } from '../../components/Select';
import {
  api,
  type InterviewField,
  type InterviewOption,
  type InterviewOptions,
  type InterviewProcess,
  type InterviewStep,
} from '../../lib/api';

const LABEL_COLORS = [
  { bg: '#d3e3fd', text: '#174ea6' },
  { bg: '#ceead6', text: '#0d652d' },
  { bg: '#fef7e0', text: '#7a4f01' },
  { bg: '#fce8e6', text: '#a50e0e' },
  { bg: '#e9d2fd', text: '#681da8' },
  { bg: '#d0f0f7', text: '#0b6e75' },
  { bg: '#fde2c8', text: '#b85c00' },
  { bg: '#e8eaed', text: '#3c4043' },
  { bg: '#fad2e1', text: '#9c0d4a' },
  { bg: '#d8f3dc', text: '#1b5e20' },
];

const STEP_FIELDS = [
  { key: 'type', label: 'Type', width: 'min-w-[9rem]' },
  { key: 'method', label: 'Method', width: 'w-[7rem] min-w-[7rem]' },
  { key: 'interviewer', label: 'Interviewer', width: 'min-w-[9rem]' },
  { key: 'date', label: 'Date', width: 'w-[8rem] min-w-[8rem]' },
  { key: 'status', label: 'Status', width: 'w-[7rem] min-w-[7rem]' },
] as const;

const emptyOptions = (): InterviewOptions => ({
  profile: [],
  interviewee: [],
  type: [],
  method: [],
  status: [],
  result: [],
});

function emptyStep(): InterviewStep {
  return { type: '', method: '', interviewer: '', date: '', status: '' };
}

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function labelStyle(colorIndex: number) {
  const index = ((colorIndex % LABEL_COLORS.length) + LABEL_COLORS.length) % LABEL_COLORS.length;
  return LABEL_COLORS[index];
}

function styleFor(label: string, options: InterviewOption[]) {
  const match = options.find((option) => option.label.toLowerCase() === label.toLowerCase());
  if (match) return labelStyle(match.colorIndex);
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return labelStyle(hash);
}

function LabelChip({ label, options }: { label: string; options: InterviewOption[] }) {
  const style = styleFor(label, options);
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-xs font-medium leading-4"
      style={{ background: style.bg, color: style.text }}
    >
      {label}
    </span>
  );
}

function LabelCell({
  value,
  options,
  onChange,
  onAdd,
  onRemove,
}: {
  value: string;
  options: InterviewOption[];
  onChange: (value: string) => void;
  onAdd: (label: string) => Promise<string>;
  onRemove: (label: string) => Promise<void>;
}) {
  const selectOptions = useMemo<SelectOption[]>(
    () =>
      options.map((option) => ({
        value: option.label,
        label: option.label,
        id: option.id || undefined,
        removable: true,
      })),
    [options]
  );

  return (
    <Select
      size="sm"
      portal
      clearable
      placeholder="Select"
      value={value}
      onChange={onChange}
      options={selectOptions}
      renderValue={(option) => <LabelChip label={option.label} options={options} />}
      renderOption={(option) => <LabelChip label={option.label} options={options} />}
      onCreate={async (label) => {
        const saved = await onAdd(label);
        onChange(saved);
      }}
      onRemove={(option) => {
        if (!window.confirm(`Remove "${option.label}"?`)) return;
        void onRemove(option.label);
      }}
    />
  );
}

const th = 'px-3 py-3 whitespace-nowrap border-b border-black/5 dark:border-white/10';
const td = 'px-3 py-2 align-top border-b border-black/5 dark:border-white/10';
const textInput = 'input !px-2 !py-1.5';
const stepEdge = 'border-l border-black/5 dark:border-white/10';
const pinHead = 'sticky bg-[#f7f4ee] dark:bg-[#182922]';
const pinCell = 'sticky bg-white dark:bg-panel-dark';
const pinLeft = 'z-20';
const pinRight = 'z-10';
const pinHeadLeft = 'z-40';
const pinHeadRight = 'z-40';
const headRow1 = 'top-0';
const headRow2 = 'top-[var(--interview-head)]';
const headShadow = 'shadow-[0_4px_8px_-6px_rgba(15,28,24,0.45)]';
const headShadeLeft = 'shadow-[4px_4px_8px_-6px_rgba(15,28,24,0.45)]';
const headShadeRight = 'shadow-[-4px_4px_8px_-6px_rgba(15,28,24,0.45)]';
const pinShadeLeft = 'shadow-[4px_0_8px_-6px_rgba(15,28,24,0.45)]';
const pinShadeRight = 'shadow-[-4px_0_8px_-6px_rgba(15,28,24,0.45)]';
const colNo = 'left-0 w-12 min-w-12 max-w-12';
const colProfile = 'left-12 w-[9rem] min-w-[9rem] max-w-[9rem]';
const colDeveloper = 'left-[12rem] w-[9rem] min-w-[9rem] max-w-[9rem]';
const colCompany = 'left-[21rem] w-[9rem] min-w-[9rem] max-w-[9rem]';
const colPosition = 'left-[30rem] w-[9rem] min-w-[9rem] max-w-[9rem]';
const colResult = 'right-[19.5rem] w-[9rem] min-w-[9rem] max-w-[9rem]';
const colNote = 'right-[7.5rem] w-[12rem] min-w-[12rem] max-w-[12rem]';
const colActions = 'right-0 w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem]';

export function AdminInterviewsPage() {
  const [rows, setRows] = useState<InterviewProcess[]>([]);
  const [options, setOptions] = useState<InterviewOptions>(emptyOptions);
  const [floor, setFloor] = useState(1);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingRow, setAddingRow] = useState(false);
  const rowsRef = useRef<InterviewProcess[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const headRowRef = useRef<HTMLTableRowElement>(null);
  const [headRowHeight, setHeadRowHeight] = useState(48);
  const timers = useRef<Map<string, number>>(new Map());
  const desired = useRef<Map<string, InterviewProcess>>(new Map());
  const tails = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const columnCount = Math.max(
    rows.length === 0 ? floor : 1,
    rows.reduce((max, row) => Math.max(max, row.steps.length), 0)
  );

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const headRow = headRowRef.current;
    if (!scroller) return;

    const fit = () => {
      const top = scroller.getBoundingClientRect().top;
      scroller.style.maxHeight = `${Math.max(280, window.innerHeight - top - 40)}px`;
      if (headRow) setHeadRowHeight(headRow.getBoundingClientRect().height);
    };

    fit();
    const observer = new ResizeObserver(fit);
    if (headRow) observer.observe(headRow);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [loading, error, columnCount]);

  async function load() {
    const board = await api.adminInterviews();
    rowsRef.current = board.processes;
    setRows(board.processes);
    setOptions(board.options);
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load interviews'))
      .finally(() => setLoading(false));
    return () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
    };
  }, []);

  function kick(id: string) {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    const prev = tails.current.get(id) || Promise.resolve();
    const run = prev.catch(() => undefined).then(async () => {
      const row = desired.current.get(id);
      if (!row) return;
      desired.current.delete(id);
      setStatus('Saving…');
      try {
        await api.adminUpdateInterview(id, row);
        if (!desired.current.has(id)) {
          setStatus('Saved');
          setError('');
        }
      } catch (err) {
        if (!rowsRef.current.some((item) => item.id === id)) return;
        setStatus('');
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    });
    tails.current.set(id, run);
    return run;
  }

  function flush(id: string) {
    if (!desired.current.has(id)) return;
    void kick(id);
  }

  function queueSave(row: InterviewProcess) {
    desired.current.set(row.id, row);
    const existing = timers.current.get(row.id);
    if (existing) window.clearTimeout(existing);
    timers.current.set(
      row.id,
      window.setTimeout(() => flush(row.id), 450)
    );
  }

  function patchRow(id: string, updater: (row: InterviewProcess) => InterviewProcess) {
    const next = rowsRef.current.map((row) => (row.id === id ? updater(row) : row));
    rowsRef.current = next;
    setRows(next);
    const updated = next.find((row) => row.id === id);
    if (updated) queueSave(updated);
  }

  async function saveAll(next: InterviewProcess[]) {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
    rowsRef.current = next;
    setRows(next);
    await Promise.all(
      next.map((row) => {
        desired.current.set(row.id, row);
        return kick(row.id);
      })
    );
  }

  function addStep() {
    if (rowsRef.current.length === 0) {
      setFloor((current) => Math.min(20, Math.max(current, columnCount) + 1));
      return;
    }
    const nextCount = Math.min(20, columnCount + 1);
    if (nextCount === columnCount) return;
    const next = rowsRef.current.map((row) => {
      const steps = row.steps.slice();
      while (steps.length < nextCount) steps.push(emptyStep());
      return { ...row, steps };
    });
    void saveAll(next);
  }

  function removeStep() {
    if (columnCount <= 1) return;
    const lastIndex = columnCount - 1;
    const hasData = rowsRef.current.some((row) => {
      const step = row.steps[lastIndex];
      return step && (step.type || step.method || step.interviewer || step.date || step.status);
    });
    if (hasData && !window.confirm('Remove the last step from every row?')) return;
    if (rowsRef.current.length === 0) {
      setFloor((current) => Math.max(1, current - 1));
      return;
    }
    const next = rowsRef.current.map((row) =>
      row.steps.length >= columnCount ? { ...row, steps: row.steps.slice(0, -1) } : row
    );
    void saveAll(next);
  }

  async function addRow() {
    setAddingRow(true);
    setError('');
    try {
      const steps = Array.from({ length: columnCount }, () => emptyStep());
      const { process } = await api.adminCreateInterview({
        profile: '',
        developer: '',
        company: '',
        position: '',
        result: '',
        note: '',
        steps,
      });
      const next = [...rowsRef.current, process];
      rowsRef.current = next;
      setRows(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add a row');
    } finally {
      setAddingRow(false);
    }
  }

  async function removeRow(row: InterviewProcess) {
    if (!window.confirm('Delete this interview row?')) return;
    setError('');
    try {
      await api.adminDeleteInterview(row.id);
      const timer = timers.current.get(row.id);
      if (timer) window.clearTimeout(timer);
      timers.current.delete(row.id);
      desired.current.delete(row.id);
      const next = rowsRef.current.filter((item) => item.id !== row.id);
      rowsRef.current = next;
      setRows(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function addOption(field: InterviewField, label: string) {
    const { option } = await api.adminCreateInterviewOption({ field, label });
    setOptions((current) => {
      const list = current[field].filter(
        (item) => item.label.toLowerCase() !== option.label.toLowerCase()
      );
      const next = [...list, option];
      if (field === 'profile' || field === 'interviewee') {
        next.sort((a, b) => a.label.localeCompare(b.label));
      }
      return { ...current, [field]: next };
    });
    return option.label;
  }

  async function removeOption(field: InterviewField, label: string) {
    await api.adminRemoveInterviewOption(field, label);
    setOptions((current) => ({
      ...current,
      [field]: current[field].filter(
        (option) => option.label.toLowerCase() !== label.toLowerCase()
      ),
    }));
  }

  function updateStep(rowId: string, index: number, patch: Partial<InterviewStep>) {
    patchRow(rowId, (row) => {
      const steps = row.steps.slice();
      while (steps.length <= index) steps.push(emptyStep());
      steps[index] = { ...steps[index], ...patch };
      return { ...row, steps };
    });
  }

  const stepNumbers = Array.from({ length: columnCount }, (_, index) => index);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Interview process</h1>
          <p className="text-sm text-muted mt-1">
            One row per process. Profile, developer (the interviewee), type, method, status, and result are labels you can pick or add. Steps start at 1st.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {status && <span className="text-xs text-muted">{status}</span>}
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => void addRow()} disabled={addingRow}>
            Add row
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>}

      <div className="surface overflow-hidden">
        <div ref={scrollerRef} className="table-scroll max-h-[70dvh] !overflow-auto">
        <table className="data-table w-max min-w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            <col className="w-12" />
            <col className="w-[9rem]" />
            <col className="w-[9rem]" />
            <col className="w-[9rem]" />
            <col className="w-[9rem]" />
            {stepNumbers.flatMap((index) => [
              <col key={`${index}-type`} className="w-[9rem]" />,
              <col key={`${index}-method`} className="w-[7rem]" />,
              <col key={`${index}-interviewer`} className="w-[9rem]" />,
              <col key={`${index}-date`} className="w-[8rem]" />,
              <col key={`${index}-status`} className="w-[7rem]" />,
            ])}
            <col className="w-[9rem]" />
            <col className="w-[12rem]" />
            <col className="w-[7.5rem]" />
          </colgroup>
          <thead
            className="bg-[#f7f4ee] text-left text-xs uppercase text-muted dark:bg-[#182922]"
            style={{ '--interview-head': `${headRowHeight}px` } as CSSProperties}
          >
            <tr ref={headRowRef}>
              <th className={`${th} ${pinHead} ${pinHeadLeft} ${headRow1} ${colNo}`} />
              <th className={`${th} ${pinHead} ${pinHeadLeft} ${headRow1} ${pinShadeLeft} left-12`} colSpan={4} />
              {stepNumbers.map((index) => (
                <th
                  key={index}
                  colSpan={5}
                  className={`${th} ${stepEdge} sticky ${headRow1} z-30 bg-[#f7f4ee] text-center text-base font-semibold normal-case text-ink dark:bg-[#182922] dark:text-mist`}
                >
                  {ordinal(index + 1)}
                  {index === stepNumbers.length - 1 && (
                    <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                      {columnCount > 1 && (
                        <button
                          type="button"
                          className="btn-secondary !px-2 !py-1"
                          aria-label="Remove last step"
                          onClick={removeStep}
                        >
                          <Minus size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-primary !px-2 !py-1"
                        aria-label="Add step"
                        onClick={addStep}
                      >
                        <Plus size={14} />
                      </button>
                    </span>
                  )}
                </th>
              ))}
              <th className={`${th} ${pinHead} ${pinHeadRight} ${headRow1} ${pinShadeRight} right-[7.5rem]`} colSpan={2} />
              <th className={`${th} ${pinHead} ${pinHeadRight} ${headRow1} ${colActions}`} />
            </tr>
            <tr>
              <th className={`${th} ${pinHead} ${pinHeadLeft} ${headRow2} ${headShadow} ${colNo} text-center`}>#</th>
              <th className={`${th} ${pinHead} ${pinHeadLeft} ${headRow2} ${headShadow} ${colProfile}`}>Profile</th>
              <th className={`${th} ${pinHead} ${pinHeadLeft} ${headRow2} ${headShadow} ${colDeveloper}`} title="Interviewee">
                Developer
              </th>
              <th className={`${th} ${pinHead} ${pinHeadLeft} ${headRow2} ${headShadow} ${colCompany}`}>Company</th>
              <th className={`${th} ${pinHead} ${pinHeadLeft} ${headRow2} ${headShadeLeft} ${colPosition}`}>Position</th>
              {stepNumbers.map((index) =>
                STEP_FIELDS.map((field) => (
                  <th
                    key={`${index}-${field.key}`}
                    className={`${th} ${field.width} sticky ${headRow2} ${headShadow} z-30 bg-[#f7f4ee] dark:bg-[#182922] ${field.key === 'type' ? stepEdge : ''}`}
                  >
                    {field.label}
                  </th>
                ))
              )}
              <th className={`${th} ${pinHead} ${pinHeadRight} ${headRow2} ${headShadeRight} ${colResult}`}>Result</th>
              <th className={`${th} ${pinHead} ${pinHeadRight} ${headRow2} ${headShadow} ${colNote}`}>Note</th>
              <th className={`${th} ${pinHead} ${pinHeadRight} ${headRow2} ${headShadow} ${colActions}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8 + columnCount * 5} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, rowIndex) => (
                <tr key={row.id}>
                  <td className={`${td} ${pinCell} ${pinLeft} ${colNo} text-center text-muted`}>{rowIndex + 1}</td>
                  <td className={`${td} ${pinCell} ${pinLeft} ${colProfile}`}>
                    <LabelCell
                      value={row.profile}
                      options={options.profile}
                      onChange={(profile) => patchRow(row.id, (current) => ({ ...current, profile }))}
                      onAdd={(label) => addOption('profile', label)}
                      onRemove={(id) => removeOption('profile', id)}
                    />
                  </td>
                  <td className={`${td} ${pinCell} ${pinLeft} ${colDeveloper}`}>
                    <LabelCell
                      value={row.developer}
                      options={options.interviewee}
                      onChange={(developer) => patchRow(row.id, (current) => ({ ...current, developer }))}
                      onAdd={(label) => addOption('interviewee', label)}
                      onRemove={(id) => removeOption('interviewee', id)}
                    />
                  </td>
                  <td className={`${td} ${pinCell} ${pinLeft} ${colCompany}`}>
                    <input
                      className={textInput}
                      value={row.company}
                      aria-label="Company"
                      onChange={(event) =>
                        patchRow(row.id, (current) => ({ ...current, company: event.target.value }))
                      }
                      onBlur={() => flush(row.id)}
                    />
                  </td>
                  <td className={`${td} ${pinCell} ${pinLeft} ${colPosition} ${pinShadeLeft}`}>
                    <input
                      className={textInput}
                      value={row.position}
                      aria-label="Position"
                      onChange={(event) =>
                        patchRow(row.id, (current) => ({ ...current, position: event.target.value }))
                      }
                      onBlur={() => flush(row.id)}
                    />
                  </td>
                  {stepNumbers.map((index) => {
                    const step = row.steps[index] || emptyStep();
                    return (
                      <StepCells
                        key={`${row.id}-${index}`}
                        step={step}
                        options={options}
                        onPatch={(patch) => updateStep(row.id, index, patch)}
                        onBlur={() => flush(row.id)}
                        onAdd={addOption}
                        onRemove={removeOption}
                      />
                    );
                  })}
                  <td className={`${td} ${pinCell} ${pinRight} ${colResult} ${pinShadeRight}`}>
                    <LabelCell
                      value={row.result}
                      options={options.result}
                      onChange={(result) => patchRow(row.id, (current) => ({ ...current, result }))}
                      onAdd={(label) => addOption('result', label)}
                      onRemove={(id) => removeOption('result', id)}
                    />
                  </td>
                  <td className={`${td} ${pinCell} ${pinRight} ${colNote}`}>
                    <input
                      className={textInput}
                      value={row.note}
                      aria-label="Note"
                      title={row.note}
                      onChange={(event) =>
                        patchRow(row.id, (current) => ({ ...current, note: event.target.value }))
                      }
                      onBlur={() => flush(row.id)}
                    />
                  </td>
                  <td className={`${td} ${pinCell} ${pinRight} ${colActions} whitespace-nowrap`}>
                    <button
                      type="button"
                      className="btn-danger !px-3 !py-1.5"
                      onClick={() => void removeRow(row)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && (
              <tr>
                <td colSpan={8 + columnCount * 5} className="px-3 py-3">
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-muted"
                    onClick={() => void addRow()}
                    disabled={addingRow}
                  >
                    <Plus size={14} />
                    Add row
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function StepCells({
  step,
  options,
  onPatch,
  onBlur,
  onAdd,
  onRemove,
}: {
  step: InterviewStep;
  options: InterviewOptions;
  onPatch: (patch: Partial<InterviewStep>) => void;
  onBlur: () => void;
  onAdd: (field: InterviewField, label: string) => Promise<string>;
  onRemove: (field: InterviewField, label: string) => Promise<void>;
}) {
  return (
    <>
      <td className={`${td} min-w-[9rem] ${stepEdge}`}>
        <LabelCell
          value={step.type}
          options={options.type}
          onChange={(type) => onPatch({ type })}
          onAdd={(label) => onAdd('type', label)}
          onRemove={(id) => onRemove('type', id)}
        />
      </td>
      <td className={`${td} ${STEP_FIELDS[1].width}`}>
        <LabelCell
          value={step.method}
          options={options.method}
          onChange={(method) => onPatch({ method })}
          onAdd={(label) => onAdd('method', label)}
          onRemove={(id) => onRemove('method', id)}
        />
      </td>
      <td className={`${td} min-w-[9rem]`}>
        <input
          className={textInput}
          value={step.interviewer}
          aria-label="Interviewer"
          onChange={(event) => onPatch({ interviewer: event.target.value })}
          onBlur={onBlur}
        />
      </td>
      <td className={`${td} ${STEP_FIELDS[3].width}`}>
        <input
          type="date"
          className={`${textInput} !min-w-0 !w-full !max-w-full dark:[color-scheme:dark]`}
          value={step.date}
          aria-label="Interview date"
          onChange={(event) => onPatch({ date: event.target.value })}
          onBlur={onBlur}
        />
      </td>
      <td className={`${td} ${STEP_FIELDS[4].width}`}>
        <LabelCell
          value={step.status}
          options={options.status}
          onChange={(status) => onPatch({ status })}
          onAdd={(label) => onAdd('status', label)}
          onRemove={(id) => onRemove('status', id)}
        />
      </td>
    </>
  );
}
