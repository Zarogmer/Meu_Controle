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
  Smartphone,
  CircleDollarSign,
  CircleAlert,
  CircleCheckBig,
  Timer,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Divida {
  id: number;
  nomeDevedor: string;
  telefone: string | null;
  descricao: string | null;
  valorTotal: number;
  valorPago: number;
  dataCompra: string;
  dataVencimento: string | null;
  status: string;
  observacoes: string | null;
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
    case 'parcial':
      return (
        <Badge className="bg-yellow-50 text-yellow-700">
          <Timer className="mr-1 size-3" />
          Parcial
        </Badge>
      );
    default:
      return (
        <Badge className="bg-red-50 text-red-700">
          <CircleAlert className="mr-1 size-3" />
          Pendente
        </Badge>
      );
  }
}

function isOverdue(dataVencimento: string | null, status: string): boolean {
  if (!dataVencimento || status === 'pago') return false;
  return new Date(dataVencimento + 'T00:00:00') < new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeficitPage() {
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Form dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Divida | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fNome, setFNome] = useState('');
  const [fTelefone, setFTelefone] = useState('');
  const [fDescricao, setFDescricao] = useState('');
  const [fValorTotal, setFValorTotal] = useState('');
  const [fValorPago, setFValorPago] = useState('');
  const [fDataCompra, setFDataCompra] = useState('');
  const [fDataVencimento, setFDataVencimento] = useState('');
  const [fObservacoes, setFObservacoes] = useState('');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDivida, setDeletingDivida] = useState<Divida | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDividas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') params.set('status', filtroStatus);
      if (busca) params.set('busca', busca);

      const res = await fetch(`/api/dividas?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDividas(data.dividas);
    } catch {
      toast.error('Erro ao carregar dívidas');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, busca]);

  useEffect(() => {
    setLoading(true);
    fetchDividas();
  }, [fetchDividas]);

  // Summary
  const totalPendente = dividas
    .filter((d) => d.status !== 'pago')
    .reduce((sum, d) => sum + (d.valorTotal - d.valorPago), 0);
  const totalDevedores = new Set(dividas.filter((d) => d.status !== 'pago').map((d) => d.nomeDevedor)).size;
  const totalVencidas = dividas.filter((d) => isOverdue(d.dataVencimento, d.status)).length;

  function resetForm() {
    setFNome('');
    setFTelefone('');
    setFDescricao('');
    setFValorTotal('');
    setFValorPago('');
    setFDataCompra(new Date().toISOString().split('T')[0]);
    setFDataVencimento('');
    setFObservacoes('');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setFDataCompra(new Date().toISOString().split('T')[0]);
    setDialogOpen(true);
  }

  function openEdit(d: Divida) {
    setEditing(d);
    setFNome(d.nomeDevedor);
    setFTelefone(d.telefone || '');
    setFDescricao(d.descricao || '');
    setFValorTotal((d.valorTotal / 100).toFixed(2));
    setFValorPago((d.valorPago / 100).toFixed(2));
    setFDataCompra(d.dataCompra);
    setFDataVencimento(d.dataVencimento || '');
    setFObservacoes(d.observacoes || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fNome.trim()) {
      toast.error('Nome do devedor é obrigatório');
      return;
    }
    if (!fValorTotal || parseFloat(fValorTotal) <= 0) {
      toast.error('Valor total deve ser maior que zero');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nomeDevedor: fNome,
        telefone: fTelefone,
        descricao: fDescricao,
        valorTotal: fValorTotal,
        valorPago: fValorPago || '0',
        dataCompra: fDataCompra,
        dataVencimento: fDataVencimento || null,
        observacoes: fObservacoes,
      };

      const url = editing ? `/api/dividas/${editing.id}` : '/api/dividas';
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

      toast.success(editing ? 'Dívida atualizada!' : 'Dívida registrada!');
      setDialogOpen(false);
      fetchDividas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function openDelete(d: Divida) {
    setDeletingDivida(d);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingDivida) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dividas/${deletingDivida.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast.success('Dívida excluída');
      setDeleteDialogOpen(false);
      setDeletingDivida(null);
      fetchDividas();
    } catch {
      toast.error('Erro ao excluir dívida');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Deficit</h1>
          <Button onClick={openCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            Nova Divida
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-red-50 p-2.5">
                <CircleDollarSign className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{formatCentavos(totalPendente)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Total a Receber</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-orange-50 p-2.5">
                <CircleAlert className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{totalDevedores}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Devedores Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-yellow-50 p-2.5">
                <Timer className="size-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{totalVencidas}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Vencidas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {(['todos', 'pendente', 'parcial', 'pago'] as const).map((s) => (
              <Button
                key={s}
                variant={filtroStatus === s ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => setFiltroStatus(s)}
              >
                {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
          <CardHeader>
            <CardTitle>Lista de Dívidas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl bg-muted" />
                ))}
              </div>
            ) : dividas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CircleAlert className="size-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Nenhuma dívida registrada.</p>
                <Button variant="outline" className="mt-4" onClick={openCreate}>
                  <Plus className="size-4" data-icon="inline-start" />
                  Registrar primeira dívida
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Devedor</TableHead>
                      <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                      <TableHead>O que pegou</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Restante</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dividas.map((d) => {
                      const restante = d.valorTotal - d.valorPago;
                      const overdue = isOverdue(d.dataVencimento, d.status);
                      return (
                        <TableRow
                          key={d.id}
                          className={overdue ? 'bg-red-500/5' : ''}
                        >
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1.5">
                              {d.nomeDevedor}
                              {overdue && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  VENCIDA
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {d.telefone ? (
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Smartphone className="size-3" />
                                {d.telefone}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {d.descricao || '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCentavos(d.valorTotal)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCentavos(d.valorPago)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            {restante > 0 ? formatCentavos(restante) : '—'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {formatDate(d.dataCompra)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className={overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                              {formatDate(d.dataVencimento)}
                            </span>
                          </TableCell>
                          <TableCell>{statusBadge(d.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openEdit(d)}
                              >
                                <PenLine className="size-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon-sm"
                                onClick={() => openDelete(d)}
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
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Dívida' : 'Nova Dívida'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados da dívida.' : 'Registre quem está devendo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-nome">Nome do Devedor *</Label>
                <Input
                  id="d-nome"
                  placeholder="Nome completo"
                  value={fNome}
                  onChange={(e) => setFNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-telefone">Telefone</Label>
                <Input
                  id="d-telefone"
                  placeholder="(00) 00000-0000"
                  value={fTelefone}
                  onChange={(e) => setFTelefone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-descricao">O que pegou</Label>
              <Input
                id="d-descricao"
                placeholder="Ex: 2 camisetas, 1 calça jeans..."
                value={fDescricao}
                onChange={(e) => setFDescricao(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-total">Valor Total (R$) *</Label>
                <Input
                  id="d-total"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={fValorTotal}
                  onChange={(e) => setFValorTotal(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-pago">Valor Já Pago (R$)</Label>
                <Input
                  id="d-pago"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={fValorPago}
                  onChange={(e) => setFValorPago(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-data">Data da Compra</Label>
                <Input
                  id="d-data"
                  type="date"
                  value={fDataCompra}
                  onChange={(e) => setFDataCompra(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-vencimento">Data de Vencimento</Label>
                <Input
                  id="d-vencimento"
                  type="date"
                  value={fDataVencimento}
                  onChange={(e) => setFDataVencimento(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-obs">Observações</Label>
              <Textarea
                id="d-obs"
                placeholder="Anotações extras..."
                value={fObservacoes}
                onChange={(e) => setFObservacoes(e.target.value)}
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
            <DialogTitle>Excluir Dívida</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a dívida de{' '}
              <strong>{deletingDivida?.nomeDevedor}</strong> no valor de{' '}
              <strong>{deletingDivida ? formatCentavos(deletingDivida.valorTotal) : ''}</strong>?
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
