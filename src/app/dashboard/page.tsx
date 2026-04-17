'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Flame,
  PackagePlus,
  Receipt,
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Boxes,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';

function fmt(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtCompact(centavos: number): string {
  const value = centavos / 100;
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return fmt(centavos);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '--/--';
  if (value.includes('/')) return value;

  const isoDate = value.includes('T') ? value.split('T')[0] : value;
  const parts = isoDate.split('-');
  if (parts.length !== 3) return value;

  const [, month, day] = parts;
  return `${day}/${month}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEK_DAYS = ['SE', 'TE', 'QU', 'QU', 'SE', 'SA', 'DO'];

type Periodo = 'semana' | 'mes' | 'trimestre';

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

interface EstoqueBaixo {
  id: number;
  nome: string;
  quantidade: number;
}

interface TopProduto {
  nome: string;
  totalVendido: number;
  faturamento: number;
}

interface UltimaVenda {
  id: number;
  produtoNome: string;
  quantidade: number;
  total: number;
  dataVenda: string;
}

interface TarefaPendente {
  id: number;
  titulo: string;
  prioridade: string;
}

interface TarefasPendentesData {
  total: number;
  tarefas: TarefaPendente[];
}

interface LancamentoRecente {
  id: number;
  descricao: string;
  valor: number;
  status: string;
  dataLancamento: string;
  tipo: string;
  clienteNome: string | null;
}

interface LancamentosRecentesData {
  lancamentos: LancamentoRecente[];
}

interface DividaResumo {
  totalAReceber: number;
  totalDevedores: number;
  dividasVencidas: number;
  valorVencido: number;
  devedoresRecentes: { nome: string; valor: number; vencimento: string; status: string }[];
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-lg">
      {fmt(payload[0].value)}
    </div>
  );
}

function CalendarWidget({ data }: { data: WidgetData['calendario'] | null }) {
  const [offset, setOffset] = useState(0);

  const { days, monthName, dayToday, daysWithSales } = useMemo(() => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const month = target.getMonth();
    const year = target.getFullYear();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const adjustedOffset = firstDay === 0 ? 6 : firstDay - 1;

    const cells: (number | null)[] = [];
    for (let i = 0; i < adjustedOffset; i += 1) cells.push(null);
    for (let day = 1; day <= totalDays; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    const isCurrentMonth = data && month === data.mes && year === data.ano;
    return {
      days: cells,
      monthName: `${MONTH_NAMES[month]}, ${year}`,
      dayToday: isCurrentMonth ? data.diaAtual : -1,
      daysWithSales: isCurrentMonth ? data.diasComVenda : [],
    };
  }, [offset, data]);

  return (
    <div className="content-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Agenda do período
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">{monthName}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((value) => value - 1)}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setOffset((value) => value + 1)}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          if (!day) return <div key={index} className="h-9" />;

          const isToday = day === dayToday;
          const hasSales = daysWithSales.includes(day);
          return (
            <div
              key={index}
              className={[
                'flex h-9 items-center justify-center rounded-xl text-xs transition-colors',
                isToday
                  ? 'bg-primary font-bold text-primary-foreground'
                  : hasSales
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground',
              ].join(' ')}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  useEffect(() => {
    if (user && isSuperAdmin && !user.lojaId) {
      router.replace('/admin');
    }
  }, [user, isSuperAdmin, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `periodo=${periodo}`;
      const [resumoRes, widgetsRes, estoqueRes, topRes, vendasRes, dividasRes, semanaRes, tarefasRes, lancamentosRes] = await Promise.all([
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

      if (resumoRes.ok) setResumo(await resumoRes.json());
      if (widgetsRes.ok) setWidgets(await widgetsRes.json());
      if (estoqueRes.ok) setEstoqueBaixo((await estoqueRes.json()).produtos ?? []);
      if (topRes.ok) setTopProdutos((await topRes.json()).produtos ?? []);
      if (vendasRes.ok) setUltimasVendas((await vendasRes.json()).vendas ?? []);
      if (dividasRes.ok) setDividas(await dividasRes.json());
      if (semanaRes.ok) setVendasSemana((await semanaRes.json()).vendas ?? []);
      if (tarefasRes.ok) setTarefasPendentes(await tarefasRes.json());
      if (lancamentosRes.ok) setLancamentosRecentes(await lancamentosRes.json());
    } catch {
      // silent by design for dashboard
    } finally {
      setLoading(false);
    }
  }, [periodo, fetchWithAuth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-36 rounded-[2rem] bg-muted" />
          <div className="grid gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-32 rounded-[2rem] bg-muted" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 rounded-[2rem] bg-muted lg:col-span-2" />
            <Skeleton className="h-80 rounded-[2rem] bg-muted" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-[2rem] bg-muted" />
            <Skeleton className="h-72 rounded-[2rem] bg-muted" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(14,165,233,0.06))] p-7">
            <div className="relative z-10 max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <BriefcaseBusiness className="size-3.5" />
                Visao geral
              </div>
              <p className="text-sm text-muted-foreground">{getGreeting()}, {user?.nome?.split(' ')[0] || 'gestor'}.</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                Controle do negócio em um único painel
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                Acompanhe o desempenho da operação, confira o caixa do período e veja onde sua loja precisa de atenção agora.
              </p>
            </div>
            <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 hidden rounded-tl-[2rem] border-l border-t border-white/40 bg-white/45 px-5 py-4 backdrop-blur md:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Loja ativa</p>
              <p className="mt-1 text-base font-semibold text-foreground">{user?.nomeLoja || 'Minha Loja'}</p>
            </div>
          </div>

          <div className="content-card flex flex-col justify-between p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Janela de analise
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">Período de acompanhamento</p>
              </div>
              <CalendarDays className="size-5 text-primary" />
            </div>
            <div className="mt-5 flex rounded-2xl bg-muted p-1">
              {(['semana', 'mes', 'trimestre'] as Periodo[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setPeriodo(item)}
                  className={[
                    'flex-1 rounded-[1rem] px-3 py-3 text-sm font-medium transition-all',
                    periodo === item
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {item === 'semana' ? '7 dias' : item === 'mes' ? '30 dias' : '90 dias'}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Use este filtro para revisar desempenho recente, movimentacoes e ritmo operacional.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            label="Entradas no período"
            value={fmtCompact(resumo?.totalVendasPeriodo ?? 0)}
            helper={(widgets?.faturamento.variacao ?? 0) >= 0 ? 'Crescimento no ritmo atual' : 'Abaixo do período anterior'}
            icon={<CircleDollarSign className="size-5" />}
            tone="blue"
            trend={widgets?.faturamento.variacao}
          />
          <OverviewCard
            label="Resultado estimado"
            value={fmtCompact(resumo?.lucroPeriodo ?? 0)}
            helper="Leitura de margem do período"
            icon={<TrendingUp className="size-5" />}
            tone="green"
          />
          <OverviewCard
            label="Capital em produtos"
            value={fmtCompact(resumo?.valorEstoque ?? 0)}
            helper={`${resumo?.totalProdutos ?? 0} itens em controle`}
            icon={<Boxes className="size-5" />}
            tone="slate"
          />
          <OverviewCard
            label="Contas a receber"
            value={fmtCompact(dividas?.totalAReceber ?? 0)}
            helper={`${dividas?.totalDevedores ?? 0} clientes com saldo aberto`}
            icon={<Wallet className="size-5" />}
            tone="amber"
            alert={Boolean(dividas?.dividasVencidas)}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_1.15fr_0.8fr]">
          <div className="content-card p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Ritmo operacional
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Evolução diária da operação
                </h2>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {widgets?.metaDiaria.percentual ?? 0}% da meta
              </span>
            </div>
            <div className="mb-6 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={widgets?.metaDiaria.grafico ?? []}>
                  <defs>
                    <linearGradient id="metaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#2563eb', strokeOpacity: 0.15 }} />
                  <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} fill="url(#metaFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricPill label="Ritmo atual" value={`${widgets?.metaDiaria.percentual ?? 0}%`} />
              <MetricPill label="Movimento de hoje" value={fmt(widgets?.metaDiaria.vendasHoje ?? 0)} />
              <MetricPill label="Média diária" value={fmt(widgets?.metaDiaria.mediaDiaria ?? 0)} />
            </div>
          </div>

          <div className="content-card p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Desempenho do caixa
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Movimento do período
                </h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${(widgets?.faturamento.variacao ?? 0) >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                {(widgets?.faturamento.variacao ?? 0) >= 0 ? '+' : '-'}
                {Math.abs(widgets?.faturamento.variacao ?? 0)}%
              </span>
            </div>
            <div className="mb-2 flex items-end gap-2">
              <p className="text-3xl font-bold text-foreground">{fmt(widgets?.faturamento.total ?? 0)}</p>
              <p className="pb-1 text-sm text-muted-foreground">no período analisado</p>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={widgets?.faturamento.grafico ?? []} barSize={18}>
                  <XAxis dataKey="dia" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                  <Bar dataKey="total" radius={[10, 10, 0, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <CalendarWidget data={widgets?.calendario ?? null} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ListCard
            title="Produtos com atenção"
            subtitle="Itens com nivel baixo ou que merecem acompanhamento"
            icon={<ShieldAlert className="size-4" />}
            action={{ href: '/estoque', label: 'Abrir controle de produtos' }}
            emptyMessage="Nenhum produto exige atenção agora."
            items={estoqueBaixo.slice(0, 4).map((item) => ({
              id: item.id,
              title: item.nome,
              meta: `${item.quantidade} unidade(s) em estoque`,
              badge: item.quantidade <= 3 ? 'Critico' : 'Baixo',
              badgeTone: item.quantidade <= 3 ? 'red' : 'amber',
            }))}
          />

          <div className="content-card p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Contas a receber
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Clientes com saldo em aberto
                </h2>
              </div>
              <Link href="/deficit" className="text-sm font-medium text-primary hover:underline">
                Ver tudo
              </Link>
            </div>

            {dividas && dividas.dividasVencidas > 0 && (
              <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  {dividas.dividasVencidas} conta(s) vencida(s) somando {fmt(dividas.valorVencido)}.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {(dividas?.devedoresRecentes ?? []).slice(0, 4).map((item, index) => (
                <div key={`${item.nome}-${index}`} className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Vencimento {fmtDate(item.vencimento)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{fmt(item.valor)}</p>
                    <p className={`text-xs font-medium ${item.status === 'vencida' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {item.status === 'vencida' ? 'Vencida' : item.status}
                    </p>
                  </div>
                </div>
              ))}
              {(dividas?.devedoresRecentes ?? []).length === 0 && (
                <EmptyMessage message="Nenhuma conta a receber registrada no momento." />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ListCard
            title="Rotinas prioritárias"
            subtitle="Acompanhe o que precisa ser executado pela equipe"
            icon={<ClipboardList className="size-4" />}
            action={{ href: '/tarefas', label: 'Abrir rotinas' }}
            emptyMessage="Nenhuma rotina pendente no momento."
            items={(tarefasPendentes?.tarefas ?? []).map((task) => ({
              id: task.id,
              title: task.titulo,
              meta: 'Acompanhar execucao da equipe',
              badge: task.prioridade,
              badgeTone:
                task.prioridade === 'alta' ? 'red' :
                task.prioridade === 'media' ? 'amber' :
                'blue',
            }))}
          />

          <div className="content-card p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Movimento recente
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Lançamentos do caixa
                </h2>
              </div>
              <Link href="/lancamentos" className="text-sm font-medium text-primary hover:underline">
                Ver tudo
              </Link>
            </div>
            <div className="space-y-3">
              {(lancamentosRecentes?.lancamentos ?? []).slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.descricao}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.clienteNome || item.tipo} • {fmtDate(item.dataLancamento)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{fmt(item.valor)}</p>
                    <p className="text-xs text-muted-foreground">{statusLabel(item.status)}</p>
                  </div>
                </div>
              ))}
              {(!lancamentosRecentes || lancamentosRecentes.lancamentos.length === 0) && (
                <EmptyMessage message="Nenhuma movimentação recente registrada." />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="content-card p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Ritmo de vendas
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Evolucao por semana
                </h2>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendasSemana} barSize={34}>
                  <XAxis
                    dataKey="semana"
                    tickFormatter={(value) => `S${value}`}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                  <Bar dataKey="total" radius={[12, 12, 0, 0]} fill="#0f172a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="content-card p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Produtos em destaque
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Itens com maior giro
                </h2>
              </div>
              <Flame className="size-5 text-primary" />
            </div>

            <div className="space-y-3">
              {topProdutos.slice(0, 5).map((item, index) => (
                <div key={`${item.nome}-${index}`} className="flex items-center gap-4 rounded-2xl border border-border/70 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{item.nome}</p>
                    <p className="text-sm text-muted-foreground">{item.totalVendido} venda(s) registradas</p>
                  </div>
                  <p className="font-semibold text-foreground">{fmtCompact(item.faturamento)}</p>
                </div>
              ))}
              {topProdutos.length === 0 && (
                <EmptyMessage message="Ainda não há produtos em destaque neste período." />
              )}
            </div>
          </div>
        </section>

        <section className="content-card p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Operacoes recentes
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                Últimas vendas registradas
              </h2>
            </div>
            <Link href="/estoque" className="text-sm font-medium text-primary hover:underline">
              Abrir produtos
            </Link>
          </div>
          <div className="space-y-3">
            {ultimasVendas.length === 0 ? (
              <EmptyMessage message="Nenhuma operação recente encontrada." />
            ) : (
              ultimasVendas.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <ShoppingBag className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{item.produtoNome}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantidade} unidade(s) • {fmtDate(item.dataVenda)}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-foreground">{fmt(item.total)}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Ações rápidas
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                Continue a operação sem perder tempo
              </h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <QuickAction href="/estoque" icon={<PackagePlus className="size-5" />} label="Cadastrar produto" />
            <QuickAction href="/estoque" icon={<ShoppingBag className="size-5" />} label="Registrar venda" />
            <QuickAction href="/lancamentos" icon={<Receipt className="size-5" />} label="Lancar no caixa" />
            <QuickAction href="/deficit" icon={<Wallet className="size-5" />} label="Registrar conta a receber" />
            <QuickAction href="/tarefas" icon={<ClipboardList className="size-5" />} label="Criar rotina" />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function OverviewCard({
  label,
  value,
  helper,
  icon,
  tone,
  trend,
  alert,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'slate' | 'amber';
  trend?: number;
  alert?: boolean;
}) {
  const toneMap = {
    blue: 'bg-primary/10 text-primary',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    slate: 'bg-foreground/8 text-foreground',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  };

  return (
    <div className={`content-card p-6 ${alert ? 'ring-1 ring-red-500/20' : ''}`}>
      <div className="mb-5 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneMap[tone]}`}>
          {icon}
        </div>
        {trend !== undefined && trend !== 0 && (
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ListCard({
  title,
  subtitle,
  icon,
  action,
  emptyMessage,
  items,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action: { href: string; label: string };
  emptyMessage: string;
  items: { id: number; title: string; meta: string; badge: string; badgeTone: 'red' | 'amber' | 'blue' }[];
}) {
  const badgeToneMap = {
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    blue: 'bg-primary/10 text-primary',
  };

  return (
    <div className="content-card p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {subtitle}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <EmptyMessage message={emptyMessage} />
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.meta}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeToneMap[item.badgeTone]}`}>
                {item.badge}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-5">
        <Link href={action.href} className="text-sm font-medium text-primary hover:underline">
          {action.label}
        </Link>
      </div>
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="content-card group flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(37,99,235,0.12)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">Acesso rápido ao módulo</p>
      </div>
    </Link>
  );
}

function statusLabel(status: string) {
  if (status === 'pago') return 'Pago';
  if (status === 'aguardando_pagamento') return 'Aguardando';
  if (status === 'em_processo') return 'Em processo';
  return status;
}
