import { redirect } from 'next/navigation';

// Statements now live on the Cash page; keep old links working.
export default function StatementsPage() {
  redirect('/cash#import');
}
