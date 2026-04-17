'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Boxes,
  Layers,
  LogOut,
  Sun,
  Moon,
  Menu,
  Wallet,
  Store,
  Shield,
  Users,
  ClipboardList,
  Receipt,
  ShoppingCart,
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
import { useState } from 'react';
import type { UserRole } from '@/lib/db/schema';

// ── Nav Items ──────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  minRole?: UserRole;
  requiresTenant?: boolean;
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresTenant: true },
  { href: '/estoque', label: 'Estoque', icon: Boxes, requiresTenant: true },
  { href: '/categorias', label: 'Categorias', icon: Layers, requiresTenant: true },
  { href: '/lancamentos', label: 'Lancamentos', icon: Receipt, requiresTenant: true },
  { href: '/deficit', label: 'Dividas', icon: Wallet, requiresTenant: true },
  { href: '/tarefas', label: 'Tarefas', icon: ClipboardList, requiresTenant: true },
  { href: '/equipe', label: 'Equipe', icon: Users, minRole: 'owner', requiresTenant: true },
  { href: '/admin', label: 'Painel', icon: Shield, minRole: 'super_admin' },
];

const ROLE_LEVEL: Record<UserRole, number> = {
  super_admin: 100,
  owner: 50,
  employee: 10,
};

function getVisibleItems(role: UserRole | undefined, lojaId: number | null | undefined): NavItem[] {
  if (!role) return [];
  const userLevel = ROLE_LEVEL[role] ?? 0;
  return allNavItems.filter(item => {
    if (item.minRole && userLevel < (ROLE_LEVEL[item.minRole] ?? 0)) return false;
    if (item.requiresTenant && !lojaId) return false;
    return true;
  });
}

// ── Desktop Floating Sidebar ───────────────────────────────────
function FloatingNavLinks() {
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
                    'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group',
                    isActive
                      ? 'bg-[#1A1D1F] text-white shadow-[0_10px_20px_rgba(13,12,21,0.2)] scale-110'
                      : 'bg-white text-[#1A1D1F]/40 hover:text-[#1A1D1F] hover:bg-gray-50'
                  )}
                />
              }
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className="transition-transform group-hover:scale-110"
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#1A1D1F] text-white border-none font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

// ── Desktop Footer (Theme + Logout) ────────────────────────────
function FloatingFooter() {
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const isLight = theme !== 'dark';

  return (
    <div className="mt-auto flex flex-col items-center gap-5 pb-6">
      {/* Theme Switcher Pill */}
      <div className="flex flex-col gap-1.5 p-1.5 bg-[#F8F9FB] rounded-full">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'p-2 rounded-full transition-all',
                  isLight ? 'bg-white shadow-sm text-[#1A1D1F]' : 'text-gray-400 hover:text-[#1A1D1F]'
                )}
                aria-label="Tema claro"
              />
            }
          >
            <Sun size={18} />
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[#1A1D1F] text-white border-none">Claro</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'p-2 rounded-full transition-all',
                  !isLight ? 'bg-white shadow-sm text-[#1A1D1F]' : 'text-gray-400 hover:text-[#1A1D1F]'
                )}
                aria-label="Tema escuro"
              />
            }
          >
            <Moon size={18} />
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[#1A1D1F] text-white border-none">Escuro</TooltipContent>
        </Tooltip>
      </div>

      {/* Logout */}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={() => logout()}
              className="w-12 h-12 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
              aria-label="Sair"
            />
          }
        >
          <LogOut size={20} />
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-red-500 text-white border-none">
          Sair
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ── Mobile Nav ─────────────────────────────────────────────────
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
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
              active
                ? 'bg-[#C1B8FF]/20 text-white'
                : 'text-[#9A9FA5] hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className={cn('size-[18px]', active && 'text-white')} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Dono da Loja',
  employee: 'Funcionario',
};

function MobileSidebarFooter() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="mt-auto border-t border-white/10 px-4 py-4">
      {user && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-[#C1B8FF]/20 text-white">
            <Store className="size-4" />
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-white">
              {user.nomeLoja || 'Plataforma'}
            </p>
            <p className="truncate text-xs text-[#9A9FA5]">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-[#9A9FA5] hover:bg-white/10 hover:text-white"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-[#9A9FA5] hover:bg-red-500/15 hover:text-red-400"
          onClick={() => logout()}
          aria-label="Sair"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Exported Components ────────────────────────────────────────

export function Sidebar() {
  const { user } = useAuth();
  const homeHref = user?.role === 'super_admin' && !user.lojaId ? '/admin' : '/dashboard';

  return (
    <TooltipProvider delay={0}>
      <aside className="hidden md:flex md:w-20 md:flex-col md:items-center md:fixed md:left-8 md:top-8 md:bottom-8 bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] z-50 py-8">
        {/* Logo */}
        <div className="flex items-center justify-center mb-12">
          <Link
            href={homeHref}
            className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/20 hover:scale-105 transition-transform cursor-pointer"
          >
            <span className="text-white font-bold text-2xl tracking-tighter">M</span>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1">
          <FloatingNavLinks />
        </div>

        {/* Footer */}
        <FloatingFooter />
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
      <SheetContent side="left" className="w-64 p-0 bg-[#1A1D1F] border-white/10">
        <SheetHeader className="border-b border-white/10 px-6 h-16 flex items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-[#1A1D1F]">
              <span className="font-bold text-lg tracking-tighter">M</span>
            </div>
            <SheetTitle className="text-lg font-bold text-white">Meu Estoque</SheetTitle>
          </div>
        </SheetHeader>
        <div className="flex flex-1 flex-col py-4 overflow-y-auto">
          <p className="mb-2 px-6 text-[10px] font-bold uppercase tracking-wider text-[#9A9FA5]/50">
            Menu
          </p>
          <MobileNavLinks onClick={() => setOpen(false)} />
        </div>
        <MobileSidebarFooter />
      </SheetContent>
    </Sheet>
  );
}
