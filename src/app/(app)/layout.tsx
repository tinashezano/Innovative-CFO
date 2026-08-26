import { redirect } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { authDisabled, getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} unreadCount={unreadCount} />
      <main className="min-w-0 flex-1">
        {/* Impossible to miss, so an open deployment is never a surprise. */}
        {authDisabled() ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-900 sm:px-6 lg:px-8">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <strong>Sign-in is switched off.</strong>
            <span>
              Anyone with this link has full access as {user.name}. Remove{' '}
              <code className="rounded bg-amber-200 px-1 font-mono">AUTH_DISABLED</code> and redeploy
              before putting real client data in.
            </span>
          </div>
        ) : null}
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
