'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  LogOut,
  Sun,
  Moon,
  Menu,
  Wallet,
  Shield,
  Users,
  ClipboardList,
  Receipt,
  BriefcaseBusiness,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/db/schema';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  minRole?: UserRole;
  requiresTenant?: boolean;
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresTenant: true },
  { href: '/estoque', label: 'Controle de Produtos', icon: Boxes, requiresTenant: true },
  { href: '/lancamentos', label: 'Controle de Caixa', icon: Receipt, requiresTenant: true },
  { href: '/deficit', label: 'Contas a Receber', icon: Wallet, requiresTenant: true },
  { href: '/tarefas', label: 'Rotinas', icon: ClipboardList, requiresTenant: true },
  { href: '/equipe', label: 'Equipe', icon: Users, minRole: 'owner', requiresTenant: true },
  { href: '/admin', label: 'Painel da Plataforma', icon: Shield, minRole: 'super_admin' },
];

const ROLE_LEVEL: Record<UserRole, number> = {
  super_admin: 100,
  owner: 50,
  employee: 10,
};

function getVisibleItems(role: UserRole | undefined, lojaId: number | null | undefined): NavItem[] {
  if (!role) return [];

  const userLevel = ROLE_LEVEL[role] ?? 0;
  return allNavItems.filter((item) => {
    if (item.minRole && userLevel < (ROLE_LEVEL[item.minRole] ?? 0)) return false;
    if (item.requiresTenant && !lojaId) return false;
    return true;
  });
}

function DesktopNavLinks() {
  const pathname = usePathname();
  const { user } = useAuth();
  const navItems = getVisibleItems(user?.role, user?.lojaId);

  return (
    <nav className="flex flex-col items-center gap-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger
              render={
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-[0_16px_30px_rgba(37,99,235,0.28)] -translate-y-0.5'
                      : 'bg-sidebar-accent text-sidebar-foreground hover:bg-accent hover:text-foreground'
                  )}
                />
              }
            >
              <Icon
                size={21}
                strokeWidth={isActive ? 2.4 : 2}
                className="transition-transform duration-300 group-hover:scale-105"
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="border-none bg-foreground text-background font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function DesktopFooter() {
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const isLight = theme !== 'dark';

  return (
    <div className="mt-auto flex flex-col items-center gap-5 pb-6">
      <div className="flex flex-col gap-1.5 rounded-[1.5rem] bg-sidebar-accent p-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'rounded-xl p-2 transition-all',
                  isLight ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Tema claro"
              />
            }
          >
            <Sun size={18} />
          </TooltipTrigger>
          <TooltipContent side="right" className="border-none bg-foreground text-background">
            Claro
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'rounded-xl p-2 transition-all',
                  !isLight ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Tema escuro"
              />
            }
          >
            <Moon size={18} />
          </TooltipTrigger>
          <TooltipContent side="right" className="border-none bg-foreground text-background">
            Escuro
          </TooltipContent>
        </Tooltip>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={() => logout()}
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-red-500 transition-all hover:bg-red-500/10 hover:text-red-600"
              aria-label="Sair"
            />
          }
        >
          <LogOut size={20} />
        </TooltipTrigger>
        <TooltipContent side="right" className="border-none bg-red-500 text-white">
          Sair
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function MobileNavLinks({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const navItems = getVisibleItems(user?.role, user?.lojaId);

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="size-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Conta Tech',
  owner: 'Dono da Loja',
  employee: 'Equipe',
};

function MobileSidebarFooter() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="mt-auto border-t border-border px-4 py-4">
      {user && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-accent px-3 py-3">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {user.role === 'super_admin' ? <Shield className="size-4" /> : <Building2 className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user.nomeLoja || 'Meu Controle'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
          onClick={() => logout()}
          aria-label="Sair"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const homeHref = user?.role === 'super_admin' && !user.lojaId ? '/admin' : '/dashboard';

  return (
    <TooltipProvider delay={0}>
      <aside className="hidden md:fixed md:bottom-8 md:left-8 md:top-8 md:z-50 md:flex md:w-24 md:flex-col md:items-center rounded-[2rem] border border-sidebar-border bg-sidebar py-7 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-colors">
        <Link
          href={homeHref}
          aria-label="Meu Controle - Início"
          className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:scale-105"
        >
          <BriefcaseBusiness className="size-5" />
        </Link>

        <div className="flex-1">
          <DesktopNavLinks />
        </div>

        <DesktopFooter />
      </aside>
    </TooltipProvider>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Menu" />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-border bg-card p-0">
        <SheetHeader className="flex h-20 flex-row items-center gap-3 border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-5" />
          </div>
          <div className="text-left">
            <SheetTitle className="text-lg font-bold text-foreground">Meu Controle</SheetTitle>
            <p className="text-xs text-muted-foreground">Seu negócio na sua mão.</p>
          </div>
        </SheetHeader>
        <div className="flex flex-1 flex-col overflow-y-auto py-4">
          <p className="mb-2 px-6 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Navegacao
          </p>
          <MobileNavLinks onClick={() => setOpen(false)} />
        </div>
        <MobileSidebarFooter />
      </SheetContent>
    </Sheet>
  );
}
