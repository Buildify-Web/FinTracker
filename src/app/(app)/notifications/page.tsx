import { redirect } from 'next/navigation';

// Alerts live in the bell panel and their limits in Settings; keep old links working.
export default function NotificationsPage() {
  redirect('/settings');
}
