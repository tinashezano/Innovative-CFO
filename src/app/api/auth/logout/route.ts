import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { appUrl } from '@/lib/utils';

export async function POST() {
  await destroySession();
  return NextResponse.redirect(appUrl('/login'), { status: 303 });
}
