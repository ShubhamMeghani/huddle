'use client';
import { GAME_META } from '@/games/meta';
import { applyPreset, estimateMinutes, hasPresets, PRESET_LABELS, PRESET_NAMES, presetOf } from '@/games/presets';
import type { GameConfig } from '@/engine/types';
import { SettingsForm } from './SettingsForm';

/** One queued game (R97): Quick / Normal / Long with estimated minutes; the full settings sit under Advanced. */
export function QueueItem(p: {
  index: number;
  cfg: GameConfig;
  players: number;
  isAdmin: boolean;
  testMode: boolean;
  advanced: boolean;
  onToggleAdvanced: () => void;
  onChange: (settings: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const { index: i, cfg } = p;
  const m = GAME_META[cfg.gameId];
  const preset = presetOf(cfg.gameId, cfg.settings);
  const minutes = estimateMinutes(cfg.gameId, cfg.settings, p.players);
  return (
    <li className="rounded-2xl border-2 border-line p-3" data-game={cfg.gameId} data-testid="queue-item" data-preset={preset ?? 'custom'}>
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          {m?.emoji}
        </span>
        <span className="min-w-0 flex-1 font-extrabold">{m?.title}</span>
        <span className="shrink-0 text-sm font-black text-muted" data-testid={`queue-estimate-${i}`}>
          ~{minutes} min
        </span>
        {p.isAdmin && (
          <button className="btn btn-ghost !px-3 text-sm" aria-label={`Remove ${m?.title}`} onClick={p.onRemove}>
            ✕
          </button>
        )}
      </div>
      {hasPresets(cfg.gameId) &&
        (p.isAdmin ? (
          <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={`${m?.title} length`}>
            {PRESET_NAMES.map((n) => (
              <button
                key={n}
                className={`btn !min-h-14 flex-col !gap-0 !px-1 text-sm ${preset === n ? 'btn-primary' : 'btn-ghost'}`}
                aria-pressed={preset === n}
                onClick={() => p.onChange(applyPreset(cfg.gameId, cfg.settings, n))}
                data-testid={`preset-${i}-${n}`}
              >
                <span>{PRESET_LABELS[n]}</span>
                <span className="text-xs font-bold">~{estimateMinutes(cfg.gameId, applyPreset(cfg.gameId, cfg.settings, n), p.players)} min</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm font-bold text-muted" data-testid={`queue-preset-${i}`}>
            {preset ? PRESET_LABELS[preset] : 'Custom'}
          </p>
        ))}
      {p.isAdmin && m && (
        <button className="btn btn-ghost mt-2 w-full text-sm" aria-expanded={p.advanced} onClick={p.onToggleAdvanced} data-testid={`edit-${i}`}>
          {p.advanced ? 'Hide advanced settings' : `⚙️ Advanced settings${preset ? '' : ' (custom)'}`}
        </button>
      )}
      {p.advanced && m && (
        <div className="mt-3">
          <SettingsForm spec={m.settings} value={cfg.settings} testMode={p.testMode} idPrefix={`set-${i}`} onChange={p.onChange} />
        </div>
      )}
    </li>
  );
}
