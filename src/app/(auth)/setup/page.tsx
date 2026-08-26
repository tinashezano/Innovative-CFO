import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

/**
 * First-run screen. Shown only while the database has no users, so a fresh
 * deployment can create its owner account in the browser instead of needing
 * Prisma run by hand against the production database.
 */
export default async function SetupPage() {
  let userCount = 0;
  let databaseError: string | null = null;

  try {
    userCount = await prisma.user.count();
  } catch (err) {
    databaseError = err instanceof Error ? err.message.split('\n')[0]! : 'Database unreachable';
  }

  if (!databaseError && userCount > 0) redirect('/login');

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            IC
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Set up your firm</h1>
          <p className="mt-1 text-sm text-slate-500">
            This is a fresh install. Create the owner account to get started.
          </p>
        </div>

        {databaseError ? (
          <div className="card card-pad">
            <h2 className="text-sm font-semibold text-red-700">The database is not reachable</h2>
            <p className="mt-2 text-sm text-slate-600">
              Setup cannot run until the app can connect. Open{' '}
              <a href="/api/health" className="link">
                /api/health
              </a>{' '}
              to see what is missing.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
              {databaseError}
            </pre>
          </div>
        ) : (
          <div className="card card-pad">
            <SetupForm />
          </div>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          This screen disappears the moment an account exists, and cannot be used again.
        </p>
      </div>
    </main>
  );
}
