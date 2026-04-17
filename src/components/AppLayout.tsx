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
import { LogOut, Settings, User, ChevronDown, Shield } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Dono da Loja',
  employee: 'Funcionario',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-[#C1B8FF]/10 text-[#C1B8FF]',
  owner: 'bg-[#FED97B]/20 text-amber-700',
  employee: 'bg-emerald-50 text-emerald-600',
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // Use window.location as fallback if router fails
      try {
        router.replace('/login');
      } catch {
        window.location.href = '/login';
      }
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <div className="hidden md:flex md:w-20 md:fixed md:left-8 md:top-8 md:bottom-8 flex-col items-center bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] py-8">
          <Skeleton className="h-12 w-12 rounded-full bg-gray-100 mb-10" />
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full bg-gray-100" />
            <Skeleton className="h-12 w-12 rounded-full bg-gray-100" />
            <Skeleton className="h-12 w-12 rounded-full bg-gray-100" />
            <Skeleton className="h-12 w-12 rounded-full bg-gray-100" />
          </div>
        </div>
        <div className="flex-1 flex flex-col md:pl-[136px]">
          <div className="flex h-16 items-center gap-4 bg-[#F8F9FB] px-6 md:px-8">
            <Skeleton className="h-5 w-40 bg-muted" />
          </div>
          <div className="flex-1 p-6 md:px-8 bg-[#F8F9FB]">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-48 bg-muted" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-28 rounded-[2rem] bg-muted" />
                <Skeleton className="h-28 rounded-[2rem] bg-muted" />
                <Skeleton className="h-28 rounded-[2rem] bg-muted" />
                <Skeleton className="h-28 rounded-[2rem] bg-muted" />
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
    <div className="min-h-screen bg-[#F8F9FB]">
      <Sidebar />
      <div className="flex flex-1 flex-col md:pl-[136px] transition-all duration-300">
        <header className="flex h-16 items-center gap-4 bg-[#F8F9FB] px-6 md:px-8">
          <div className="flex-1" />

          {/* Role badge */}
          <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-muted text-muted-foreground'}`}>
            {user.role === 'super_admin' && <Shield className="size-3" />}
            {ROLE_LABELS[user.role] || user.role}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/50 focus:outline-none cursor-pointer" />
              }
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-[#C1B8FF]/20 text-sm font-bold text-[#1A1D1F]">
                {user.nome?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-[#1A1D1F]">{user.nome}</p>
                <p className="text-xs text-[#9A9FA5]">{user.nomeLoja || 'Plataforma'}</p>
              </div>
              <ChevronDown className="hidden sm:block size-4 text-[#9A9FA5]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-[#1A1D1F]">{user.nome}</p>
                    <p className="text-xs text-[#9A9FA5]">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push('/perfil')}>
                  <User className="size-4" />
                  Meu Perfil
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push('/configuracoes')}>
                    <Settings className="size-4" />
                    Configuracoes
                  </DropdownMenuItem>
                )}
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
        <main className="flex-1 overflow-y-auto bg-[#F8F9FB] p-6 md:px-8 pb-28 md:pb-0">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}

export default AppLayout;
