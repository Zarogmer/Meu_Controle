'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  TrendingUp,
  Zap,
  Target,
  PlugZap,
  Send,
} from 'lucide-react';
import {
  Area,
  Bar,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { competenciaAtual, formatCompetenciaLonga, somarMeses } from '@/lib/contas';
import {
  type ContaCorretora,
  type ResumoInvestimentos,
  formatCentavos,
  formatResultado,
  corResultado,
  formatPercent,
  nativeSelectInline,
} from '@/components/investimentos/shared';
import { PosicoesTab } from '@/components/investimentos/PosicoesTab';
import { OperacoesTab } from '@/components/investimentos/OperacoesTab';
import { ImportarTab } from '@/components/investimentos/ImportarTab';
import { ContasTab } from '@/components/investimentos/ContasTab';

type Aba = 'posicoes' | 'operacoes' | 'importar' | 'contas';
const ABAS: { value: Aba; label: string }[] = [
  { value: 'posicoes', label: 'Posições' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'importar', label: 'Importar CSV' },
  { value: 'contas', label: 'Contas' },
];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className={`font-semibold ${corResultado(p.value)}`}>{formatResultado(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function InvestimentosPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [aba, setAba] = useState<Aba>('posicoes');
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [periodo, setPeriodo] = useState<'mes' | 'ano' | 'tudo'>('mes');
  const [contaFiltro, setContaFiltro] = useState('');
  const [contas, setContas] = useState<ContaCorretora[]>([]);
  const [resumo, setResumo] = useState<ResumoInvestimentos | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [abrirNova, setAbrirNova] = useState(0);

  useEffect(() => {
    if (!authLoading && user && user.role === 'employee') {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchContas = useCallback(async () => {
    try {
      const res = await fetch('/api/investimentos/contas', { credentials: 'include' });
      if (!res.ok) throw new Error();
      setContas((await res.json()).contas ?? []);
    } catch {
      toast.error('Erro ao carregar contas de corretora.');
    }
  }, []);

  const fetchResumo = useCallback(async () => {
    try {
      const params = new URLSearchParams({ competencia, periodo });
      if (contaFiltro) params.set('contaCorretoraId', contaFiltro);
      const res = await fetch(`/api/investimentos/resumo?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      setResumo(await res.json());
    } catch {
      toast.error('Erro ao carregar a carteira.');
    } finally {
      setLoading(false);
    }
  }, [competencia, periodo, contaFiltro]);

  useEffect(() => {
    if (user && user.role !== 'employee') {
      fetchContas();
    }
  }, [user, fetchContas]);

  useEffect(() => {
    if (user && user.role !== 'employee') {
      fetchResumo();
    }
  }, [user, fetchResumo, refreshKey]);

  const refreshAll = useCallback(() => {
    fetchContas();
    setRefreshKey((k) => k + 1);
  }, [fetchContas]);

  const pat = resumo?.patrimonio;
  const mes = resumo?.mes;
  const dt = resumo?.dayTrade.mes;
  const chartData = (resumo?.diario ?? []).map((d) => ({
    dia: periodo === 'mes' ? d.data.slice(8, 10) : d.data.slice(5, 10).split('-').reverse().join('/'),
    Resultado: d.resultado,
    Acumulado: d.acumulado,
  }));

  if (authLoading || (user && user.role === 'employee')) {
    return (
      <AppLayout>
        <Skeleton className="h-40 rounded-[2rem] bg-muted" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Investimentos</p>
            <h1 className="text-2xl font-bold tracking-tight">Carteira e resultados</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/investimentos/conexoes" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <PlugZap className="size-4" />
              Conexões
            </Link>
            <Link href="/investimentos/operar" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <Send className="size-4" />
              Operar
            </Link>
            <Button variant="outline" onClick={() => setAba('importar')}>Importar CSV</Button>
            <Button onClick={() => { setAba('operacoes'); setAbrirNova((n) => n + 1); }}>
              <Plus className="size-4" data-icon="inline-start" />
              Nova operação
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={() => setCompetencia((c) => somarMeses(c, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <button
              type="button"
              className="min-w-[11rem] rounded-full bg-muted px-4 py-1.5 text-center text-sm font-semibold hover:bg-muted/70"
              onClick={() => setCompetencia(competenciaAtual())}
            >
              {formatCompetenciaLonga(competencia)}
            </button>
            <Button variant="outline" size="icon-sm" onClick={() => setCompetencia((c) => somarMeses(c, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            {contas.length > 1 && (
              <select className={nativeSelectInline} value={contaFiltro} onChange={(e) => setContaFiltro(e.target.value)}>
                <option value="">Todas as contas</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-1.5">
            {ABAS.map((a) => (
              <Button key={a.value} variant={aba === a.value ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setAba(a.value)}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        {loading && !resumo ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-[2rem] bg-muted" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2.5"><Briefcase className="size-5 text-primary" /></div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-[#1A1D1F]">{formatCentavos(pat?.valorAtual ?? 0)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Patrimônio investido</p>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Custo das posições</span><span className="tabular-nums text-foreground">{formatCentavos(pat?.custoTotal ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Em aberto</span><span className={`tabular-nums font-semibold ${corResultado(pat?.resultadoNaoRealizado)}`}>{formatResultado(pat?.resultadoNaoRealizado ?? 0)}</span></div>
                  {(pat?.posicoesSemCotacao ?? 0) > 0 && <p className="text-[11px]">{pat?.posicoesSemCotacao} posição(ões) sem cotação, contadas pelo custo.</p>}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-50 p-2.5"><TrendingUp className="size-5 text-emerald-600" /></div>
                  <div className="min-w-0">
                    <p className={`text-2xl font-bold ${corResultado(mes?.resultado)}`}>{formatResultado(mes?.resultado ?? 0)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resultado do mês</p>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Operações</span><span className="tabular-nums text-foreground">{mes?.operacoes ?? 0}</span></div>
                  <div className="flex justify-between"><span>Taxas</span><span className="tabular-nums text-foreground">{formatCentavos(mes?.taxas ?? 0)}</span></div>
                  <div className="flex justify-between"><span>No ano</span><span className={`tabular-nums font-semibold ${corResultado(resumo?.anoResumo.total)}`}>{formatResultado(resumo?.anoResumo.total ?? 0)}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-violet-50 p-2.5"><Zap className="size-5 text-violet-600" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Day trade x Swing (mês)</p>
                    <p className="text-sm">
                      <span className={`text-xl font-bold ${corResultado(mes?.daytrade)}`}>{formatResultado(mes?.daytrade ?? 0)}</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className={`text-xl font-bold ${corResultado(mes?.swing)}`}>{formatResultado(mes?.swing ?? 0)}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Day trade no ano</span><span className={`tabular-nums font-semibold ${corResultado(resumo?.anoResumo.daytrade)}`}>{formatResultado(resumo?.anoResumo.daytrade ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Swing no ano</span><span className={`tabular-nums font-semibold ${corResultado(resumo?.anoResumo.swing)}`}>{formatResultado(resumo?.anoResumo.swing ?? 0)}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-50 p-2.5"><Target className="size-5 text-amber-600" /></div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-[#1A1D1F]">{dt && dt.trades > 0 ? formatPercent(dt.taxaAcerto) : '—'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Acerto no day trade (mês)</p>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Trades</span><span className="tabular-nums text-foreground">{dt?.trades ?? 0} ({dt?.vencedores ?? 0}✓ {dt?.perdedores ?? 0}✗)</span></div>
                  <div className="flex justify-between"><span>Payoff</span><span className="tabular-nums text-foreground">{dt?.payoff !== null && dt?.payoff !== undefined ? dt.payoff.toFixed(2) : '—'}</span></div>
                  <div className="flex justify-between"><span>Média ganho / perda</span><span className="tabular-nums text-foreground">{formatCentavos(dt?.mediaGanho ?? 0)} / {formatCentavos(Math.abs(dt?.mediaPerda ?? 0))}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resultado diário acumulado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {periodo === 'mes' ? formatCompetenciaLonga(competencia) : periodo === 'ano' ? `Ano de ${competencia.slice(0, 4)}` : 'Desde o início'}
                </p>
              </div>
              <div className="flex rounded-full bg-muted p-1">
                {(['mes', 'ano', 'tudo'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodo(p)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${periodo === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    {p === 'mes' ? 'Mês' : p === 'ano' ? 'Ano' : 'Tudo'}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                Nenhuma operação no período.
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} barSize={14}>
                    <defs>
                      <linearGradient id="acumFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dia" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={70}
                      tickFormatter={(v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(v / 100) >= 1000 ? `${(Math.abs(v) / 100000).toFixed(1)}k` : (Math.abs(v) / 100).toFixed(0)}`}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                    <Bar dataKey="Resultado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Area type="monotone" dataKey="Acumulado" stroke="#2563eb" strokeWidth={2.5} fill="url(#acumFill)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {aba === 'posicoes' && <PosicoesTab posicoes={resumo?.posicoes ?? []} onChanged={refreshAll} />}
        {aba === 'operacoes' && (
          <OperacoesTab contas={contas} contaFiltro={contaFiltro} refreshKey={refreshKey} onChanged={refreshAll} abrirNova={abrirNova} />
        )}
        {aba === 'importar' && <ImportarTab contas={contas} contaFiltro={contaFiltro} onImported={refreshAll} />}
        {aba === 'contas' && <ContasTab contas={contas} onChanged={refreshAll} />}
      </div>
    </AppLayout>
  );
}
