'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/lib/db/schema';

interface User {
  id: number;
  nome: string;
  email: string;
  lojaId: number | null;
  nomeLoja: string | null;
  role: UserRole;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch user from server (no localStorage — httpOnly cookies only)
  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setUser(data.user);
        } else if (res.status === 401) {
          // Try refresh
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });
          if (refreshRes.ok) {
            const retryRes = await fetch('/api/auth/me', { credentials: 'include' });
            if (retryRes.ok) {
              const data = await retryRes.json();
              if (!cancelled) setUser(data.user);
            }
          }
        }
      } catch {
        // Network error — user stays null
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');
    setUser(data.user);
    const home = data.user.role === 'super_admin' ? '/admin' : '/dashboard';
    router.push(home);
    return data;
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Network error — proceed with client-side cleanup
    }
    setUser(null);
    router.push('/login');
  }, [router]);

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    let res = await fetch(url, { ...options, credentials: 'include' });
    if (res.status === 401) {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) {
        res = await fetch(url, { ...options, credentials: 'include' });
      } else {
        setUser(null);
        router.push('/login');
        throw new Error('Sessão expirada');
      }
    }
    return res;
  }, [router]);

  // ── Role helpers ────────────────────────────────────────────
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'owner' || isSuperAdmin;
  const isEmployee = user?.role === 'employee';

  return {
    user,
    loading,
    login,
    logout,
    fetchWithAuth,
    isSuperAdmin,
    isAdmin,
    isEmployee,
  };
}
