'use client';

import { Button } from '@/components/ui';

export default function DownloadPdfButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      Download PDF
    </Button>
  );
}
