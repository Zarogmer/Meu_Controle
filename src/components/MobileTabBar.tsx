'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Boxes, Receipt, ClipboardList, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/estoque', label: 'Estoque', icon: Boxes },
  { href: '/lancamentos', label: 'Vendas', icon: Receipt },
  { href: '/tarefas', label: 'Tarefas', icon: ClipboardList },
  { href: '/deficit', label: 'Conta', icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-[100] md:hidden">
      <div className="flex items-center justify-around bg-white/90 backdrop-blur-md rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.08)] h-[72px] px-2">
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
                    ? 'w-12 h-12 bg-[#1A1D1F] shadow-[0_4px_12px_rgba(26,29,31,0.3)]'
                    : 'w-10 h-10'
                )}
              >
                <Icon
                  size={isActive ? 22 : 20}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={cn(
                    'transition-all duration-300',
                    isActive ? 'text-white' : 'text-[#9A9FA5]'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold transition-all duration-300',
                  isActive ? 'text-[#1A1D1F] opacity-100' : 'text-[#9A9FA5] opacity-70'
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
