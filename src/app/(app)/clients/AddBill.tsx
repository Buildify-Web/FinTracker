'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NewEntryModal from '@/components/NewEntryModal';

// "Bill" on a client's card: opens the new-bill form with this client already picked.
export default function AddBill({ clientId, projectId }: { clientId: string; projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-[12px] font-semibold text-accent hover:underline px-1" title="Add a bill for this client (hosting, tools, a freelancer…)">
        Bill
      </button>
      {open && (
        <NewEntryModal
          initialTab="bill"
          defaults={{ client_id: clientId, project_id: projectId }}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
