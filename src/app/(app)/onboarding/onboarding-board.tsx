'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Avatar, ProgressBar } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import { ONBOARDING_STAGE_LABELS, type OnboardingStage } from '@/lib/constants';
import { submitJson } from '@/components/forms';

type Card = {
  id: string;
  clientId: string;
  clientName: string;
  clientReference: string;
  colorTag: string;
  stage: string;
  ownerName: string | null;
  ownerColor: string | null;
  startedAt: string;
  targetCompleteAt: string | null;
  itemsTotal: number;
  itemsDone: number;
  overdueItems: number;
};

const ACCENT: Record<string, string> = {
  INFORMATION_REQUESTED: 'border-t-slate-400',
  INFORMATION_RECEIVED: 'border-t-sky-500',
  SETUP: 'border-t-violet-500',
  REVIEW: 'border-t-amber-500',
  COMPLETE: 'border-t-emerald-500',
};

/**
 * Onboarding board. Dropping a card into COMPLETE also flips the client to
 * Active, which is what starts their recurring calendar running for real.
 */
export function OnboardingBoard({ cards, stages }: { cards: Card[]; stages: string[] }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const stageOf = (card: Card) => pending[card.id] ?? card.stage;

  async function move(id: string, stage: string) {
    const card = cards.find((c) => c.id === id);
    if (!card || stageOf(card) === stage) return;

    setPending((p) => ({ ...p, [id]: stage }));
    setError(null);

    const result = await submitJson(`/api/onboarding/${id}`, { stage }, 'PATCH');
    if (!result.ok) {
      setPending((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="scroll-thin -mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
        {stages.map((stage) => {
          const columnCards = cards.filter((c) => stageOf(c) === stage);

          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                if (dragging) void move(dragging, stage);
                setDragging(null);
              }}
              className={cn(
                'flex w-[300px] shrink-0 flex-col rounded-xl border border-t-4 bg-slate-100/60 transition',
                ACCENT[stage] ?? 'border-t-slate-400',
                dragOver === stage ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200',
              )}
            >
              <div className="px-3 py-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {ONBOARDING_STAGE_LABELS[stage as OnboardingStage] ?? stage}
                  <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                    {columnCards.length}
                  </span>
                </h2>
              </div>

              <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: '70vh' }}>
                {columnCards.map((card) => (
                  <article
                    key={card.id}
                    draggable
                    onDragStart={() => setDragging(card.id)}
                    onDragEnd={() => setDragging(null)}
                    className={cn(
                      'cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow active:cursor-grabbing',
                      dragging === card.id && 'opacity-50',
                    )}
                  >
                    <Link href={`/clients/${card.clientId}`} className="block">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: card.colorTag }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{card.clientName}</p>
                          <p className="text-[11px] text-slate-400">{card.clientReference}</p>
                        </div>
                      </div>
                    </Link>

                    <div className="mt-3">
                      <ProgressBar value={card.itemsDone} max={card.itemsTotal} />
                      <p className="mt-1 text-[11px] text-slate-500">
                        {card.itemsDone} of {card.itemsTotal} items
                      </p>
                    </div>

                    {card.overdueItems > 0 ? (
                      <p className="mt-2 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        {card.overdueItems} overdue
                      </p>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <span className="text-[11px] text-slate-500">
                        {card.targetCompleteAt ? `Target ${formatDate(card.targetCompleteAt)}` : `Started ${formatDate(card.startedAt)}`}
                      </span>
                      {card.ownerName ? (
                        <Avatar name={card.ownerName} color={card.ownerColor ?? undefined} size="sm" />
                      ) : null}
                    </div>
                  </article>
                ))}

                {columnCards.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    Nothing here
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
