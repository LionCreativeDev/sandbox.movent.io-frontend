import toast from 'react-hot-toast';
import type { useRouter } from 'next/navigation';

type Router = ReturnType<typeof useRouter>;

// Shared handling for a View/Edit page's own resource-by-id load failing
// with 404 — happens both for a genuinely deleted record and for another
// company's record (every such query is scoped by company_id server-side,
// e.g. Api\Admin\UserController::canManageUser()/Api\User\LeadController::
// visibleLeads() — a cross-company id is indistinguishable from a missing
// one there, and is deliberately reported the same way here: no page ever
// reveals whether the id belongs to someone else's company or just doesn't
// exist). Sends the user back to wherever they came from instead of leaving
// a half-loaded/broken page behind a small inline error banner.
//
// Returns true if it handled the error — callers should skip their own
// fallback error state (setError, etc.) when it does.
export function handleNotFound(err: unknown, router: Router): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status !== 404) return false;

  toast.error('Not Found');
  router.back();
  return true;
}
