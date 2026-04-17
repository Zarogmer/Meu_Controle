'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import {
  Boxes, CircleDollarSign, ShoppingBag, TrendingUp,
  ChevronLeft, ChevronRight, ChevronRight as ChevronR,
  AlertCircle, PackagePlus, Receipt, Wallet, Flame,
  ArrowUpRight, ArrowDownRight, Clock, ClipboardList,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer,
  BarChart, Bar, XAxis, Tooltip,
} from 'recharts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtCompact(centavos: number): string {
  const v = centavos / 100;
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return fmt(centavos);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '--/--';

  if (value.includes('/')) {
    return value;
  }

  const isoDate = value.includes('T') ? value.split('T')[0] : value;
  const parts = isoDate.split('-');

  if (parts.length !== 3) {
    return value;
  }

  const [, m, day] = parts;
  return `${day}/${m}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['SE', 'TE', 'QU', 'QU', 'SE', 'SA', 'DO'];

type Periodo = 'semana' | 'mes' | 'trimestre';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Resumo {
  totalProdutos: number;
  valorEstoque: number;
  totalVendasPeriodo: number;
  lucroPeriodo: number;
}

interface WidgetData {
  metaDiaria: {
    percentual: number;
    maxPercent: number;
    vendasHoje: number;
    mediaDiaria: number;
    grafico: { dia: string; total: number }[];
  };
  faturamento: {
    total: number;
    variacao: number;
    grafico: { dia: string; total: number }[];
  };
  calendario: {
    mes: number;
    ano: number;
    diaAtual: number;
    diasComVenda: number[];
  };
}

interface EstoqueBaixo { id: number; nome: string; quantidade: number; precoVenda: number }
interface TopProduto { nome: string; totalVendido: number; faturamento: number }
interface UltimaVenda { id: number; produtoNome: string; quantidade: number; total: number; dataVenda: string }
interface TarefaPendente { id: number; titulo: string; prioridade: string }
interface TarefasPendentesData { total: number; tarefas: TarefaPendente[] }
interface LancamentoRecente { id: number; descricao: string; valor: number; status: string; dataLancamento: string; tipo: string; clienteNome: string | null }
interface LancamentosRecentesData { lancamentos: LancamentoRecente[] }

interface DividaResumo {
  totalAReceber: number;
  totalDevedores: number;
  dividasVencidas: number;
  valorVencido: number;
  dividasHoje: number;
  dividasProximos7Dias: number;
  devedoresRecentes: { nome: string; valor: number; vencimento: string; status: string }[];
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

const ttStyle = {
  backgroundColor: '#ffffff',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  padding: '8px 14px',
};

function MiniTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (active && payload?.length) {
    return <div className="px-2.5 py-1.5 text-xs font-semibold text-[#1A1D1F]" style={ttStyle}>{fmt(payload[0].value)}</div>;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CalendarWidget({ data }: { data: WidgetData['calendario'] | null }) {
  const [offset, setOffset] = useState(0);

  const { dias, nomeMes, diaAtual, diasComVenda } = useMemo(() => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const m = target.getMonth();
    const y = target.getFullYear();
    const total = new Date(y, m + 1, 0).getDate();
    const first = new Date(y, m, 1).getDay();
    const off = first === 0 ? 6 : first - 1;

    const cells: (number | null)[] = [];
    for (let i = 0; i < off; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const isCur = data && m === data.mes && y === data.ano;
    return {
      dias: cells,
      nomeMes: `${MESES_NOME[m]}, ${y}`,
      diaAtual: isCur ? data.diaAtual : -1,
      diasComVenda: isCur ? data.diasComVenda : [],
    };
  }, [offset, data]);

  return (
    <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setOffset(o => o - 1)} className="text-[#9A9FA5] hover:text-[#1A1D1F] transition-colors p-1">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold text-[#1A1D1F]">{nomeMes}</p>
        <button onClick={() => setOffset(o => o + 1)} className="text-[#9A9FA5] hover:text-[#1A1D1F] transition-colors p-1">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-gray-400 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {dias.map((dia, i) => {
          if (!dia) return <div key={i} />;
          const isToday = dia === diaAtual;
          const hasSale = diasComVenda.includes(dia);
          return (
            <div key={i} className={`flex items-center justify-center text-[11px] rounded-md h-7 ${
              isToday ? 'bg-[#1A1D1F] text-white font-bold'
              : hasSale ? 'bg-[#C1B8FF]/15 text-[#C1B8FF] font-medium'
              : 'text-gray-400'
            }`}>
              {dia}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user, fetchWithAuth, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [widgets, setWidgets] = useState<WidgetData | null>(null);
  const [estoqueBaixo, setEstoqueBaixo] = useState<EstoqueBaixo[]>([]);
  const [topProdutos, setTopProdutos] = useState<TopProduto[]>([]);
  const [ultimasVendas, setUltimasVendas] = useState<UltimaVenda[]>([]);
  const [dividas, setDividas] = useState<DividaResumo | null>(null);
  const [vendasSemana, setVendasSemana] = useState<{ semana: string; total: number }[]>([]);
  const [tarefasPendentes, setTarefasPendentes] = useState<TarefasPendentesData | null>(null);
  const [lancamentosRecentes, setLancamentosRecentes] = useState<LancamentosRecentesData | null>(null);
  const [loading, setLoading] = useState(true);

  // Super admin sem loja vinculada → redireciona para o painel admin
  useEffect(() => {
    if (user && isSuperAdmin && !user.lojaId) {
      router.replace('/admin');
    }
  }, [user, isSuperAdmin, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `periodo=${periodo}`;
      const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
        fetchWithAuth(`/api/dashboard/resumo?${qs}`),
        fetchWithAuth('/api/dashboard/widgets'),
        fetchWithAuth('/api/dashboard/estoque-baixo'),
        fetchWithAuth('/api/dashboard/top-produtos'),
        fetchWithAuth('/api/dashboard/ultimas-vendas'),
        fetchWithAuth('/api/dashboard/dividas-resumo'),
        fetchWithAuth(`/api/dashboard/vendas-semana?${qs}`),
        fetchWithAuth('/api/dashboard/tarefas-pendentes'),
        fetchWithAuth('/api/dashboard/lancamentos-recentes'),
      ]);
      if (r1.ok) setResumo(await r1.json());
      if (r2.ok) setWidgets(await r2.json());
      if (r3.ok) { const d = await r3.json(); setEstoqueBaixo(d.produtos ?? []); }
      if (r4.ok) { const d = await r4.json(); setTopProdutos(d.produtos ?? []); }
      if (r5.ok) { const d = await r5.json(); setUltimasVendas(d.vendas ?? []); }
      if (r6.ok) setDividas(await r6.json());
      if (r7.ok) { const d = await r7.json(); setVendasSemana(d.vendas ?? []); }
      if (r8.ok) setTarefasPendentes(await r8.json());
      if (r9.ok) setLancamentosRecentes(await r9.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, [periodo, fetchWithAuth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <AppLayout>
      <div className="space-y-4 p-1">
        <Skeleton className="h-12 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-[260px] rounded-2xl" />
        <Skeleton className="h-[200px] rounded-2xl" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ================================================================ */}
        {/* 1. CABECALHO DA LOJA                                             */}
        {/* ================================================================ */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#1A1D1F]/40">{getGreeting()},</p>
            <h1 className="text-3xl font-bold tracking-tight text-[#1A1D1F]">{user?.nomeLoja ?? 'Minha Loja'}</h1>
          </div>
          <div className="flex items-center bg-white rounded-full p-0.5 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            {(['semana', 'mes', 'trimestre'] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-4 py-2 min-h-[40px] rounded-full text-[11px] font-bold transition-all ${
                  periodo === p
                    ? 'bg-[#1A1D1F] text-white shadow-sm'
                    : 'text-[#9A9FA5]'
                }`}
              >
                {p === 'semana' ? '7D' : p === 'mes' ? '30D' : '90D'}
              </button>
            ))}
          </div>
        </div>

        {/* ================================================================ */}
        {/* 2. CARDS PRINCIPAIS                                               */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MiniCard
            label="Faturamento"
            value={fmtCompact(resumo?.totalVendasPeriodo ?? 0)}
            icon={<CircleDollarSign className="size-4" />}
            trend={widgets?.faturamento.variacao}
            color="blue"
          />
          <MiniCard
            label="Lucro"
            value={fmtCompact(resumo?.lucroPeriodo ?? 0)}
            icon={<TrendingUp className="size-4" />}
            color="emerald"
          />
          <MiniCard
            label="Estoque"
            value={fmtCompact(resumo?.valorEstoque ?? 0)}
            icon={<Boxes className="size-4" />}
            sub={`${resumo?.totalProdutos ?? 0} itens`}
            color="blue"
          />
          <MiniCard
            label="A Receber"
            value={fmtCompact(dividas?.totalAReceber ?? 0)}
            icon={<Wallet className="size-4" />}
            sub={`${dividas?.totalDevedores ?? 0} devedores`}
            color="amber"
            alert={dividas ? dividas.dividasVencidas > 0 : undefined}
          />
        </div>

        {/* ================================================================ */}
        {/* 3. HERO WIDGETS — Meta + Faturamento + Calendario                */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meta Diaria — mountain chart */}
          <div className="relative overflow-hidden rounded-[2.5rem] lg:col-span-1 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            <div className="relative z-10 flex items-center justify-between p-8 pb-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Meta Diaria</p>
              <span className="text-[10px] text-[#C1B8FF] hover:underline cursor-pointer">Detalhes &rsaquo;</span>
            </div>
            <div className="relative z-0 mt-1" style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart
                  data={(widgets?.metaDiaria.grafico ?? []).map(d => ({
                    ...d, l2: d.total * 0.7, l3: d.total * 0.45,
                  }))}
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C1B8FF" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#C1B8FF" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C1B8FF" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#C1B8FF" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="m3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C1B8FF" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#C1B8FF" stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <Area type="basis" dataKey="total" stroke="none" fill="url(#m1)" />
                  <Area type="basis" dataKey="l2" stroke="none" fill="url(#m2)" />
                  <Area type="basis" dataKey="l3" stroke="none" fill="url(#m3)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="relative z-10 flex items-end justify-between px-8 pb-8 -mt-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Atual</p>
                <p className="text-4xl font-bold text-[#1A1D1F]">
                  {widgets?.metaDiaria.percentual ?? 0}<span className="text-base text-[#9A9FA5]">%</span>
                </p>
              </div>
              <p className="text-xs text-[#9A9FA5] font-medium">Max. {widgets?.metaDiaria.maxPercent ?? 0}%</p>
            </div>
          </div>

          {/* Faturamento — line */}
          <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8 flex flex-col lg:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Faturamento</p>
              <span className="text-[10px] text-[#C1B8FF] hover:underline cursor-pointer">Detalhes &rsaquo;</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-3xl font-bold text-[#1A1D1F]">{fmt(widgets?.faturamento.total ?? 0)}</p>
              {(widgets?.faturamento.variacao ?? 0) !== 0 && (
                <span className={`text-xs font-bold ${(widgets?.faturamento.variacao ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {(widgets?.faturamento.variacao ?? 0) >= 0 ? '\u2191' : '\u2193'} {Math.abs(widgets?.faturamento.variacao ?? 0)}%
                </span>
              )}
            </div>
            <div className="flex-1 -mx-2 min-h-0 pt-2">
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={widgets?.faturamento.grafico ?? []} barSize={14}>
                  <XAxis
                    dataKey="dia"
                    tick={{ fill: '#9A9FA5', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<MiniTooltip />} cursor={{ fill: 'rgba(193,184,255,0.06)' }} />
                  <Bar
                    dataKey="total"
                    radius={[10, 10, 0, 0]}
                    fill="#C1B8FF"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => {
                      const data = widgets?.faturamento.grafico ?? [];
                      const isLast = props.index === data.length - 1;
                      return (
                        <rect
                          x={props.x}
                          y={props.y}
                          width={props.width}
                          height={props.height}
                          rx={10}
                          fill={isLast ? '#1A1D1F' : '#C1B8FF'}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-1 mt-1">
              {['1H', '1D', '1M', '1Y'].map(p => (
                <span key={p} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p === '1Y' ? 'bg-[#C1B8FF]/10 text-[#C1B8FF]' : 'text-gray-400'}`}>{p}</span>
              ))}
            </div>
          </div>

          {/* Calendario */}
          <CalendarWidget data={widgets?.calendario ?? null} />
        </div>

        {/* ================================================================ */}
        {/* 4. ALERTAS OPERACIONAIS                                          */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Estoque Baixo */}
          <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <AlertCircle className="size-3.5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Estoque Baixo</p>
              </div>
              <Link href="/estoque" className="text-[10px] text-[#C1B8FF] hover:underline">Ver tudo &rsaquo;</Link>
            </div>
            <div className="space-y-2">
              {estoqueBaixo.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <p className="text-sm text-foreground truncate flex-1 mr-2">{p.nome}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    p.quantidade <= 3 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-500'
                  }`}>
                    {p.quantidade} un
                  </span>
                </div>
              ))}
              {estoqueBaixo.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Estoque OK</p>
              )}
            </div>
          </div>

          {/* Devedores */}
          <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="size-3.5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Cobrancas</p>
              </div>
              <Link href="/deficit" className="text-[10px] text-[#C1B8FF] hover:underline">Ver tudo &rsaquo;</Link>
            </div>
            {dividas && dividas.dividasVencidas > 0 && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-red-50">
                <AlertCircle className="size-3 text-red-500 shrink-0" />
                <p className="text-[11px] text-red-600 font-medium">
                  {dividas.dividasVencidas} divida{dividas.dividasVencidas > 1 ? 's' : ''} vencida{dividas.dividasVencidas > 1 ? 's' : ''} ({fmt(dividas.valorVencido)})
                </p>
              </div>
            )}
            <div className="space-y-2">
              {(dividas?.devedoresRecentes ?? []).slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm truncate">{d.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(d.vencimento)}</p>
                  </div>
                  <span className={`text-xs font-bold ${
                    d.status === 'vencida' ? 'text-red-500' : d.status === 'parcial' ? 'text-amber-500' : 'text-gray-500'
                  }`}>
                    {fmt(d.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tarefas Pendentes */}
          <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C1B8FF]/10 text-[#C1B8FF]">
                  <ClipboardList className="size-3.5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Tarefas Pendentes</p>
              </div>
              <Link href="/tarefas" className="text-[10px] text-[#C1B8FF] hover:underline">Ver tudo &rsaquo;</Link>
            </div>
            {tarefasPendentes && tarefasPendentes.total > 0 && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-[#C1B8FF]/10">
                <ClipboardList className="size-3 text-[#C1B8FF] shrink-0" />
                <p className="text-[11px] text-[#C1B8FF] font-medium">
                  {tarefasPendentes.total} tarefa{tarefasPendentes.total > 1 ? 's' : ''} pendente{tarefasPendentes.total > 1 ? 's' : ''}
                </p>
              </div>
            )}
            <div className="space-y-2">
              {(tarefasPendentes?.tarefas ?? []).map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <p className="text-sm truncate flex-1 mr-2">{t.titulo}</p>
                  <span className={`inline-block size-2 rounded-full shrink-0 ${
                    t.prioridade === 'alta' ? 'bg-red-500' : t.prioridade === 'media' ? 'bg-amber-500' : 'bg-[#C1B8FF]'
                  }`} />
                </div>
              ))}
              {(!tarefasPendentes || tarefasPendentes.total === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa pendente</p>
              )}
            </div>
          </div>

          {/* Lancamentos Recentes */}
          <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Lancamentos</p>
              <Link href="/lancamentos" className="text-[10px] font-medium text-[#C1B8FF] hover:underline">Ver tudo &rsaquo;</Link>
            </div>
            <div className="space-y-1">
              {(lancamentosRecentes?.lancamentos ?? []).slice(0, 3).map((l) => {
                const statusConfig = l.status === 'pago'
                  ? { label: 'Pago', cls: 'bg-emerald-50 text-emerald-600' }
                  : l.status === 'aguardando_pagamento'
                  ? { label: 'Pendente', cls: 'bg-amber-50 text-amber-600' }
                  : { label: 'Em Processo', cls: 'bg-[#C1B8FF]/10 text-[#C1B8FF]' };
                const initials = (l.clienteNome || l.descricao).slice(0, 2).toUpperCase();
                return (
                  <div key={l.id} className="flex items-center gap-4 py-3 px-4 -mx-4 rounded-2xl transition-colors hover:bg-gray-50/50 cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-[#FED97B]/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-amber-700">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1D1F] truncate">{l.descricao}</p>
                      <p className="text-[11px] text-gray-400">{l.clienteNome || l.tipo} &middot; {fmtDate(l.dataLancamento)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-sm font-bold text-[#1A1D1F]">{fmt(l.valor)}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig.cls}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                );
              })}
              {(!lancamentosRecentes || lancamentosRecentes.lancamentos.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum lancamento</p>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 5. VENDAS — mini bar chart + top produtos                        */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Vendas Semana — compact bar chart */}
          <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Vendas Semanal</p>
              <span className="text-[10px] text-[#C1B8FF] hover:underline cursor-pointer">Detalhes &rsaquo;</span>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={vendasSemana} barSize={32}>
                <XAxis
                  dataKey="semana"
                  tickFormatter={v => `S${v}`}
                  tick={{ fill: '#9A9FA5', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MiniTooltip />} cursor={{ fill: 'rgba(193,184,255,0.06)' }} />
                <Bar
                  dataKey="total"
                  radius={[10, 10, 0, 0]}
                  fill="#C1B8FF"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  shape={(props: any) => {
                    const isLast = props.index === vendasSemana.length - 1;
                    return (
                      <rect
                        x={props.x}
                        y={props.y}
                        width={props.width}
                        height={props.height}
                        rx={10}
                        fill={isLast ? '#1A1D1F' : '#C1B8FF'}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Produtos */}
          <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C1B8FF]/10 text-[#C1B8FF]">
                  <Flame className="size-3.5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Mais Vendidos</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {topProdutos.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-muted-foreground/50 w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{p.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{p.totalVendido} vendidos</p>
                  </div>
                  <p className="text-xs font-bold text-[#1A1D1F]">{fmtCompact(p.faturamento)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 6. TRANSACOES RECENTES                                           */}
        {/* ================================================================ */}
        <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Transacoes Recentes</p>
            <Link href="/estoque" className="text-[10px] font-medium text-[#C1B8FF] hover:underline">Ver tudo &rsaquo;</Link>
          </div>
          <div className="space-y-1">
            {ultimasVendas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhuma transacao recente</p>
            ) : (
              ultimasVendas.map((v) => (
                <div key={v.id} className="flex items-center gap-4 py-3 px-4 -mx-4 rounded-2xl transition-colors hover:bg-gray-50/50 cursor-pointer">
                  {/* Avatar com iniciais */}
                  <div className="w-10 h-10 rounded-full bg-[#C1B8FF]/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#C1B8FF]">
                      {v.produtoNome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1D1F] truncate">{v.produtoNome}</p>
                    <p className="text-[11px] text-gray-400">{v.quantidade}x &middot; {fmtDate(v.dataVenda)}</p>
                  </div>
                  {/* Valor + Badge */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-bold text-[#1A1D1F]">{fmt(v.total)}</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                      Pago
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* 7. ACOES RAPIDAS                                                  */}
        {/* ================================================================ */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <QuickAction href="/estoque" icon={<PackagePlus className="size-5" />} label="Novo Produto" color="blue" />
          <QuickAction href="/estoque" icon={<ShoppingBag className="size-5" />} label="Registrar Venda" color="blue" />
          <QuickAction href="/deficit" icon={<Wallet className="size-5" />} label="Nova Divida" color="amber" />
          <QuickAction href="/tarefas" icon={<ClipboardList className="size-5" />} label="Nova Tarefa" color="blue" />
          <QuickAction href="/lancamentos" icon={<Receipt className="size-5" />} label="Novo Lancamento" color="emerald" />
          <QuickAction href="/estoque" icon={<Boxes className="size-5" />} label="Ver Estoque" color="emerald" />
        </div>

      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Mini Card (2x2 grid)
// ---------------------------------------------------------------------------

const miniColors = {
  blue: 'bg-[#1A1D1F] text-white',
  emerald: 'bg-emerald-500 text-white',
  violet: 'bg-[#C1B8FF] text-[#1A1D1F]',
  amber: 'bg-[#FED97B] text-[#1A1D1F]',
};

function MiniCard({ label, value, icon, trend, sub, color, alert: hasAlert }: {
  label: string; value: string; icon: React.ReactNode;
  trend?: number; sub?: string; color: keyof typeof miniColors; alert?: boolean;
}) {
  return (
    <div className={`bg-white p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col justify-between min-h-[160px] transition-all hover:shadow-md ${hasAlert ? 'ring-1 ring-red-500/30' : ''}`}>
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${miniColors[color]}`}>{icon}</div>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-bold mb-1">
          {sub ?? label}
        </p>
        <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Action
// ---------------------------------------------------------------------------

function QuickAction({ href, icon, label, color }: {
  href: string; icon: React.ReactNode; label: string; color: keyof typeof miniColors;
}) {
  return (
    <Link href={href} className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem] p-8 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]">
      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${miniColors[color]}`}>{icon}</div>
      <p className="text-[11px] font-semibold text-[#9A9FA5]">{label}</p>
    </Link>
  );
}
