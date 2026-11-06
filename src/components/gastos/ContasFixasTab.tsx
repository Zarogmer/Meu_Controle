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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, PenLine, Trash2, RefreshCw, Repeat, Power, PowerOff } from 'lucide-react';
import {
  CATEGORIAS_CONTA,
  CATEGORIA_CONTA_LABEL,
  formatCompetenciaLonga,
  type CategoriaConta,
} from '@/lib/contas';
import {
  type ContaRecorrente,
  type Gasto,
  formatBRL,
  readCents,
  centsToDecimal,
  formatCentavos,
  tipoBadge,
  CategoriaIcon,
  nativeSelectClass,
} from './shared';

interface Props {
  competencia: string;
  /** Gastos da competência selecionada (para mostrar a situação de cada conta). */
  gastosDoMes: Gasto[];
  podePessoal: boolean;
  /** Chamado após qualquer mudança que afete gastos/resumo. */
  onChanged: () => void;
}

export function ContasFixasTab({ competencia, gastosDoMes, podePessoal, onChanged }: Props) {
  const [contas, setContas] = useState<ContaRecorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaRecorrente | null>(null);
  const [saving, setSaving] = useState(false);

  const [fNome, setFNome] = useState('');
  const [fTipo, setFTipo] = useState<'pessoal' | 'empresa'>('empresa');
  const [fCategoria, setFCategoria] = useState<CategoriaConta>('luz');
  const [fValorCents, setFValorCents] = useState('');
  const [fDia, setFDia] = useState('10');
  const [fAtiva, setFAtiva] = useState(true);
  const [fObservacao, setFObservacao] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<ContaRecorrente | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const fetchContas = useCallback(async () => {
    try {
      const res = await fetch('/api/contas-recorrentes', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContas(data.contas ?? []);
    } catch {
      toast.error('Erro ao carregar contas fixas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContas();
  }, [fetchContas]);

  function situacaoDaConta(conta: ContaRecorrente) {
    const gasto = gastosDoMes.find((g) => g.contaRecorrenteId === conta.id);
    if (!conta.ativa) return { label: 'Inativa', tone: 'muted' as const, gasto: null };
    if (!gasto) return { label: 'A lançar', tone: 'slate' as const, gasto: null };
    if (gasto.status === 'pago') return { label: 'Paga', tone: 'green' as const, gasto };
    return { label: 'Pendente', tone: 'amber' as const, gasto };
  }

  function resetForm() {
    setFNome('');
    setFTipo('empresa');
    setFCategoria('luz');
    setFValorCents('');
    setFDia('10');
    setFAtiva(true);
    setFObservacao('');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(c: ContaRecorrente) {
    setEditing(c);
    setFNome(c.nome);
    setFTipo(c.tipo);
    setFCategoria(c.categoria);
    setFValorCents(String(c.valorEstimado));
    setFDia(String(c.diaVencimento));
    setFAtiva(c.ativa);
    setFObservacao(c.observacao || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fNome.trim()) {
      toast.error('Dê um nome para a conta.');
      return;
    }
    const dia = parseInt(fDia, 10);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      toast.error('Dia de vencimento deve ser entre 1 e 31.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: fNome,
        tipo: fTipo,
        categoria: fCategoria,
        valorEstimado: centsToDecimal(fValorCents),
        diaVencimento: dia,
        ativa: fAtiva,
        observacao: fObservacao,
      };
      const url = editing ? `/api/contas-recorrentes/${editing.id}` : '/api/contas-recorrentes';
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
      const data = await res.json();
      if (editing) {
        toast.success('Conta fixa atualizada.');
      } else if (data.faturaGerada) {
        toast.success('Conta fixa criada e fatura do mês lançada como pendente.');
      } else {
        toast.success('Conta fixa criada.');
      }
      setDialogOpen(false);
      await fetchContas();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtiva(c: ContaRecorrente) {
    try {
      const res = await fetch(`/api/contas-recorrentes/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome: c.nome, ativa: !c.ativa }),
      });
      if (!res.ok) throw new Error();
      toast.success(c.ativa ? 'Conta pausada.' : 'Conta reativada.');
      await fetchContas();
      onChanged();
    } catch {
      toast.error('Não foi possível alterar a conta.');
    }
  }

  async function handleGerar() {
    setGerando(true);
    try {
      const res = await fetch(`/api/contas-recorrentes/gerar?competencia=${competencia}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.criadas > 0) {
        toast.success(`${data.criadas} fatura(s) de ${formatCompetenciaLonga(competencia)} lançada(s).`);
      } else {
        toast.info('Todas as contas ativas já têm lançamento neste mês.');
      }
      onChanged();
    } catch {
      toast.error('Erro ao gerar faturas.');
    } finally {
      setGerando(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/contas-recorrentes/${deleting.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast.success('Conta fixa excluída.');
      setDeleteOpen(false);
      setDeleting(null);
      await fetchContas();
      onChanged();
    } catch {
      toast.error('Erro ao excluir conta.');
    } finally {
      setDeletingBusy(false);
    }
  }

  const totalEstimadoAtivas = contas
    .filter((c) => c.ativa)
    .reduce((s, c) => s + c.valorEstimado, 0);

  const toneClass = {
    green: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    slate: 'bg-muted text-muted-foreground',
    muted: 'bg-muted text-muted-foreground/70',
  };

  return (
    <>
      <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Contas fixas</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {contas.filter((c) => c.ativa).length} conta(s) ativa(s) somando {formatCentavos(totalEstimadoAtivas)} por mês.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGerar} disabled={gerando}>
              <RefreshCw className={`size-4 ${gerando ? 'animate-spin' : ''}`} data-icon="inline-start" />
              Gerar faturas do mês
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" data-icon="inline-start" />
              Nova conta fixa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl bg-muted" />
              ))}
            </div>
          ) : contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Repeat className="size-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Nenhuma conta fixa cadastrada.</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Cadastre luz, água, internet, aluguel e cartão para o sistema lançar a fatura todo mês e prever seus gastos.
              </p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="size-4" data-icon="inline-start" />
                Cadastrar primeira conta
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="text-right">Valor estimado</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Vence dia</TableHead>
                    <TableHead>Situação no mês</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.map((c) => {
                    const sit = situacaoDaConta(c);
                    return (
                      <TableRow key={c.id} className={c.ativa ? '' : 'opacity-60'}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <CategoriaIcon categoria={c.categoria} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{c.nome}</p>
                              <p className="text-xs text-muted-foreground">{CATEGORIA_CONTA_LABEL[c.categoria]}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{tipoBadge(c.tipo)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {formatCentavos(c.valorEstimado)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-center text-muted-foreground">
                          {c.diaVencimento}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Badge className={toneClass[sit.tone]}>{sit.label}</Badge>
                            {sit.gasto && sit.gasto.status === 'pago' && (
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {formatCentavos(sit.gasto.valor)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title={c.ativa ? 'Pausar conta' : 'Reativar conta'}
                              onClick={() => toggleAtiva(c)}
                            >
                              {c.ativa ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                              <PenLine className="size-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => {
                                setDeleting(c);
                                setDeleteOpen(true);
                              }}
                            >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar conta fixa' : 'Nova conta fixa'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Ajuste a previsão ou o vencimento. As faturas já lançadas não mudam.'
                : 'Todo mês o sistema lança a fatura como pendente com o valor estimado.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-nome">Nome *</Label>
              <Input
                id="c-nome"
                placeholder="Ex: Conta de luz, Aluguel da loja..."
                value={fNome}
                onChange={(e) => setFNome(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-categoria">Categoria</Label>
                <select
                  id="c-categoria"
                  className={nativeSelectClass}
                  value={fCategoria}
                  onChange={(e) => setFCategoria(e.target.value as CategoriaConta)}
                >
                  {CATEGORIAS_CONTA.map((c) => (
                    <option key={c} value={c}>{CATEGORIA_CONTA_LABEL[c]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-tipo">Tipo</Label>
                <select
                  id="c-tipo"
                  className={nativeSelectClass}
                  value={fTipo}
                  onChange={(e) => setFTipo(e.target.value as 'pessoal' | 'empresa')}
                >
                  <option value="empresa">Empresa</option>
                  {podePessoal && <option value="pessoal">Pessoal</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-valor">Valor estimado</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="c-valor"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formatBRL(fValorCents)}
                    onChange={(e) => setFValorCents(readCents(e.target.value))}
                    className="pl-10 text-right tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-dia">Dia do vencimento</Label>
                <Input
                  id="c-dia"
                  type="number"
                  min={1}
                  max={31}
                  value={fDia}
                  onChange={(e) => setFDia(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={fAtiva}
                onChange={(e) => setFAtiva(e.target.checked)}
              />
              Conta ativa (gera fatura todo mês)
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="c-obs">Observação</Label>
              <Textarea
                id="c-obs"
                placeholder="Ex: número do contrato, débito automático..."
                value={fObservacao}
                onChange={(e) => setFObservacao(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conta fixa</DialogTitle>
            <DialogDescription>
              Excluir <strong>{deleting?.nome}</strong>? As faturas pendentes dela também serão
              removidas. As já pagas ficam no histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deletingBusy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletingBusy}>
              {deletingBusy ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
