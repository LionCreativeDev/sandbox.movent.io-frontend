'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuthType } from '@/lib/auth';

export function useAdminGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (getAuthType() === 'admin' && !pathname.startsWith('/admin')) {
      // usePathname() never includes the query string — reading it via
      // window.location.search instead of dropping it here. Without this, an
      // Admin landing on a bare (non-/admin-prefixed) deep link with a query
      // param — e.g. a notification/quick-link to /leads/{id}?tab=chat —
      // got redirected to plain /admin/leads/{id}, silently losing
      // ?tab=chat and landing back on the Details tab instead of Chat.
      router.replace('/admin' + pathname + window.location.search);
    }
  }, [pathname, router]);
}
