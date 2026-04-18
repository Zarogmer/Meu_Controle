'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCentavos } from '@/lib/format';
import {
  ArrowLeft, Users, ShieldCheck, Calendar,
  DollarSign, TrendingUp, ShoppingBag, AlertCircle,
  Package, Receipt, Wallet, ListTodo, Percent, CreditCard,
} from 'lucide-react';

interface Loja {
  id: number;
  nome: string;
  segmento: string;
  ativo: number;
  criadoEm: string;
  logoUrl: string | null;
  corPrimaria: string | null;
}

interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: string;
  ativo: number;
  criadoEm: string;
}

interface Metricas {
  faturamentoTotal: number;
  lucroBruto: number;
  margemPercentual: number;
  totalVendas: number;
  ticketMedio: number;
  faturamentoMes: number;
  vendasMes: number;
  dividasAberto: number;
  qtdDividasAberto: number;
  gastosMes: number;
  qtdGastosMes: number;
  totalProdutos: number;
  estoqueValor: number;
  unidadesEstoque: number;
  lancamentosPendentes: number;
  valorLancamentosPendentes: number;
  tarefasPendentes: number;
}

interface VendaRecente {
  id: number;
  dataVenda: string;
  quantidade: number;
  precoUnitarioVenda: number;
  precoUnitarioCusto: number;
  produtoNome: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateOnly(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dono da Loja',
  employee: 'Funcionário',
  super_admin: 'Super Admin',
};

export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { fetchWithAuth } = useAuth();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [vendasRecentes, setVendasRecentes] = useState<VendaRecente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenant = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/admin/tenants/${id}`);
      if (!res.ok) {
        toast.error('Loja não encontrada');
        router.push('/admin');
        return;
      }
      const data = await res.json();
      setLoja(data.loja);
      setUsuarios(data.usuarios);
      setMetricas(data.metricas);
      setVendasRecentes(data.vendasRecentes ?? []);
    } catch {
      toast.error('Erro ao carregar loja');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, id, router]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 rounded-[2rem]" />
            <Skeleton className="h-28 rounded-[2rem]" />
            <Skeleton className="h-28 rounded-[2rem]" />
            <Skeleton className="h-28 rounded-[2rem]" />
          </div>
          <Skeleton className="h-64 rounded-[2rem]" />
        </div>
      </AppLayout>
    );
  }

  if (!loja || !metricas) return null;

  const admins = usuarios.filter(u => u.role === 'owner');

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push('/admin')}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{loja.nome}</h1>
              <Badge variant={loja.ativo ? 'default' : 'destructive'}>
                {loja.ativo ? 'Ativa' : 'Suspensa'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 capitalize">
              {loja.segmento} · Cadastrada em {formatDate(loja.criadoEm)}
            </p>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            label="Faturamento total"
            value={formatCentavos(metricas.faturamentoTotal)}
            icon={<DollarSign className="size-5" />}
            color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            valueSize="text-2xl"
            sub={`${metricas.totalVendas} vendas no total`}
          />
          <InfoCard
            label="Lucro bruto"
            value={formatCentavos(metricas.lucroBruto)}
            icon={<TrendingUp className="size-5" />}
            color="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
            valueSize="text-2xl"
            sub={`Margem ${metricas.margemPercentual.toFixed(1)}%`}
          />
          <InfoCard
            label="Faturamento do mês"
            value={formatCentavos(metricas.faturamentoMes)}
            icon={<Receipt className="size-5" />}
            color="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
            valueSize="text-2xl"
            sub={`${metricas.vendasMes} venda(s) este mês`}
          />
          <InfoCard
            label="Ticket médio"
            value={formatCentavos(metricas.ticketMedio)}
            icon={<Percent className="size-5" />}
            color="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
            valueSize="text-2xl"
          />
        </div>

        {/* Operational */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            label="Dívidas em aberto"
            value={formatCentavos(metricas.dividasAberto)}
            icon={<AlertCircle className="size-5" />}
            color="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            valueSize="text-2xl"
            sub={`${metricas.qtdDividasAberto} pendente(s)`}
          />
          <InfoCard
            label="Gastos do mês"
            value={formatCentavos(metricas.gastosMes)}
            icon={<Wallet className="size-5" />}
            color="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
            valueSize="text-2xl"
            sub={`${metricas.qtdGastosMes} lançamento(s)`}
          />
          <InfoCard
            label="Lançamentos pendentes"
            value={formatCentavos(metricas.valorLancamentosPendentes)}
            icon={<CreditCard className="size-5" />}
            color="bg-[#C1B8FF]/10 text-[#8b7fff] dark:bg-[#C1B8FF]/10 dark:text-[#C1B8FF]"
            valueSize="text-2xl"
            sub={`${metricas.lancamentosPendentes} a receber`}
          />
          <InfoCard
            label="Estoque"
            value={formatCentavos(metricas.estoqueValor)}
            icon={<Package className="size-5" />}
            color="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400"
            valueSize="text-2xl"
            sub={`${metricas.totalProdutos} produto(s) · ${metricas.unidadesEstoque} un.`}
          />
        </div>

        {/* Org summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard
            label="Total de usuários"
            value={usuarios.length}
            icon={<Users className="size-5" />}
            color="bg-[#C1B8FF]/10 text-[#8b7fff] dark:text-[#C1B8FF]"
          />
          <InfoCard
            label="Administradores"
            value={admins.length}
            icon={<ShieldCheck className="size-5" />}
            color="bg-[#C1B8FF]/10 text-[#8b7fff] dark:text-[#C1B8FF]"
          />
          <InfoCard
            label="Tarefas pendentes"
            value={metricas.tarefasPendentes}
            icon={<ListTodo className="size-5" />}
            color="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
          />
        </div>

        {/* Recent Sales */}
        <Card className="bg-card border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Últimas vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vendasRecentes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ShoppingBag className="size-10 text-muted-foreground/30" />
                <p className="mt-3 text-muted-foreground">Nenhuma venda registrada.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendasRecentes.map((v) => {
                    const total = v.quantidade * v.precoUnitarioVenda;
                    const lucro = v.quantidade * (v.precoUnitarioVenda - v.precoUnitarioCusto);
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium text-foreground">
                          {v.produtoNome ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateOnly(v.dataVenda)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {v.quantidade}
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatCentavos(total)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCentavos(lucro)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-card border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Usuários desta loja
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usuarios.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="size-10 text-muted-foreground/30" />
                <p className="mt-3 text-muted-foreground">Nenhum usuário cadastrado.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Desde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-[#C1B8FF]/10 text-xs font-bold text-[#8b7fff] dark:text-[#C1B8FF]">
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">{u.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'owner' ? 'default' : 'secondary'}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.ativo ? 'default' : 'destructive'}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(u.criadoEm)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function InfoCard({ label, value, icon, color, valueSize = 'text-3xl', sub }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  valueSize?: string;
  sub?: string;
}) {
  return (
    <Card className="bg-card border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] transition-all hover:shadow-[0_12px_40px_rgb(37,99,235,0.08)] hover:-translate-y-0.5">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className={`mt-2 ${valueSize} font-bold tracking-tight text-foreground leading-none`}>{value}</p>
            {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
