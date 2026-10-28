import { NextResponse } from 'next/server';
import { getAccounts, getCategories, getClients, getProjects } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [accounts, categories, clients, projects] = await Promise.all([getAccounts(), getCategories(), getClients(), getProjects()]);
  return NextResponse.json({ accounts, categories, clients, projects });
}
