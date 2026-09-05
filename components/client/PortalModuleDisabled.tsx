// Shown in place of a Client Portal section's normal content when the
// backend rejects the request with 403 (see App\Http\Controllers\Api\Client\
// Concerns\ScopesToPermittedClient) — Company Admin has this module turned
// off for this specific client (or the company doesn't have it purchased at
// all). Distinguishes "nothing here yet" from "you don't have access",
// which the pre-existing empty states didn't — a silently-caught 403 used to
// just render as an ordinary empty list.
export default function PortalModuleDisabled({ feature }: { feature: string }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>{feature} isn&apos;t enabled for your account.</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Contact your account manager if you believe this is a mistake.</div>
    </div>
  );
}
