'use client';

import { useCallback, useEffect, useState } from 'react';
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
import {
  Plus,
  PenLine,
  Trash2,
  Search,
  Receipt,
  CircleDollarSign,
  CircleCheckBig,
  Clock,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lancamento {
  id: number;
  tipo: string;
  descricao: string;
  valor: number;
  dataLancamento: string;
  status: string;
  observacao: string | null;
  clienteNome: string | null;
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function statusBadge(status: string) {
  switch (status) {
    case 'pago':
      return (
        <Badge className="bg-green-50 text-green-700">
          <CircleCheckBig className="mr-1 size-3" />
          Pago
        </Badge>
      );
    case 'aguardando_pagamento':
      return (
        <Badge className="bg-amber-50 text-amber-700">
          <Clock className="mr-1 size-3" />
          Aguardando
        </Badge>
      );
    case 'em_processo':
      return (
        <Badge className="bg-[#C1B8FF]/10 text-[#1A1D1F]">
          <Loader2 className="mr-1 size-3" />
          Em Processo
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}

function tipoBadge(tipo: string) {
  if (tipo === 'servico') {
    return (
      <Badge variant="outline" className="border-violet-200 text-violet-700">
        Serviço
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#C1B8FF]/30 text-[#1A1D1F]">
      Produto
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Form dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fTipo, setFTipo] = useState('produto');
  const [fDescricao, setFDescricao] = useState('');
  const [fValor, setFValor] = useState('');
  const [fDataLancamento, setFDataLancamento] = useState('');
  const [fStatus, setFStatus] = useState('aguardando_pagamento');
  const [fClienteNome, setFClienteNome] = useState('');
  const [fObservacao, setFObservacao] = useState('');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLancamento, setDeletingLancamento] = useState<Lancamento | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLancamentos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') params.set('status', filtroStatus);
      if (busca) params.set('busca', busca);

      const res = await fetch(`/api/lancamentos?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLancamentos(data.lancamentos);
    } catch {
      toast.error('Erro ao carregar lançamentos.');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, busca]);

  useEffect(() => {
    setLoading(true);
    fetchLancamentos();
  }, [fetchLancamentos]);

  // Summary
  const totalPago = lancamentos
    .filter((l) => l.status === 'pago')
    .reduce((sum, l) => sum + l.valor, 0);
  const totalAguardando = lancamentos
    .filter((l) => l.status === 'aguardando_pagamento')
    .reduce((sum, l) => sum + l.valor, 0);
  const totalEmProcesso = lancamentos
    .filter((l) => l.status === 'em_processo')
    .reduce((sum, l) => sum + l.valor, 0);

  function resetForm() {
    setFTipo('produto');
    setFDescricao('');
    setFValor('');
    setFDataLancamento(new Date().toISOString().split('T')[0]);
    setFStatus('aguardando_pagamento');
    setFClienteNome('');
    setFObservacao('');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(l: Lancamento) {
    setEditing(l);
    setFTipo(l.tipo);
    setFDescricao(l.descricao);
    setFValor((l.valor / 100).toFixed(2));
    setFDataLancamento(l.dataLancamento);
    setFStatus(l.status);
    setFClienteNome(l.clienteNome || '');
    setFObservacao(l.observacao || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fDescricao.trim()) {
      toast.error('Descrição é obrigatória.');
      return;
    }
    if (!fValor || parseFloat(fValor) <= 0) {
      toast.error('O valor deve ser maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tipo: fTipo,
        descricao: fDescricao,
        valor: fValor,
        dataLancamento: fDataLancamento,
        status: fStatus,
        clienteNome: fClienteNome,
        observacao: fObservacao,
      };

      const url = editing ? `/api/lancamentos/${editing.id}` : '/api/lancamentos';
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar');
      }

      toast.success(editing ? 'Lançamento atualizado com sucesso.' : 'Lançamento registrado com sucesso.');
      setDialogOpen(false);
      fetchLancamentos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function openDelete(l: Lancamento) {
    setDeletingLancamento(l);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingLancamento) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lancamentos/${deletingLancamento.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast.success('Lançamento excluído');
      setDeleteDialogOpen(false);
      setDeletingLancamento(null);
      fetchLancamentos();
    } catch {
      toast.error('Erro ao excluir lançamento');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Controle de caixa</p>
            <h1 className="text-2xl font-bold tracking-tight">Movimentações financeiras</h1>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            Nova movimentação
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-green-50 p-2.5">
                <CircleCheckBig className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{formatCentavos(totalPago)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Pago</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-amber-50 p-2.5">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{formatCentavos(totalAguardando)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aguardando</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-[#C1B8FF]/10 p-2.5">
                <CircleDollarSign className="size-5 text-[#C1B8FF]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{formatCentavos(totalEmProcesso)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Em Processo</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por descricao ou cliente..."
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {([
              { value: 'todos', label: 'Todos' },
              { value: 'pago', label: 'Pago' },
              { value: 'aguardando_pagamento', label: 'Aguardando' },
              { value: 'em_processo', label: 'Em Processo' },
            ] as const).map((s) => (
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
          </div>
        </div>

        {/* Table */}
        <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
          <CardHeader>
            <CardTitle>Movimentações registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl bg-muted" />
                ))}
              </div>
            ) : lancamentos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Receipt className="size-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Nenhuma movimentação registrada.</p>
                <Button variant="outline" className="mt-4" onClick={openCreate}>
                  <Plus className="size-4" data-icon="inline-start" />
                  Registrar primeira movimentação
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamentos.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{tipoBadge(l.tipo)}</TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {l.descricao}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {l.clienteNome || '—'}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCentavos(l.valor)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {formatDate(l.dataLancamento)}
                        </TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEdit(l)}
                            >
                              <PenLine className="size-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => openDelete(l)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar movimentação' : 'Nova movimentação'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados da movimentação.' : 'Registre uma nova movimentação do caixa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="l-tipo">Tipo</Label>
                <select
                  id="l-tipo"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={fTipo}
                  onChange={(e) => setFTipo(e.target.value)}
                >
                  <option value="produto">Produto</option>
                  <option value="servico">Serviço</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-status">Status</Label>
                <select
                  id="l-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value)}
                >
                  <option value="pago">Pago</option>
                  <option value="aguardando_pagamento">Aguardando Pagamento</option>
                  <option value="em_processo">Em Processo</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="l-descricao">Descrição *</Label>
              <Input
                id="l-descricao"
                placeholder="Ex: Venda de camisetas..."
                value={fDescricao}
                onChange={(e) => setFDescricao(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="l-valor">Valor (R$) *</Label>
                <Input
                  id="l-valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={fValor}
                  onChange={(e) => setFValor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-data">Data</Label>
                <Input
                  id="l-data"
                  type="date"
                  value={fDataLancamento}
                  onChange={(e) => setFDataLancamento(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="l-cliente">Nome do Cliente</Label>
              <Input
                id="l-cliente"
                placeholder="Nome do cliente (opcional)"
                value={fClienteNome}
                onChange={(e) => setFClienteNome(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="l-obs">Observação</Label>
              <Textarea
                id="l-obs"
                placeholder="Anotações extras..."
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
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir movimentação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a movimentação{' '}
              <strong>{deletingLancamento?.descricao}</strong> no valor de{' '}
              <strong>{deletingLancamento ? formatCentavos(deletingLancamento.valor) : ''}</strong>?
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
