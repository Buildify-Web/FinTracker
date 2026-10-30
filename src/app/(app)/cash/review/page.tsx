import { redirect } from 'next/navigation';

// The approval screen moved to its own sidebar page; keep old links working.
export default function ReviewRedirect() {
  redirect('/categorize');
}
