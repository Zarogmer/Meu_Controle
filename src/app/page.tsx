'use client';

export default function Home() {
  // The proxy.ts handles all redirects:
  // - Authenticated super_admin → /admin
  // - Authenticated tenant user → /dashboard
  // - Unauthenticated → /login
  // This page only shows briefly during the redirect.
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Carregando...</div>
    </div>
  );
}
