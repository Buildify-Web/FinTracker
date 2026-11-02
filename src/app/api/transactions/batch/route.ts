import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { deleteTransactionsSafely, UUID } from '@/lib/transfers';

export const dynamic = 'force-dynamic';

// Deletes many transactions at once. Same rule as the single delete: an invoice/bill
// that was paid by one of them goes back to unpaid. All-or-nothing.
export async function DELETE(req: NextRequest) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!Array.isArray(ids) || !ids.length || ids.length > 5000 || ids.some((i) => typeof i !== 'string' || !UUID.test(i))) {
    return NextResponse.json({ error: 'Select at least one transaction.' }, { status: 400 });
  }
  const summary = await withTransaction((db) => deleteTransactionsSafely(db, ids));
  return NextResponse.json(summary);
}
