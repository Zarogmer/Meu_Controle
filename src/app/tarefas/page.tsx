'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
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
  ClipboardList,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  CircleCheckBig,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tarefa {
  id: number;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  status: string;
  criadoEm: string;
  concluidoEm: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prioridadeBadge(prioridade: string) {
  switch (prioridade) {
    case 'alta':
      return (
        <Badge className="bg-red-50 text-red-700">
          <AlertTriangle className="mr-1 size-3" />
          Alta
        </Badge>
      );
    case 'media':
      return (
        <Badge className="bg-amber-50 text-amber-700">
          <Clock className="mr-1 size-3" />
          Media
        </Badge>
      );
    default:
      return (
        <Badge className="bg-[#C1B8FF]/10 text-[#1A1D1F]">
          <Circle className="mr-1 size-3" />
          Baixa
        </Badge>
      );
  }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todas');

  // Form dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tarefa | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fTitulo, setFTitulo] = useState('');
  const [fDescricao, setFDescricao] = useState('');
  const [fPrioridade, setFPrioridade] = useState('media');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTarefa, setDeletingTarefa] = useState<Tarefa | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTarefas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== 'todas') params.set('status', filtroStatus);

      const res = await fetch(`/api/tarefas?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTarefas(data.tarefas);
    } catch {
      toast.error('Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    setLoading(true);
    fetchTarefas();
  }, [fetchTarefas]);

  // Summary
  const pendentes = tarefas.filter((t) => t.status === 'pendente');
  const altaPrioridade = pendentes.filter((t) => t.prioridade === 'alta').length;
  const now = new Date();
  const concluidasMes = tarefas.filter((t) => {
    if (t.status !== 'concluida' || !t.concluidoEm) return false;
    const d = new Date(t.concluidoEm);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  function resetForm() {
    setFTitulo('');
    setFDescricao('');
    setFPrioridade('media');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(t: Tarefa) {
    setEditing(t);
    setFTitulo(t.titulo);
    setFDescricao(t.descricao || '');
    setFPrioridade(t.prioridade);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fTitulo.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titulo: fTitulo,
        descricao: fDescricao,
        prioridade: fPrioridade,
      };

      const url = editing ? `/api/tarefas/${editing.id}` : '/api/tarefas';
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

      toast.success(editing ? 'Tarefa atualizada!' : 'Tarefa criada!');
      setDialogOpen(false);
      fetchTarefas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(t: Tarefa) {
    try {
      const newStatus = t.status === 'concluida' ? 'pendente' : 'concluida';
      const res = await fetch(`/api/tarefas/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === 'concluida' ? 'Tarefa concluída!' : 'Tarefa reaberta!');
      fetchTarefas();
    } catch {
      toast.error('Erro ao atualizar tarefa');
    }
  }

  function openDelete(t: Tarefa) {
    setDeletingTarefa(t);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingTarefa) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tarefas/${deletingTarefa.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast.success('Tarefa excluída');
      setDeleteDialogOpen(false);
      setDeletingTarefa(null);
      fetchTarefas();
    } catch {
      toast.error('Erro ao excluir tarefa');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <Button onClick={openCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            Nova Tarefa
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-[#C1B8FF]/10 p-2.5">
                <ClipboardList className="size-5 text-[#C1B8FF]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{pendentes.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-red-50 p-2.5">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{altaPrioridade}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alta Prioridade</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] border-none">
            <CardContent className="flex items-center gap-4 p-8">
              <div className="rounded-full bg-green-50 p-2.5">
                <CircleCheckBig className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1A1D1F]">{concluidasMes}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Concluídas este mês</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5">
          {(['todas', 'pendente', 'concluida'] as const).map((s) => (
            <Button
              key={s}
              variant={filtroStatus === s ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setFiltroStatus(s)}
            >
              {s === 'todas' ? 'Todas' : s === 'pendente' ? 'Pendentes' : 'Concluidas'}
            </Button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-[2rem] bg-muted" />
            ))}
          </div>
        ) : tarefas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="size-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Nenhuma tarefa encontrada.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="size-4" data-icon="inline-start" />
              Criar primeira tarefa
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tarefas.map((t) => (
              <div
                key={t.id}
                className={`bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] p-8 transition-all duration-200 ${
                  t.status === 'concluida' ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {prioridadeBadge(t.prioridade)}
                      {t.status === 'concluida' && (
                        <Badge className="bg-green-50 text-green-700">
                          <CheckCircle2 className="mr-1 size-3" />
                          Concluida
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm font-semibold ${t.status === 'concluida' ? 'line-through text-muted-foreground' : ''}`}>
                      {t.titulo}
                    </p>
                    {t.descricao && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{t.descricao}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                  <div className="text-[11px] text-muted-foreground">
                    {t.status === 'concluida' && t.concluidoEm ? (
                      <span className="text-green-600">
                        <CheckCircle2 className="inline size-3 mr-1" />
                        Concluido em {formatDateTime(t.concluidoEm)}
                      </span>
                    ) : (
                      <span>Criado em {formatShortDate(t.criadoEm)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleComplete(t)}
                      title={t.status === 'concluida' ? 'Reabrir' : 'Concluir'}
                    >
                      {t.status === 'concluida' ? (
                        <Circle className="size-4 text-muted-foreground" />
                      ) : (
                        <CheckCircle2 className="size-4 text-green-500" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(t)}
                    >
                      <PenLine className="size-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => openDelete(t)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados da tarefa.' : 'Crie uma nova tarefa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-titulo">Titulo *</Label>
              <Input
                id="t-titulo"
                placeholder="O que precisa ser feito?"
                value={fTitulo}
                onChange={(e) => setFTitulo(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-descricao">Descrição</Label>
              <Textarea
                id="t-descricao"
                placeholder="Detalhes da tarefa..."
                value={fDescricao}
                onChange={(e) => setFDescricao(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-prioridade">Prioridade</Label>
              <select
                id="t-prioridade"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={fPrioridade}
                onChange={(e) => setFPrioridade(e.target.value)}
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Tarefa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a tarefa{' '}
              <strong>{deletingTarefa?.titulo}</strong>?
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
