import { NextResponse } from 'next/server';
import { getAlerts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const alerts = await getAlerts();
  return NextResponse.json({ alerts });
}
