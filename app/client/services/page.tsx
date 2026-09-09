'use client';
import RecommendedServices from '@/components/client/RecommendedServices';

// The full "Grow Your Business With Us" list — every service the company has
// enabled, with the same three sections the dashboard shows a trimmed version
// of. Both render the same component, so the two can't drift.
//
// Nothing here decides what to show or whether the client may see it: the
// component renders nothing when the company has enabled no services or the
// 'services' portal module is off for this client, which is also what the
// server enforces (Api\Client\ServiceController).
export default function ClientServicesPage() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <RecommendedServices />
    </div>
  );
}
