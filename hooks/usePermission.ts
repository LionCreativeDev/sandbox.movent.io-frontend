'use client';
import { useEffect, useState } from 'react';
import { can } from '@/lib/auth';

// can() reads a cookie snapshot — calling it directly in a component body
// renders differently on the server (no cookie, always false) than on the
// client (cookie present), which is a real hydration mismatch, not just a
// lint nag. Sidebar.tsx already documents hitting this exact bug and works
// around it with its own useState+useEffect; this hook is that same fix,
// factored out so every HR page doesn't repeat the boilerplate.
export function usePermission(moduleKey: string, permKey: string): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => { setAllowed(can(moduleKey, permKey)); }, [moduleKey, permKey]);
  return allowed;
}
