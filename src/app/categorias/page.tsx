'use client';

import { useCallback, useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Categoria {
  id: number;
  nome: string;
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategorias = useCallback(async () => {
    try {
      const response = await fetch('/api/categorias', { credentials: 'include' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setCategorias(data.categorias ?? []);
    } catch {
      toast.error('Erro ao carregar as categorias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Categorias padrão
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Lista de categorias da plataforma</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            As categorias de produtos agora são padronizadas para manter a operação mais organizada.
          </p>
        </div>

        <Card className="rounded-[2rem] border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Categorias disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-2xl bg-muted" />
                ))}
              </div>
            ) : categorias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Layers className="size-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">
                  Nenhuma categoria encontrada.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {categorias.map((categoria) => (
                  <div
                    key={categoria.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Layers className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{categoria.nome}</p>
                      <Badge variant="secondary" className="mt-1">
                        Padrão
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
