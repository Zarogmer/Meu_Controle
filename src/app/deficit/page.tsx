'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CircleAlert,
  CircleCheckBig,
  CircleDollarSign,
  PenLine,
  Plus,
  Search,
  Smartphone,
  Timer,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatPhone } from '@/lib/format';

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
}

function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(`${dateStr}T00:00:00`);
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
  return new Date(`${dataVencimento}T00:00:00`) < new Date(`${new Date().toISOString().split('T')[0]}T00:00:00`);
}

export default function DeficitPage() {
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Divida | null>(null);
  const [saving, setSaving] = useState(false);

  const [fNome, setFNome] = useState('');
  const [fTelefone, setFTelefone] = useState('');
  const [fDescricao, setFDescricao] = useState('');
  const [fValorTotal, setFValorTotal] = useState('');
  const [fValorPago, setFValorPago] = useState('');
  const [fDataCompra, setFDataCompra] = useState('');
  const [fDataVencimento, setFDataVencimento] = useState('');
  const [fObservacoes, setFObservacoes] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDivida, setDeletingDivida] = useState<Divida | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDividas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') params.set('status', filtroStatus);
      if (busca) params.set('busca', busca);

      const response = await fetch(`/api/dividas?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setDividas(data.dividas);
    } catch {
      toast.error('Erro ao carregar as contas.');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, busca]);

  useEffect(() => {
    setLoading(true);
    fetchDividas();
  }, [fetchDividas]);

  const totalPendente = dividas
    .filter((item) => item.status !== 'pago')
    .reduce((sum, item) => sum + (item.valorTotal - item.valorPago), 0);

  const totalDevedores = new Set(
    dividas.filter((item) => item.status !== 'pago').map((item) => item.nomeDevedor)
  ).size;

  const totalVencidas = dividas.filter((item) => isOverdue(item.dataVencimento, item.status)).length;

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
    setDialogOpen(true);
  }

  function openEdit(divida: Divida) {
    setEditing(divida);
    setFNome(divida.nomeDevedor);
    setFTelefone(formatPhone(divida.telefone || ''));
    setFDescricao(divida.descricao || '');
    setFValorTotal((divida.valorTotal / 100).toFixed(2));
    setFValorPago((divida.valorPago / 100).toFixed(2));
    setFDataCompra(divida.dataCompra);
    setFDataVencimento(divida.dataVencimento || '');
    setFObservacoes(divida.observacoes || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fNome.trim()) {
      toast.error('O nome do devedor é obrigatório.');
      return;
    }

    if (!fValorTotal || parseFloat(fValorTotal) <= 0) {
      toast.error('O valor total deve ser maior que zero.');
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

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar a conta.');
      }

      toast.success(editing ? 'Conta atualizada com sucesso.' : 'Conta registrada com sucesso.');
      setDialogOpen(false);
      fetchDividas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a conta.');
    } finally {
      setSaving(false);
    }
  }

  function openDelete(divida: Divida) {
    setDeletingDivida(divida);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingDivida) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/dividas/${deletingDivida.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error();

      toast.success('Conta excluída com sucesso.');
      setDeleteDialogOpen(false);
      setDeletingDivida(null);
      fetchDividas();
    } catch {
      toast.error('Erro ao excluir a conta.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Contas a receber</p>
            <h1 className="text-2xl font-bold tracking-tight">Controle de recebimentos</h1>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            Nova conta
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="rounded-[2rem] border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-red-50 p-2.5">
                <CircleDollarSign className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{formatCentavos(totalPendente)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total a receber</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-orange-50 p-2.5">
                <CircleAlert className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{totalDevedores}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Devedores ativos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-yellow-50 p-2.5">
                <Timer className="size-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{totalVencidas}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vencidas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              className="pl-9"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {(['todos', 'pendente', 'parcial', 'pago'] as const).map((status) => (
              <Button
                key={status}
                variant={filtroStatus === status ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => setFiltroStatus(status)}
              >
                {status === 'todos' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <Card className="rounded-[2rem] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardHeader>
            <CardTitle>Contas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-xl bg-muted" />
                ))}
              </div>
            ) : dividas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CircleAlert className="size-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Nenhuma conta registrada.</p>
                <Button variant="outline" className="mt-4" onClick={openCreate}>
                  <Plus className="size-4" data-icon="inline-start" />
                  Registrar primeira conta
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Devedor</TableHead>
                      <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor total</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Restante</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dividas.map((divida) => {
                      const restante = divida.valorTotal - divida.valorPago;
                      const overdue = isOverdue(divida.dataVencimento, divida.status);

                      return (
                        <TableRow key={divida.id} className={overdue ? 'bg-red-500/5' : ''}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1.5">
                              {divida.nomeDevedor}
                              {overdue && (
                                <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                                  Vencida
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {divida.telefone ? (
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Smartphone className="size-3" />
                                {formatPhone(divida.telefone)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground">
                            {divida.descricao || '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCentavos(divida.valorTotal)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCentavos(divida.valorPago)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            {restante > 0 ? formatCentavos(restante) : '—'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {formatDate(divida.dataCompra)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className={overdue ? 'font-medium text-red-600' : 'text-muted-foreground'}>
                              {formatDate(divida.dataVencimento)}
                            </span>
                          </TableCell>
                          <TableCell>{statusBadge(divida.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openEdit(divida)}>
                                <PenLine className="size-4" />
                              </Button>
                              <Button variant="destructive" size="icon-sm" onClick={() => openDelete(divida)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar conta' : 'Nova conta a receber'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados da conta.' : 'Registre quem está devendo para a sua loja.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-nome">Nome do devedor *</Label>
                <Input
                  id="d-nome"
                  placeholder="Nome completo"
                  value={fNome}
                  onChange={(event) => setFNome(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-telefone">Telefone</Label>
                <Input
                  id="d-telefone"
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  value={fTelefone}
                  onChange={(event) => setFTelefone(formatPhone(event.target.value))}
                  maxLength={16}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-descricao">Descrição</Label>
              <Input
                id="d-descricao"
                placeholder="Ex: 2 camisetas, 1 calça jeans..."
                value={fDescricao}
                onChange={(event) => setFDescricao(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-total">Valor total (R$) *</Label>
                <Input
                  id="d-total"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={fValorTotal}
                  onChange={(event) => setFValorTotal(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-pago">Valor já pago (R$)</Label>
                <Input
                  id="d-pago"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={fValorPago}
                  onChange={(event) => setFValorPago(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-data">Data da compra</Label>
                <Input
                  id="d-data"
                  type="date"
                  value={fDataCompra}
                  onChange={(event) => setFDataCompra(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-vencimento">Data de vencimento</Label>
                <Input
                  id="d-vencimento"
                  type="date"
                  value={fDataVencimento}
                  onChange={(event) => setFDataVencimento(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-obs">Observações</Label>
              <Textarea
                id="d-obs"
                placeholder="Anotações extras..."
                value={fObservacoes}
                onChange={(event) => setFObservacoes(event.target.value)}
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a conta de{' '}
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
