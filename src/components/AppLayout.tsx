'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';
import { MobileTabBar } from '@/components/MobileTabBar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { LogOut, User, ChevronDown, Shield, Building2 } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Conta Tech',
  owner: 'Dono da Loja',
  employee: 'Equipe',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-primary/10 text-primary',
  owner: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  employee: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      try {
        router.replace('/login');
      } catch {
        window.location.href = '/login';
      }
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="app-shell min-h-screen text-foreground transition-colors">
        <div className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-24 md:flex-col md:items-center border-r border-border bg-sidebar py-7">
          <Skeleton className="mb-8 h-12 w-12 rounded-2xl bg-muted" />
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-2xl bg-muted" />
            <Skeleton className="h-12 w-12 rounded-2xl bg-muted" />
            <Skeleton className="h-12 w-12 rounded-2xl bg-muted" />
            <Skeleton className="h-12 w-12 rounded-2xl bg-muted" />
          </div>
        </div>
        <div className="flex flex-1 flex-col md:pl-24">
          <div className="flex h-20 items-center gap-4 px-6 md:px-8">
            <Skeleton className="h-10 w-56 rounded-2xl bg-muted" />
          </div>
          <div className="flex-1 p-6 md:px-8">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-48 rounded-xl bg-muted" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-32 rounded-[2rem] bg-muted" />
                <Skeleton className="h-32 rounded-[2rem] bg-muted" />
                <Skeleton className="h-32 rounded-[2rem] bg-muted" />
                <Skeleton className="h-32 rounded-[2rem] bg-muted" />
              </div>
              <Skeleton className="h-80 rounded-[2rem] bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="app-shell min-h-screen text-foreground transition-colors">
      <Sidebar />
      <div className="flex flex-1 flex-col md:pl-24 transition-all duration-300">
        <header className="sticky top-0 z-40 flex h-20 items-center gap-4 border-b border-border/80 bg-background/80 px-6 backdrop-blur-xl md:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Meu Controle
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                {user.nomeLoja || 'Painel da Plataforma'}
              </h1>
              <span className="hidden text-sm text-muted-foreground md:inline">
                Seu negócio na sua mão.
              </span>
            </div>
          </div>

          <div className="flex-1" />

          <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:inline-flex ${ROLE_COLORS[user.role] || 'bg-muted text-muted-foreground'}`}>
            {user.role === 'super_admin' ? <Shield className="size-3.5" /> : <Building2 className="size-3.5" />}
            {ROLE_LABELS[user.role] || user.role}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 px-2.5 py-2 transition-colors hover:bg-card focus:outline-none cursor-pointer" />
              }
            >
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                {user.nome?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden min-w-0 text-left sm:block">
                <p className="truncate text-sm font-medium text-foreground">{user.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-[#0b1020]">
                      <Image src="/mascote.png" alt="Meu Controle" width={40} height={40} className="size-10 object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{user.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.nomeLoja || 'Meu Controle'}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push('/perfil')}>
                  <User className="size-4" />
                  Meu perfil
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" className="gap-2 cursor-pointer" onClick={() => logout()}>
                  <LogOut className="size-4" />
                  Sair da conta
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-y-auto p-6 pb-28 md:px-8 md:pb-8">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}

export default AppLayout;
