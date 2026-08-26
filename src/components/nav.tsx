'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Bell,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileSignature,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Repeat,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from './ui';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/bookings', label: 'Discovery calls', icon: CalendarCheck },
  { href: '/proposals', label: 'Proposals', icon: FileSignature },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/onboarding', label: 'Onboarding', icon: ClipboardList },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  user,
  unreadCount,
}: {
  user: { name: string; email: string; role: string };
  unreadCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const links = (
    <nav className="flex-1 space-y-0.5 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          IC
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">Innovative CFO</p>
          <p className="text-[11px] text-slate-500">Operations</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4" aria-hidden />
            Notifications
          </span>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Link>
      </div>

      {links}

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar name={user.name} color="#1f41f5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-[11px] capitalize text-slate-500">{user.role.toLowerCase()}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn-ghost btn-sm" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-ghost btn-sm"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-sm font-bold text-slate-900">Innovative CFO</span>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            {panel}
          </div>
        </div>
      ) : null}

      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">{panel}</div>
      </aside>
    </>
  );
}
