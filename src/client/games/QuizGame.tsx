'use client';
import { useState } from 'react';
import { postJson } from '@/client/api';
import { Sheet, type RoomProps } from '@/client/components/ui';
import { QUIZ_CATEGORIES } from '@/games/quiz/meta';

interface QuizView {
  idx: number;
  total: number;
  questionId: string;
  category: string;
  question: string;
  options: string[];
  answeredSeatIds: string[];
  teams: boolean;
  reveal: { correct: number; dist: number[]; points: Record<string, number> } | null;
}

const LETTERS = ['A', 'B', 'C', 'D'];
const TILE = ['#1d4ed8', '#c2185b', '#0f7a45', '#b45309'];

const REASONS = [
  { value: 'wrong_answer', label: 'The answer is wrong' },
  { value: 'unclear', label: 'The question is unclear' },
  { value: 'outdated', label: 'It is out of date' },
  { value: 'offensive', label: 'It is offensive' },
  { value: 'other', label: 'Something else' },
];

export function QuizGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as QuizView;
  const myChoice = (me.game?.myChoice ?? null) as number | null;
  const [pending, setPending] = useState<{ q: string; i: number } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState<string | null>(null);
  const chosen = myChoice ?? (pending?.q === v.questionId ? pending.i : null);
  const canAnswer = Boolean(me.game?.mustAct) && !pub.paused && chosen === null;
  const players = pub.seats.filter((s) => s.status === 'seated');
  const category = QUIZ_CATEGORIES.find((c) => c.value === v.category)?.label ?? v.category;

  const answer = async (i: number) => {
    setPending({ q: v.questionId, i });
    const r = await sync.act('answer', { choice: i });
    if (!r.ok) setPending(null);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="quiz">
      <div className="card p-4">
        <div className="mb-1 flex justify-between text-sm font-black uppercase tracking-wide text-muted">
          <span data-testid="quiz-progress">
            Question {v.idx + 1} / {v.total}
          </span>
          <span>{category}</span>
        </div>
        <h2 className="text-xl font-black leading-snug" data-testid="quiz-question">
          {v.question}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {v.options.map((opt, i) => {
          const isCorrect = v.reveal?.correct === i;
          const isMine = chosen === i;
          const faded = v.reveal ? !isCorrect : chosen !== null && !isMine;
          return (
            <button
              key={i}
              className="btn min-h-16 w-full justify-start !rounded-2xl text-left text-lg"
              style={{
                // Faded options stay readable (solid muted surface, not transparency) so contrast holds.
                background: v.reveal && isCorrect ? '#0b7a45' : faded ? 'var(--surface-2)' : TILE[i],
                color: faded ? 'var(--ink)' : '#fff',
                border: faded ? '2px solid var(--line)' : undefined,
                outline: isMine ? '4px solid var(--ink)' : undefined,
                outlineOffset: 2,
              }}
              disabled={!canAnswer}
              onClick={() => answer(i)}
              aria-pressed={isMine}
              data-testid={`quiz-option-${i}`}
              data-correct={v.reveal ? String(isCorrect) : undefined}
            >
              <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/25 font-black">{LETTERS[i]}</span>
              <span className="flex-1">{opt}</span>
              {v.reveal && (
                <span className="rounded-full bg-black/25 px-2 text-sm font-black" data-testid={`quiz-dist-${i}`}>
                  {v.reveal.dist[i]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!v.reveal && (
        <p className="text-center font-bold text-muted" data-testid="quiz-answered">
          {chosen !== null ? '🔒 Locked in · ' : ''}
          {v.answeredSeatIds.length} / {players.length} answered
        </p>
      )}
      {v.reveal && (
        <div className="reveal-card card flex flex-col gap-2 p-4" data-testid="quiz-reveal" data-reveal-card="true">
          <p className="text-lg font-black" data-testid="quiz-my-points">
            {me.seatId && v.reveal.points[me.seatId] ? `+${v.reveal.points[me.seatId]} points` : me.role === 'player' ? 'No points this time' : 'Answer revealed'}
          </p>
          <button className="btn btn-ghost self-start text-sm" onClick={() => setReportOpen(true)} disabled={Boolean(reported)} data-testid="report-question">
            {reported ? 'Reported, thanks' : '🚩 Report question'}
          </button>
        </div>
      )}
      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report this question" testId="report-sheet">
        <div className="flex flex-col gap-2">
          {REASONS.map((r) => (
            <button
              key={r.value}
              className="btn btn-ghost justify-start"
              onClick={async () => {
                await postJson(`/api/questions/${v.questionId}/report`, { reason: r.value });
                setReported(v.questionId);
                setReportOpen(false);
              }}
              data-testid={`report-${r.value}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
