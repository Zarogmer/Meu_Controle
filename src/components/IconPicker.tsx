'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { icons as lucideIcons, type LucideIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Search, X, ChevronDown } from 'lucide-react';

// Build icon list once — filter out duplicates (Icon suffix variants)
const iconEntries: { name: string; component: LucideIcon }[] = [];
const seen = new Set<string>();
for (const [name, component] of Object.entries(lucideIcons)) {
  if (name.endsWith('Icon') || seen.has(name)) continue;
  seen.add(name);
  iconEntries.push({ name, component: component as LucideIcon });
}
iconEntries.sort((a, b) => a.name.localeCompare(b.name));

const PAGE_SIZE = 80;

interface IconPickerProps {
  value?: string;
  onChange?: (iconName: string) => void;
  placeholder?: string;
  className?: string;
}

export function IconPicker({ value, onChange, placeholder = 'Escolher icone...', className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loadMoreCount, setLoadMoreCount] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return iconEntries;
    const q = search.toLowerCase().replace(/[^a-z0-9]/g, '');
    return iconEntries.filter((e) =>
      e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q)
    );
  }, [search]);

  const visibleCount = loadMoreCount * PAGE_SIZE;
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setLoadMoreCount((prev) => {
        if (prev * PAGE_SIZE >= filtered.length) return prev;
        return prev + 1;
      });
    }
  }, [filtered.length]);

  const SelectedIcon = value ? (lucideIcons as Record<string, LucideIcon>)[value] : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground',
              className
            )}
          />
        }
      >
        <div className="flex items-center gap-2">
          {SelectedIcon ? (
            <>
              <SelectedIcon className="size-4" />
              <span className="text-sm">{value}</span>
            </>
          ) : (
            <span className="text-sm">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0"
        side="bottom"
        align="start"
      >
        {/* Search */}
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLoadMoreCount(1);
            }}
            placeholder="Buscar icone... (ex: cart, home, user)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setLoadMoreCount(1);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Count */}
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border">
          {filtered.length} icones encontrados
        </div>

        {/* Icon Grid */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="grid grid-cols-8 gap-0.5 p-2 max-h-[320px] overflow-y-auto"
        >
          {visible.map((entry) => {
            const Icon = entry.component;
            const isSelected = value === entry.name;
            return (
              <button
                key={entry.name}
                title={entry.name}
                onClick={() => {
                  onChange?.(entry.name);
                  setOpen(false);
                  setSearch('');
                  setLoadMoreCount(1);
                }}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150',
                  isSelected
                    ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="size-[18px]" />
              </button>
            );
          })}
          {visible.length === 0 && (
            <div className="col-span-8 py-8 text-center text-sm text-muted-foreground">
              Nenhum icone encontrado
            </div>
          )}
        </div>

        {/* Clear selection */}
        {value && (
          <div className="border-t border-border p-2">
            <button
              onClick={() => {
                onChange?.('');
                setOpen(false);
                setLoadMoreCount(1);
              }}
              className="w-full rounded-lg py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Limpar selecao
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Renders a Lucide icon by name.
 * Use this to display a dynamically selected icon.
 */
export function DynamicIcon({
  name,
  className,
  size,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const Icon = (lucideIcons as Record<string, LucideIcon>)[name];
  if (!Icon) return null;
  return <Icon className={className} size={size} />;
}
