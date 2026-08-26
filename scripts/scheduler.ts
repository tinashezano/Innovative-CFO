/**
 * Long-running scheduler for hosts without a managed cron.
 *
 * Runs the jobs at startup and then every day at RUN_HOUR (default 06:00
 * local). Keep it alive with your process manager:
 *
 *   npm run scheduler
 *
 * On a platform that provides cron (Vercel, Railway, Render, a system
 * crontab), prefer hitting /api/cron/run instead — one fewer process to keep
 * running.
 */
import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const RUN_HOUR = Number(process.env.SCHEDULER_HOUR ?? 6);

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(RUN_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function runJobs() {
  try {
    // --conditions=react-server resolves the `server-only` marker package to
    // its empty build, so these server modules load outside Next's runtime.
    const { stdout, stderr } = await run(
      'npx',
      ['tsx', '--conditions=react-server', 'scripts/run-jobs.ts'],
      { cwd: process.cwd() },
    );
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (err) {
    console.error('[scheduler] job run failed:', err);
  }
}

async function loop() {
  console.log(`[scheduler] started — jobs run daily at ${String(RUN_HOUR).padStart(2, '0')}:00`);
  await runJobs();

  // setTimeout rather than setInterval, so each run is scheduled off the real
  // clock and daylight-saving shifts do not accumulate drift.
  const tick = () => {
    const delay = msUntilNextRun();
    console.log(`[scheduler] next run in ${Math.round(delay / 60000)} minutes`);
    setTimeout(async () => {
      await runJobs();
      tick();
    }, delay);
  };
  tick();
}

loop();
