/* House-rule settings specs (R29): defaults and validated ranges, shared by client forms and server. */
import { GameError } from '@/engine/types';

export type FieldSpec =
  | { type: 'int'; label: string; min: number; max: number; default: number; unit?: string; testMin?: number }
  | { type: 'enum'; label: string; options: { value: string; label: string }[]; default: string }
  | { type: 'bool'; label: string; default: boolean }
  | { type: 'multi'; label: string; options: { value: string; label: string }[]; default: string[]; minSelected?: number };

export type SettingsSpec = Record<string, FieldSpec>;

export function defaultsOf(spec: SettingsSpec): Record<string, unknown> {
  return Object.fromEntries(Object.entries(spec).map(([k, f]) => [k, f.default]));
}

/** Returns a complete, validated settings object or throws INVALID. Test mode allows short timers. */
export function validateSettings(spec: SettingsSpec, input: unknown, testMode = false): Record<string, unknown> {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, f] of Object.entries(spec)) {
    const v = raw[key] === undefined ? f.default : raw[key];
    switch (f.type) {
      case 'int': {
        const min = testMode && f.testMin !== undefined ? f.testMin : f.min;
        if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > f.max) {
          throw new GameError('INVALID', `${f.label} must be ${min}–${f.max}`);
        }
        out[key] = v;
        break;
      }
      case 'enum':
        if (typeof v !== 'string' || !f.options.some((o) => o.value === v)) throw new GameError('INVALID', `${f.label} is invalid`);
        out[key] = v;
        break;
      case 'bool':
        if (typeof v !== 'boolean') throw new GameError('INVALID', `${f.label} must be on or off`);
        out[key] = v;
        break;
      case 'multi': {
        if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && f.options.some((o) => o.value === x))) {
          throw new GameError('INVALID', `${f.label} is invalid`);
        }
        const uniq = [...new Set(v as string[])];
        if (uniq.length < (f.minSelected ?? 1)) throw new GameError('INVALID', `Pick at least ${f.minSelected ?? 1} for ${f.label}`);
        out[key] = uniq;
        break;
      }
    }
  }
  return out;
}
