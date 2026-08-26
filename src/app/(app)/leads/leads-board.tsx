'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, FileText } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { formatMoney, formatDayMonth, cn } from '@/lib/utils';
import { LEAD_STAGE_LABELS, type LeadStage } from '@/lib/constants';
import { submitJson } from '@/components/forms';

export type BoardLead = {
  id: string;
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  stage: string;
  source: string;
  serviceInterest: string | null;
  estimatedValue: number;
  currency: string;
  createdAt: string;
  owner: { id: string; name: string; avatarColor: string } | null;
  nextCall: string | null;
  proposalCount: number;
};

const COLUMN_ACCENT: Record<string, string> = {
  NEW: 'border-t-slate-400',
  DISCOVERY: 'border-t-sky-500',
  PROPOSAL: 'border-t-violet-500',
  WON: 'border-t-emerald-500',
  LOST: 'border-t-red-400',
};

/**
 * Pipeline board. Drag a card to a new column to move the lead's stage —
 * the change posts immediately and the workflow logs the activity.
 * Card order within a column is by last update, so no reordering handles.
 */
export function LeadsBoard({ leads, stages }: { leads: BoardLead[]; stages: string[] }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Optimistic stage overrides so the card moves the moment it is dropped.
  const stageOf = (lead: BoardLead) => pending[lead.id] ?? lead.stage;

  async function move(leadId: string, stage: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || stageOf(lead) === stage) return;

    setPending((p) => ({ ...p, [leadId]: stage }));
    setError(null);

    const result = await submitJson(`/api/leads/${leadId}`, { stage }, 'PATCH');
    if (!result.ok) {
      setPending((p) => {
        const next = { ...p };
        delete next[leadId];
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
          const columnLeads = leads.filter((l) => stageOf(l) === stage);
          const value = columnLeads.reduce((sum, l) => sum + l.estimatedValue, 0);

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
                'flex w-[290px] shrink-0 flex-col rounded-xl border border-t-4 bg-slate-100/60 transition',
                COLUMN_ACCENT[stage] ?? 'border-t-slate-400',
                dragOver === stage ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200',
              )}
            >
              <div className="flex items-baseline justify-between px-3 py-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {LEAD_STAGE_LABELS[stage as LeadStage] ?? stage}
                  <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                    {columnLeads.length}
                  </span>
                </h2>
                <span className="text-[11px] text-slate-500">
                  {formatMoney(value, columnLeads[0]?.currency ?? 'ZAR')}
                </span>
              </div>

              <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: '68vh' }}>
                {columnLeads.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => setDragging(null)}
                    className={cn(
                      'cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow active:cursor-grabbing',
                      dragging === lead.id && 'opacity-50',
                    )}
                  >
                    <Link href={`/leads/${lead.id}`} className="block">
                      <p className="text-sm font-semibold leading-snug text-slate-900">{lead.companyName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{lead.contactName}</p>
                    </Link>

                    {lead.serviceInterest ? (
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{lead.serviceInterest}</p>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">
                        {formatMoney(lead.estimatedValue, lead.currency)}
                      </span>
                      {lead.owner ? (
                        <Avatar name={lead.owner.name} color={lead.owner.avatarColor} size="sm" />
                      ) : (
                        <span className="text-[10px] text-amber-600">Unassigned</span>
                      )}
                    </div>

                    {(lead.nextCall || lead.proposalCount > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                        {lead.nextCall ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" aria-hidden />
                            {formatDayMonth(lead.nextCall)}
                          </span>
                        ) : null}
                        {lead.proposalCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" aria-hidden />
                            {lead.proposalCount} proposal{lead.proposalCount === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </article>
                ))}

                {columnLeads.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    Drop a lead here
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
