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
  Building2,
  User,
  CircleCheckBig,
  Clock,
  TrendingDown,
} from 'lucide-react';

interface Gasto {
  id: number;
  tipo: 'pessoal' | 'empresa';
  descricao: string;
  categoria: string | null;
  valor: number;
  dataGasto: string;
  status: 'pago' | 'pendente';
  observacao: string | null;
  usuarioId: number | null;
  criadoEm: string;
}

type TipoFiltro = 'todos' | 'pessoal' | 'empresa';

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

function tipoBadge(tipo: string) {
  if (tipo === 'pessoal') {
    return (
      <Badge variant="outline" className="border-violet-200 text-violet-700">
        <User className="mr-1 size-3" />
        Pessoal
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-blue-200 text-blue-700">
      <Building2 className="mr-1 size-3" />
      Empresa
    </Badge>
  );
}

function statusBadge(status: string) {
  if (status === 'pago') {
    return (
      <Badge className="bg-green-50 text-green-700">
        <CircleCheckBig className="mr-1 size-3" />
        Pago
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-50 text-amber-700">
      <Clock className="mr-1 size-3" />
      Pendente
    </Badge>
  );
}

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoFiltro>('todos');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [saving, setSaving] = useState(false);

  const [fTipo, setFTipo] = useState<'pessoal' | 'empresa'>('empresa');
  const [fDescricao, setFDescricao] = useState('');
  const [fCategoria, setFCategoria] = useState('');
  const [fValor, setFValor] = useState('');
  const [fDataGasto, setFDataGasto] = useState('');
  const [fStatus, setFStatus] = useState<'pago' | 'pendente'>('pago');
  const [fObservacao, setFObservacao] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingGasto, setDeletingGasto] = useState<Gasto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGastos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroTipo !== 'todos') params.set('tipo', filtroTipo);
      if (busca) params.set('busca', busca);

      const res = await fetch(`/api/gastos?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGastos(data.gastos);
    } catch {
      toast.error('Erro ao carregar gastos.');
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, busca]);

  useEffect(() => {
    setLoading(true);
    fetchGastos();
  }, [fetchGastos]);

  const totalEmpresa = gastos
    .filter((g) => g.tipo === 'empresa')
    .reduce((s, g) => s + g.valor, 0);
  const totalPessoal = gastos
    .filter((g) => g.tipo === 'pessoal')
    .reduce((s, g) => s + g.valor, 0);
  const totalPendente = gastos
    .filter((g) => g.status === 'pendente')
    .reduce((s, g) => s + g.valor, 0);

  function resetForm() {
    setFTipo('empresa');
    setFDescricao('');
    setFCategoria('');
    setFValor('');
    setFDataGasto(new Date().toISOString().split('T')[0]);
    setFStatus('pago');
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
    setFValor((g.valor / 100).toFixed(2));
    setFDataGasto(g.dataGasto);
    setFStatus(g.status);
    setFObservacao(g.observacao || '');
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
        categoria: fCategoria,
        valor: fValor,
        dataGasto: fDataGasto,
        status: fStatus,
        observacao: fObservacao,
      };

      const url = editing ? `/api/gastos/${editing.id}` : '/api/gastos';
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

      toast.success(editing ? 'Gasto atualizado.' : 'Gasto registrado.');
      setDialogOpen(false);
      fetchGastos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
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
      fetchGastos();
    } catch {
      toast.error('Erro ao excluir gasto');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Gastos</p>
            <h1 className="text-2xl font-bold tracking-tight">Despesas pessoais e empresariais</h1>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            Novo gasto
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-blue-50 p-2.5">
                <Building2 className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{formatCentavos(totalEmpresa)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Gastos da empresa</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-violet-50 p-2.5">
                <User className="size-5 text-violet-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{formatCentavos(totalPessoal)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Gastos pessoais</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-amber-50 p-2.5">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{formatCentavos(totalPendente)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou categoria..."
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {([
              { value: 'todos', label: 'Todos' },
              { value: 'empresa', label: 'Empresa' },
              { value: 'pessoal', label: 'Pessoal' },
            ] as const).map((s) => (
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
          </div>
        </div>

        <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
          <CardHeader>
            <CardTitle>Gastos registrados</CardTitle>
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
                <p className="mt-4 text-muted-foreground">Nenhum gasto registrado.</p>
                <Button variant="outline" className="mt-4" onClick={openCreate}>
                  <Plus className="size-4" data-icon="inline-start" />
                  Registrar primeiro gasto
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
                    {gastos.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>{tipoBadge(g.tipo)}</TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {g.descricao}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {g.categoria || '—'}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCentavos(g.valor)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {formatDate(g.dataGasto)}
                        </TableCell>
                        <TableCell>{statusBadge(g.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(g)}>
                              <PenLine className="size-4" />
                            </Button>
                            <Button variant="destructive" size="icon-sm" onClick={() => openDelete(g)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar gasto' : 'Novo gasto'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados do gasto.' : 'Registre um novo gasto pessoal ou da empresa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-tipo">Tipo</Label>
                <select
                  id="g-tipo"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={fTipo}
                  onChange={(e) => setFTipo(e.target.value as 'pessoal' | 'empresa')}
                >
                  <option value="empresa">Empresa</option>
                  <option value="pessoal">Pessoal</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-status">Status</Label>
                <select
                  id="g-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                <Label htmlFor="g-valor">Valor (R$) *</Label>
                <Input
                  id="g-valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={fValor}
                  onChange={(e) => setFValor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-data">Data</Label>
                <Input
                  id="g-data"
                  type="date"
                  value={fDataGasto}
                  onChange={(e) => setFDataGasto(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="g-categoria">Categoria</Label>
              <Input
                id="g-categoria"
                placeholder="Ex: Alimentação, Moradia, Fornecedor..."
                value={fCategoria}
                onChange={(e) => setFCategoria(e.target.value)}
              />
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
            <DialogTitle>Excluir gasto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o gasto{' '}
              <strong>{deletingGasto?.descricao}</strong> no valor de{' '}
              <strong>{deletingGasto ? formatCentavos(deletingGasto.valor) : ''}</strong>?
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
