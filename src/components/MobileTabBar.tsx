'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import {
  MoreHorizontal,
  Sun,
  Moon,
  LogOut,
  Shield,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MascotCube } from '@/components/MascotCube';
import { getVisibleItems } from '@/components/Sidebar';

const PRIMARY_ORDER = ['/dashboard', '/estoque', '/lancamentos', '/tarefas', '/deficit', '/admin'];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Conta Tech',
  owner: 'Dono da Loja',
  employee: 'Equipe',
};

export function MobileTabBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const visibleItems = useMemo(
    () => getVisibleItems(user?.role, user?.lojaId),
    [user?.role, user?.lojaId]
  );

  const primary = useMemo(() => {
    const byHref = new Map(visibleItems.map((it) => [it.href, it]));
    const ordered = PRIMARY_ORDER.map((h) => byHref.get(h)).filter(Boolean) as typeof visibleItems;
    const extras = visibleItems.filter((it) => !PRIMARY_ORDER.includes(it.href));
    return [...ordered, ...extras].slice(0, 4);
  }, [visibleItems]);

  if (!user) return null;

  const primaryHrefs = new Set(primary.map((p) => p.href));
  const overflow = visibleItems.filter((it) => !primaryHrefs.has(it.href));

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-[100] md:hidden">
      <div className="flex h-[72px] items-center justify-around rounded-full border border-border/60 bg-card/95 px-2 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-md transition-colors">
        {primary.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-full transition-all duration-300 ease-out',
                  isActive
                    ? 'h-11 w-11 bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(37,99,235,0.28)]'
                    : 'h-9 w-9'
                )}
              >
                <Icon
                  size={isActive ? 20 : 19}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={cn(isActive ? 'text-primary-foreground' : 'text-muted-foreground')}
                />
              </div>
              <span
                className={cn(
                  'truncate max-w-[60px] text-[10px] font-semibold',
                  isActive ? 'text-foreground' : 'text-muted-foreground opacity-70'
                )}
              >
                {shortLabel(tab.label)}
              </span>
            </Link>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
                aria-label="Mais opções"
              />
            }
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full">
              <MoreHorizontal size={19} strokeWidth={1.8} className="text-muted-foreground" />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground opacity-70">Mais</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 border-border bg-card p-0">
            <SheetHeader className="flex h-20 flex-row items-center gap-3 border-b border-border px-6">
              <div
                className="cosmic-glow flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'var(--mascot-bg)' }}
              >
                <MascotCube size={30} />
              </div>
              <div className="text-left">
                <SheetTitle className="text-lg font-bold text-foreground">Mais opções</SheetTitle>
                <p className="text-xs text-muted-foreground">{user.nomeLoja || 'Meu Controle'}</p>
              </div>
            </SheetHeader>

            <div className="flex flex-1 flex-col overflow-y-auto py-4">
              <p className="mb-2 px-6 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Navegação
              </p>
              <nav className="flex flex-col gap-1 px-3">
                {(overflow.length ? overflow : visibleItems).map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
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
            </div>

            <div className="border-t border-border px-4 py-4">
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-accent px-3 py-3">
                <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {user.role === 'super_admin' ? <Shield className="size-4" /> : <Building2 className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{user.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ROLE_LABELS[user.role] || user.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  {theme === 'dark' ? 'Claro' : 'Escuro'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                  onClick={() => logout()}
                >
                  <LogOut className="size-4" />
                  Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

function shortLabel(label: string): string {
  const map: Record<string, string> = {
    'Dashboard': 'Painel',
    'Controle de Produtos': 'Produtos',
    'Controle de Caixa': 'Caixa',
    'Contas a Receber': 'Receber',
    'Painel da Plataforma': 'Admin',
    'Gastos': 'Gastos',
    'Rotinas': 'Rotinas',
    'Equipe': 'Equipe',
  };
  return map[label] ?? label;
}
