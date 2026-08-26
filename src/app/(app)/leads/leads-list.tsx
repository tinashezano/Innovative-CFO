'use client';

import Link from 'next/link';
import { Avatar, LeadStageBadge } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/utils';
import type { BoardLead } from './leads-board';

export function LeadsList({ leads }: { leads: BoardLead[] }) {
  if (!leads.length) {
    return (
      <div className="card px-6 py-14 text-center">
        <p className="text-sm font-semibold text-slate-700">No leads yet</p>
        <p className="mt-1 text-sm text-slate-500">Capture your first lead to start the pipeline.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Company</th>
              <th className="th">Contact</th>
              <th className="th">Stage</th>
              <th className="th">Source</th>
              <th className="th text-right">Value</th>
              <th className="th">Next call</th>
              <th className="th">Owner</th>
              <th className="th">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="transition hover:bg-slate-50">
                <td className="td">
                  <Link href={`/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                    {lead.companyName}
                  </Link>
                  <div className="text-xs text-slate-400">{lead.reference}</div>
                </td>
                <td className="td">
                  <div>{lead.contactName}</div>
                  <div className="text-xs text-slate-400">{lead.email}</div>
                </td>
                <td className="td">
                  <LeadStageBadge stage={lead.stage} />
                </td>
                <td className="td text-xs capitalize text-slate-500">
                  {lead.source.toLowerCase().replace(/_/g, ' ')}
                </td>
                <td className="td text-right font-medium">{formatMoney(lead.estimatedValue, lead.currency)}</td>
                <td className="td text-xs text-slate-500">
                  {lead.nextCall ? formatDate(lead.nextCall) : '—'}
                </td>
                <td className="td">
                  {lead.owner ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={lead.owner.name} color={lead.owner.avatarColor} size="sm" />
                      <span className="text-xs">{lead.owner.name}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">Unassigned</span>
                  )}
                </td>
                <td className="td text-xs text-slate-500">{formatDate(lead.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
