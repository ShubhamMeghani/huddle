'use client';
import { useState } from 'react';
import type { SettingsSpec } from '@/games/settings';

/** Number input that only commits (clamped) on blur or Enter, so typing isn't fought mid-entry. */
function IntField(p: { id: string; label: string; min: number; max: number; value: number; disabled?: boolean; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft == null) return;
    const n = Math.max(p.min, Math.min(p.max, Math.round(Number(draft)) || p.min));
    setDraft(null);
    if (n !== p.value) p.onCommit(n);
  };
  return (
    <label htmlFor={p.id} className="flex items-center justify-between gap-3 font-bold">
      <span>{p.label}</span>
      <input
        id={p.id}
        type="number"
        inputMode="numeric"
        className="input !min-h-12 !w-24 text-center"
        min={p.min}
        max={p.max}
        value={draft ?? String(p.value)}
        disabled={p.disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        data-testid={p.id}
      />
    </label>
  );
}

export function SettingsForm({
  spec,
  value,
  onChange,
  disabled,
  testMode,
  idPrefix,
}: {
  spec: SettingsSpec;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  disabled?: boolean;
  testMode?: boolean;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(spec).map(([key, f]) => {
        const id = `${idPrefix}-${key}`;
        const v = value[key] ?? f.default;
        if (f.type === 'int') {
          const min = testMode && f.testMin !== undefined ? f.testMin : f.min;
          return (
            <IntField
              key={key}
              id={id}
              label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}
              min={min}
              max={f.max}
              value={Number(v)}
              disabled={disabled}
              onCommit={(n) => onChange({ ...value, [key]: n })}
            />
          );
        }
        if (f.type === 'bool') {
          return (
            <label key={key} htmlFor={id} className="flex min-h-12 items-center justify-between gap-3 font-bold">
              <span>{f.label}</span>
              <input
                id={id}
                type="checkbox"
                className="h-7 w-7 accent-[var(--accent)]"
                checked={Boolean(v)}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
                data-testid={id}
              />
            </label>
          );
        }
        if (f.type === 'enum') {
          return (
            <label key={key} htmlFor={id} className="flex items-center justify-between gap-3 font-bold">
              <span>{f.label}</span>
              <select
                id={id}
                className="input !min-h-12 !w-auto"
                value={String(v)}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                data-testid={id}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        const selected = (v as string[]) ?? [];
        return (
          <fieldset key={key} className="flex flex-col gap-2">
            <legend className="mb-1 font-bold">{f.label}</legend>
            <div className="flex flex-wrap gap-2">
              {f.options.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={disabled}
                    aria-pressed={on}
                    className={`btn !min-h-11 !px-3 text-sm ${on ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                      const next = on ? selected.filter((x) => x !== o.value) : [...selected, o.value];
                      if (next.length >= (f.minSelected ?? 1)) onChange({ ...value, [key]: next });
                    }}
                    data-testid={`${id}-${o.value}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
