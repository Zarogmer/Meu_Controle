'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Plus,
  PenLine,
  Trash2,
  Search,
  Building2,
  User,
  CircleCheckBig,
  Clock,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Repeat,
  TriangleAlert,
  CalendarClock,
  Upload,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  CATEGORIAS_CONTA,
  CATEGORIA_CONTA_LABEL,
  competenciaAtual,
  competenciaDeData,
  formatCompetenciaLonga,
  hojeISO,
  somarMeses,
} from '@/lib/contas';
import {
  type Gasto,
  type ResumoGastos,
  formatBRL,
  readCents,
  centsToDecimal,
  formatCentavos,
  formatDate,
  formatDiaMes,
  tipoBadge,
  statusBadge,
  vencimentoBadge,
  nativeSelectClass,
} from '@/components/gastos/shared';
import { ContasFixasTab } from '@/components/gastos/ContasFixasTab';
import { VisaoAnualTab } from '@/components/gastos/VisaoAnualTab';

interface Categoria {
  id: number;
  nome: string;
}

type TipoFiltro = 'todos' | 'pessoal' | 'empresa';
type StatusFiltro = 'todos' | 'pago' | 'pendente';
type Aba = 'movimentacoes' | 'contas' | 'anual';

const ABAS: { value: Aba; label: string }[] = [
  { value: 'movimentacoes', label: 'Movimentações' },
  { value: 'contas', label: 'Contas fixas' },
  { value: 'anual', label: 'Visão anual' },
];

export default function GastosPage() {
  const { user } = useAuth();
  const podePessoal = user?.role !== 'employee';

  const [aba, setAba] = useState<Aba>('movimentacoes');
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [todosOsMeses, setTodosOsMeses] = useState(false);

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [gastosDoMes, setGastosDoMes] = useState<Gasto[]>([]);
  const [resumo, setResumo] = useState<ResumoGastos | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoFiltro>('todos');
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>('todos');

  // ── Form gasto ────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [saving, setSaving] = useState(false);
  const [fTipo, setFTipo] = useState<'pessoal' | 'empresa'>('empresa');
  const [fDescricao, setFDescricao] = useState('');
  const [fCategoria, setFCategoria] = useState('');
  const [fValorCents, setFValorCents] = useState('');
  const [fDataGasto, setFDataGasto] = useState('');
  const [fStatus, setFStatus] = useState<'pago' | 'pendente'>('pago');
  const [fDataVencimento, setFDataVencimento] = useState('');
  const [fCompetencia, setFCompetencia] = useState('');
  const [fObservacao, setFObservacao] = useState('');
  const [anexoBusy, setAnexoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Pagar ─────────────────────────────────────────────────────
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState<Gasto | null>(null);
  const [payValorCents, setPayValorCents] = useState('');
  const [payData, setPayData] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  // ── Excluir ───────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingGasto, setDeletingGasto] = useState<Gasto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hoje = hojeISO();
  const ehMesAtual = competencia === competenciaAtual();

  // ── Carregamento ──────────────────────────────────────────────
  const fetchGastos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroTipo !== 'todos') params.set('tipo', filtroTipo);
      if (filtroStatus !== 'todos') params.set('status', filtroStatus);
      if (busca) params.set('busca', busca);
      if (!todosOsMeses) {
        params.set('ano', competencia.slice(0, 4));
        params.set('mes', String(Number(competencia.slice(5, 7))));
      }
      const res = await fetch(`/api/gastos?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGastos(data.gastos);
    } catch {
      toast.error('Erro ao carregar gastos.');
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, filtroStatus, busca, competencia, todosOsMeses]);

  const fetchResumo = useCallback(async () => {
    try {
      const params = new URLSearchParams({ competencia, ano: competencia.slice(0, 4) });
      if (filtroTipo !== 'todos') params.set('tipo', filtroTipo);
      const res = await fetch(`/api/gastos/resumo?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      setResumo(await res.json());
    } catch {
      // o resumo é complementar; a lista continua funcionando sem ele
    }
  }, [competencia, filtroTipo]);

  // Gastos da competência (sem filtros de busca) para a aba de contas fixas.
  const fetchGastosDoMes = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        ano: competencia.slice(0, 4),
        mes: String(Number(competencia.slice(5, 7))),
      });
      const res = await fetch(`/api/gastos?${params}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setGastosDoMes(data.gastos);
    } catch {
      // silencioso
    }
  }, [competencia]);

  const refreshAll = useCallback(() => {
    fetchGastos();
    fetchResumo();
    fetchGastosDoMes();
    setRefreshKey((k) => k + 1);
  }, [fetchGastos, fetchResumo, fetchGastosDoMes]);

  // Ao abrir a tela: garante que as faturas do mês corrente existem
  // (idempotente) e só então carrega tudo.
  const geradoRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!geradoRef.current) {
        geradoRef.current = true;
        try {
          const res = await fetch(`/api/contas-recorrentes/gerar?competencia=${competenciaAtual()}`, {
            method: 'POST',
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data.criadas > 0) {
              toast.info(`${data.criadas} fatura(s) do mês lançada(s) como pendente.`);
            }
          }
        } catch {
          // segue sem gerar
        }
      }
      if (!cancelled) {
        setLoading(true);
        fetchGastos();
        fetchResumo();
        fetchGastosDoMes();
      }
    }
    boot();
    return () => { cancelled = true; };
  }, [fetchGastos, fetchResumo, fetchGastosDoMes]);

  // Categorias para o formulário: as de conta fixa + as do catálogo.
  useEffect(() => {
    if (!dialogOpen) return;
    fetch('/api/categorias', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { categorias: [] }))
      .then((data) => setCategorias(data.categorias ?? []))
      .catch(() => setCategorias([]));
  }, [dialogOpen]);

  const opcoesCategoria = useMemo(() => {
    const set = new Set<string>();
    CATEGORIAS_CONTA.forEach((c) => set.add(CATEGORIA_CONTA_LABEL[c]));
    categorias.forEach((c) => set.add(c.nome));
    if (fCategoria) set.add(fCategoria);
    return Array.from(set);
  }, [categorias, fCategoria]);

  // ── Totais da lista atual ─────────────────────────────────────
  const totalEmpresa = gastos.filter((g) => g.tipo === 'empresa').reduce((s, g) => s + g.valor, 0);
  const totalPessoal = gastos.filter((g) => g.tipo === 'pessoal').reduce((s, g) => s + g.valor, 0);
  const totalPendente = gastos.filter((g) => g.status === 'pendente').reduce((s, g) => s + g.valor, 0);
  const previsao = resumo?.previsaoMes;
  const venc = resumo?.vencimentos;

  // ── Form helpers ──────────────────────────────────────────────
  function resetForm() {
    setFTipo('empresa');
    setFDescricao('');
    setFCategoria('');
    setFValorCents('');
    setFDataGasto(hoje);
    setFStatus('pago');
    setFDataVencimento('');
    setFCompetencia('');
    setFObservacao('');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(g: Gasto) {
    setEditing(g);
    setFTipo(g.tipo);
    setFDescricao(g.descricao);
    setFCategoria(g.categoria || '');
    setFValorCents(String(g.valor));
    setFDataGasto(g.dataGasto);
    setFStatus(g.status);
    setFDataVencimento(g.dataVencimento || '');
    setFCompetencia(g.competencia || '');
    setFObservacao(g.observacao || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fDescricao.trim()) {
      toast.error('Descrição é obrigatória.');
      return;
    }
    if (!fValorCents || Number(fValorCents) <= 0) {
      toast.error('O valor deve ser maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tipo: fTipo,
        descricao: fDescricao,
        categoria: fCategoria,
        valor: centsToDecimal(fValorCents),
        dataGasto: fDataGasto,
        status: fStatus,
        observacao: fObservacao,
        dataVencimento: fDataVencimento || null,
        competencia: fCompetencia || null,
      };

      const url = editing ? `/api/gastos/${editing.id}` : '/api/gastos';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar');
      }
      toast.success(editing ? 'Gasto atualizado.' : 'Gasto registrado.');
      setDialogOpen(false);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleAnexo(file: File) {
    if (!editing) return;
    setAnexoBusy(true);
    try {
      const form = new FormData();
      form.append('arquivo', file);
      const res = await fetch(`/api/gastos/${editing.id}/anexo`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar');
      setEditing({ ...editing, anexoUrl: data.anexoUrl });
      toast.success('Fatura anexada.');
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setAnexoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoverAnexo() {
    if (!editing) return;
    setAnexoBusy(true);
    try {
      const res = await fetch(`/api/gastos/${editing.id}/anexo`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      setEditing({ ...editing, anexoUrl: null });
      toast.success('Anexo removido.');
      refreshAll();
    } catch {
      toast.error('Erro ao remover anexo.');
    } finally {
      setAnexoBusy(false);
    }
  }

  function openPay(g: Gasto) {
    setPaying(g);
    setPayValorCents(String(g.valor));
    setPayData(hoje);
    setPayOpen(true);
  }

  async function handlePay() {
    if (!paying) return;
    if (!payValorCents || Number(payValorCents) <= 0) {
      toast.error('Informe o valor pago.');
      return;
    }
    setPayBusy(true);
    try {
      const res = await fetch(`/api/gastos/${paying.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          descricao: paying.descricao,
          categoria: paying.categoria,
          observacao: paying.observacao,
          valor: centsToDecimal(payValorCents),
          status: 'pago',
          dataGasto: payData || hoje,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao pagar');
      }
      toast.success('Conta marcada como paga.');
      setPayOpen(false);
      setPaying(null);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao pagar');
    } finally {
      setPayBusy(false);
    }
  }

  function openDelete(g: Gasto) {
    setDeletingGasto(g);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingGasto) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/gastos/${deletingGasto.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast.success('Gasto excluído');
      setDeleteDialogOpen(false);
      setDeletingGasto(null);
      refreshAll();
    } catch {
      toast.error('Erro ao excluir gasto');
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Gastos</p>
            <h1 className="text-2xl font-bold tracking-tight">Despesas, contas fixas e previsão do mês</h1>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            Novo gasto
          </Button>
        </div>

        {/* Navegação de competência */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={() => setCompetencia((c) => somarMeses(c, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <button
              type="button"
              className="min-w-[11rem] rounded-full bg-muted px-4 py-1.5 text-center text-sm font-semibold hover:bg-muted/70"
              onClick={() => setCompetencia(competenciaAtual())}
              title="Voltar para o mês atual"
            >
              {formatCompetenciaLonga(competencia)}
            </button>
            <Button variant="outline" size="icon-sm" onClick={() => setCompetencia((c) => somarMeses(c, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            {!ehMesAtual && (
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setCompetencia(competenciaAtual())}>
                Hoje
              </Button>
            )}
          </div>
          <div className="flex gap-1.5">
            {ABAS.map((a) => (
              <Button
                key={a.value}
                variant={aba === a.value ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => setAba(a.value)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Cards do mês */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <Sparkles className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-[#1A1D1F]">{formatCentavos(previsao?.total ?? 0)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Previsão do mês</p>
                </div>
              </div>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Pago</span><span className="font-semibold text-foreground tabular-nums">{formatCentavos(previsao?.pago ?? 0)}</span></div>
                <div className="flex justify-between"><span>Pendente</span><span className="font-semibold text-foreground tabular-nums">{formatCentavos(previsao?.pendente ?? 0)}</span></div>
                <div className="flex justify-between"><span>Contas a lançar</span><span className="font-semibold text-foreground tabular-nums">{formatCentavos(previsao?.naoLancado ?? 0)}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full bg-blue-50 p-2.5">
                <Building2 className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1A1D1F]">{formatCentavos(totalEmpresa)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gastos da empresa</p>
              </div>
            </CardContent>
          </Card>
          {podePessoal ? (
            <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-full bg-violet-50 p-2.5">
                  <User className="size-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1A1D1F]">{formatCentavos(totalPessoal)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gastos pessoais</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-full bg-amber-50 p-2.5">
                  <Clock className="size-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1A1D1F]">{formatCentavos(totalPendente)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pendentes</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className={`bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none ${(venc?.atrasados.length ?? 0) > 0 ? 'ring-1 ring-red-500/20' : ''}`}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-full p-2.5 ${(venc?.atrasados.length ?? 0) > 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                {(venc?.atrasados.length ?? 0) > 0
                  ? <TriangleAlert className="size-5 text-red-600" />
                  : <CalendarClock className="size-5 text-amber-600" />}
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1A1D1F]">
                  {formatCentavos((venc?.valorAtrasado ?? 0) + (venc?.valorProximos ?? 0))}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {(venc?.atrasados.length ?? 0) > 0
                    ? `${venc?.atrasados.length} vencida(s) · ${venc?.proximos.length ?? 0} em 7 dias`
                    : `${venc?.proximos.length ?? 0} vencem em 7 dias`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {aba === 'contas' && (
          <ContasFixasTab
            competencia={competencia}
            gastosDoMes={gastosDoMes}
            podePessoal={podePessoal}
            onChanged={refreshAll}
          />
        )}

        {aba === 'anual' && (
          <VisaoAnualTab anoInicial={competencia.slice(0, 4)} tipo={filtroTipo} refreshKey={refreshKey} />
        )}

        {aba === 'movimentacoes' && (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição ou categoria..."
                  className="pl-9"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'todos', label: 'Todos' },
                  { value: 'empresa', label: 'Empresa' },
                  ...(podePessoal ? [{ value: 'pessoal', label: 'Pessoal' }] : []),
                ] as { value: TipoFiltro; label: string }[]).map((s) => (
                  <Button
                    key={s.value}
                    variant={filtroTipo === s.value ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setFiltroTipo(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
                <span className="mx-1 hidden w-px bg-border sm:block" />
                {([
                  { value: 'todos', label: 'Pagos e pendentes' },
                  { value: 'pendente', label: 'Pendentes' },
                  { value: 'pago', label: 'Pagos' },
                ] as { value: StatusFiltro; label: string }[]).map((s) => (
                  <Button
                    key={s.value}
                    variant={filtroStatus === s.value ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setFiltroStatus(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
                <Button
                  variant={todosOsMeses ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setTodosOsMeses((v) => !v)}
                  title="Ignorar o mês selecionado e listar tudo"
                >
                  Todos os meses
                </Button>
              </div>
            </div>

            <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
              <CardHeader>
                <CardTitle>
                  {todosOsMeses ? 'Todas as movimentações' : `Movimentações de ${formatCompetenciaLonga(competencia)}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex flex-col gap-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : gastos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <TrendingDown className="size-12 text-muted-foreground/30" />
                    <p className="mt-4 text-muted-foreground">Nenhum gasto neste período.</p>
                    <Button variant="outline" className="mt-4" onClick={openCreate}>
                      <Plus className="size-4" data-icon="inline-start" />
                      Registrar gasto
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="hidden md:table-cell">Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gastos.map((g) => {
                          const badgeVenc = vencimentoBadge(g, hoje);
                          return (
                            <TableRow key={g.id}>
                              <TableCell>{tipoBadge(g.tipo)}</TableCell>
                              <TableCell className="max-w-[240px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate font-medium">{g.descricao}</span>
                                  {g.contaRecorrenteId && (
                                    <span title="Conta fixa" className="text-muted-foreground">
                                      <Repeat className="size-3.5" />
                                    </span>
                                  )}
                                  {g.anexoUrl && (
                                    <a
                                      href={g.anexoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Abrir fatura/boleto"
                                      className="text-primary hover:text-primary/80"
                                    >
                                      <Paperclip className="size-3.5" />
                                    </a>
                                  )}
                                </div>
                                {g.competencia && g.competencia !== competenciaDeData(g.dataGasto) && (
                                  <p className="text-[11px] text-muted-foreground">Ref. {formatCompetenciaLonga(g.competencia)}</p>
                                )}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground">
                                {g.categoria || '—'}
                              </TableCell>
                              <TableCell className="text-right font-bold tabular-nums">
                                {formatCentavos(g.valor)}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">
                                {g.status === 'pendente' && g.dataVencimento
                                  ? <span title="Vencimento">Vence {formatDate(g.dataVencimento)}</span>
                                  : formatDate(g.dataGasto)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-1">
                                  {badgeVenc ?? statusBadge(g.status)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {g.status === 'pendente' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="rounded-full"
                                      onClick={() => openPay(g)}
                                    >
                                      <CircleCheckBig className="size-3.5" data-icon="inline-start" />
                                      Pagar
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(g)}>
                                    <PenLine className="size-4" />
                                  </Button>
                                  <Button variant="destructive" size="icon-sm" onClick={() => openDelete(g)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Dialog: novo/editar gasto ─────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar gasto' : 'Novo gasto'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados do gasto.' : 'Registre um novo gasto pessoal ou da empresa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-tipo">Tipo</Label>
                <select
                  id="g-tipo"
                  className={nativeSelectClass}
                  value={fTipo}
                  onChange={(e) => setFTipo(e.target.value as 'pessoal' | 'empresa')}
                >
                  <option value="empresa">Empresa</option>
                  {podePessoal && <option value="pessoal">Pessoal</option>}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-status">Status</Label>
                <select
                  id="g-status"
                  className={nativeSelectClass}
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value as 'pago' | 'pendente')}
                >
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="g-descricao">Descrição *</Label>
              <Input
                id="g-descricao"
                placeholder="Ex: Conta de luz, aluguel..."
                value={fDescricao}
                onChange={(e) => setFDescricao(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-valor">Valor *</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="g-valor"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formatBRL(fValorCents)}
                    onChange={(e) => setFValorCents(readCents(e.target.value))}
                    className="pl-10 text-right tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-data">{fStatus === 'pago' ? 'Data do pagamento' : 'Data'}</Label>
                <Input
                  id="g-data"
                  type="date"
                  value={fDataGasto}
                  onChange={(e) => setFDataGasto(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-venc">Vencimento</Label>
                <Input
                  id="g-venc"
                  type="date"
                  value={fDataVencimento}
                  onChange={(e) => {
                    setFDataVencimento(e.target.value);
                    if (e.target.value && !fCompetencia) setFCompetencia(competenciaDeData(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-comp">Mês de referência</Label>
                <Input
                  id="g-comp"
                  type="month"
                  value={fCompetencia}
                  onChange={(e) => setFCompetencia(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="g-categoria">Categoria</Label>
              <Select value={fCategoria} onValueChange={(v) => setFCategoria(v ?? '')}>
                <SelectTrigger id="g-categoria" className="w-full">
                  <SelectValue placeholder="Escolha uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesCategoria.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="g-obs">Observação</Label>
              <Textarea
                id="g-obs"
                placeholder="Anotações extras..."
                value={fObservacao}
                onChange={(e) => setFObservacao(e.target.value)}
                rows={2}
              />
            </div>

            {editing ? (
              <div className="space-y-1.5">
                <Label>Fatura / boleto</Label>
                {editing.anexoUrl ? (
                  <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                    <a href={editing.anexoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                      <Paperclip className="size-4" />
                      Abrir anexo
                    </a>
                    <Button variant="ghost" size="icon-sm" onClick={handleRemoverAnexo} disabled={anexoBusy} title="Remover anexo">
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAnexo(f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={anexoBusy}
                    >
                      <Upload className="size-4" data-icon="inline-start" />
                      {anexoBusy ? 'Enviando...' : 'Anexar PDF ou imagem'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Você pode anexar a fatura ou boleto depois de registrar o gasto.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: marcar como pago ──────────────────────────────── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como paga</DialogTitle>
            <DialogDescription>
              <strong>{paying?.descricao}</strong>
              {paying?.dataVencimento ? ` · vencimento ${formatDiaMes(paying.dataVencimento)}` : ''}.
              Confirme o valor real pago.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-valor">Valor pago *</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  R$
                </span>
                <Input
                  id="p-valor"
                  inputMode="numeric"
                  value={formatBRL(payValorCents)}
                  onChange={(e) => setPayValorCents(readCents(e.target.value))}
                  className="pl-10 text-right tabular-nums"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-data">Data do pagamento</Label>
              <Input id="p-data" type="date" value={payData} onChange={(e) => setPayData(e.target.value)} />
            </div>
          </div>
          {paying && Number(payValorCents || 0) !== paying.valor && (
            <p className="text-xs text-muted-foreground">
              Previsto: {formatCentavos(paying.valor)} · diferença de{' '}
              <span className={Number(payValorCents || 0) > paying.valor ? 'text-red-600' : 'text-green-600'}>
                {formatCentavos(Number(payValorCents || 0) - paying.valor)}
              </span>
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={payBusy}>
              Cancelar
            </Button>
            <Button onClick={handlePay} disabled={payBusy}>
              <CircleCheckBig className="size-4" data-icon="inline-start" />
              {payBusy ? 'Salvando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: excluir ───────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir gasto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o gasto{' '}
              <strong>{deletingGasto?.descricao}</strong> no valor de{' '}
              <strong>{deletingGasto ? formatCentavos(deletingGasto.valor) : ''}</strong>?
              {deletingGasto?.contaRecorrenteId && (
                <> Esta é a fatura de uma conta fixa; ela será lançada de novo ao gerar as faturas do mês.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
