'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Boxes, Receipt, ClipboardList, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/estoque', label: 'Produtos', icon: Boxes },
  { href: '/lancamentos', label: 'Caixa', icon: Receipt },
  { href: '/tarefas', label: 'Rotinas', icon: ClipboardList },
  { href: '/deficit', label: 'Receber', icon: Wallet },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-[100] md:hidden">
      <div className="flex h-[72px] items-center justify-around rounded-full bg-card/90 px-2 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-md transition-colors">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 transition-all duration-300 ease-out"
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-full transition-all duration-300 ease-out',
                  isActive
                    ? 'h-12 w-12 bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(37,99,235,0.28)]'
                    : 'w-10 h-10'
                )}
              >
                <Icon
                  size={isActive ? 22 : 20}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={cn(
                    'transition-all duration-300',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold transition-all duration-300',
                  isActive ? 'text-foreground opacity-100' : 'text-muted-foreground opacity-70'
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
