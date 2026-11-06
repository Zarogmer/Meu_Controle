'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ChartColumn } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { MESES_CURTOS } from '@/lib/contas';
import { type ResumoGastos, formatCentavos, nativeSelectClass } from './shared';

interface Props {
  anoInicial: string;
  /** Muda junto com o filtro de tipo da página (todos/empresa/pessoal). */
  tipo: 'todos' | 'pessoal' | 'empresa';
  /** Incrementa para forçar recarga (após salvar um gasto, por exemplo). */
  refreshKey: number;
}

function AnualTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold text-foreground">{formatCentavos(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function VisaoAnualTab({ anoInicial, tipo, refreshKey }: Props) {
  const [ano, setAno] = useState(anoInicial);
  const [resumo, setResumo] = useState<ResumoGastos | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoriaFoco, setCategoriaFoco] = useState<string>('');

  const fetchResumo = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ano });
      if (tipo !== 'todos') params.set('tipo', tipo);
      const res = await fetch(`/api/gastos/resumo?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      setResumo(await res.json());
    } catch {
      toast.error('Erro ao carregar a visão anual.');
    } finally {
      setLoading(false);
    }
  }, [ano, tipo]);

  useEffect(() => {
    fetchResumo();
  }, [fetchResumo, refreshKey]);

  const anual = resumo?.anual;
  const chartData = (anual?.porMes ?? []).map((m) => ({
    mes: MESES_CURTOS[m.mes - 1],
    Pago: m.pago,
    Pendente: m.pendente,
  }));

  const categoriaSelecionada = anual?.porCategoria.find((c) => c.categoria === categoriaFoco) ?? null;
  const chartCategoria = categoriaSelecionada
    ? categoriaSelecionada.porMes.map((v, i) => ({ mes: MESES_CURTOS[i], Pago: v }))
    : null;

  const anoNum = Number(ano);

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Visão anual</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading || !anual ? 'Carregando...' : (
                <>
                  Total pago em {ano}: <strong className="text-foreground">{formatCentavos(anual.totalPago)}</strong>
                  {anual.totalPendente > 0 && (
                    <> · pendente: <strong className="text-foreground">{formatCentavos(anual.totalPendente)}</strong></>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={() => setAno(String(anoNum - 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[4ch] text-center text-lg font-semibold tabular-nums">{ano}</span>
            <Button variant="outline" size="icon-sm" onClick={() => setAno(String(anoNum + 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !resumo ? (
            <Skeleton className="h-64 w-full rounded-xl bg-muted" />
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {categoriaSelecionada ? `${categoriaSelecionada.categoria} por mês` : 'Gastos por mês'}
                </p>
                <select
                  className={`${nativeSelectClass} sm:w-56`}
                  value={categoriaFoco}
                  onChange={(e) => setCategoriaFoco(e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {(anual?.porCategoria ?? []).map((c) => (
                    <option key={c.categoria} value={c.categoria}>{c.categoria}</option>
                  ))}
                </select>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCategoria ?? chartData} barSize={22}>
                    <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                      tickFormatter={(v: number) => `R$ ${(v / 100 >= 1000 ? `${(v / 100000).toFixed(1)}k` : (v / 100).toFixed(0))}`}
                    />
                    <Tooltip content={<AnualTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                    {!chartCategoria && <Legend wrapperStyle={{ fontSize: 12 }} />}
                    <Bar dataKey="Pago" stackId="a" fill="#2563eb" radius={chartCategoria ? [8, 8, 0, 0] : [0, 0, 0, 0]} />
                    {!chartCategoria && <Bar dataKey="Pendente" stackId="a" fill="#f59e0b" radius={[8, 8, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
        <CardHeader>
          <CardTitle>Total pago por categoria em {ano}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !resumo ? (
            <Skeleton className="h-40 w-full rounded-xl bg-muted" />
          ) : (anual?.porCategoria ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ChartColumn className="size-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Nenhum gasto pago em {ano}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">Categoria</TableHead>
                    {MESES_CURTOS.map((m) => (
                      <TableHead key={m} className="text-right">{m}</TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(anual?.porCategoria ?? []).map((c) => (
                    <TableRow
                      key={c.categoria}
                      className={`cursor-pointer ${categoriaFoco === c.categoria ? 'bg-primary/5' : ''}`}
                      onClick={() => setCategoriaFoco(categoriaFoco === c.categoria ? '' : c.categoria)}
                    >
                      <TableCell className="sticky left-0 bg-card font-medium">{c.categoria}</TableCell>
                      {c.porMes.map((v, i) => (
                        <TableCell key={i} className="text-right tabular-nums text-muted-foreground">
                          {v > 0 ? (v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold tabular-nums">{formatCentavos(c.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="sticky left-0 bg-card font-bold">Total</TableCell>
                    {(anual?.porMes ?? []).map((m) => (
                      <TableCell key={m.mes} className="text-right font-semibold tabular-nums">
                        {m.pago > 0 ? (m.pago / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold tabular-nums">{formatCentavos(anual?.totalPago ?? 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">Valores em reais, sem centavos. Clique numa categoria para ver só ela no gráfico.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
