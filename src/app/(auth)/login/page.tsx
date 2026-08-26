import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/');

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            IC
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Innovative CFO</h1>
          <p className="mt-1 text-sm text-slate-500">Operations platform</p>
        </div>

        <div className="card card-pad">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          Seeded accounts use the password from <code className="font-mono">SEED_PASSWORD</code>.
          <br />
          Trouble signing in? Open{' '}
          <a href="/api/health" className="underline hover:text-slate-600">
            /api/health
          </a>{' '}
          to see what is misconfigured.
        </p>
      </div>
    </main>
  );
}
