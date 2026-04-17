'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { toast } from 'sonner';
import { Plus, PenLine, Trash2, Layers } from 'lucide-react';
import { IconPicker, DynamicIcon } from '@/components/IconPicker';

interface Categoria {
  id: number;
  nome: string;
  icone: string | null;
  criadoEm: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [nomeInput, setNomeInput] = useState('');
  const [iconeInput, setIconeInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCategoria, setDeletingCategoria] = useState<Categoria | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await fetch('/api/categorias', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar categorias');
      const data = await res.json();
      setCategorias(data.categorias);
    } catch {
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  function openCreateDialog() {
    setEditingCategoria(null);
    setNomeInput('');
    setIconeInput('');
    setDialogOpen(true);
  }

  function openEditDialog(categoria: Categoria) {
    setEditingCategoria(categoria);
    setNomeInput(categoria.nome);
    setIconeInput(categoria.icone || '');
    setDialogOpen(true);
  }

  function openDeleteDialog(categoria: Categoria) {
    setDeletingCategoria(categoria);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    const nome = nomeInput.trim();
    if (!nome) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingCategoria) {
        const res = await fetch(`/api/categorias/${editingCategoria.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ nome, icone: iconeInput || null }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao atualizar categoria');
        }
        toast.success('Categoria atualizada com sucesso');
      } else {
        const res = await fetch('/api/categorias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ nome, icone: iconeInput || null }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao criar categoria');
        }
        toast.success('Categoria criada com sucesso');
      }
      setDialogOpen(false);
      setNomeInput('');
      setIconeInput('');
      setEditingCategoria(null);
      await fetchCategorias();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar categoria');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingCategoria) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/categorias/${deletingCategoria.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao excluir categoria');
      }
      toast.success('Categoria excluída com sucesso');
      setDeleteDialogOpen(false);
      setDeletingCategoria(null);
      await fetchCategorias();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir categoria');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie as categorias dos seus produtos</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" data-icon="inline-start" />
            Nova Categoria
          </Button>
        </div>

        {/* Categories Card */}
        <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Lista de Categorias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : categorias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Layers className="size-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">
                  Nenhuma categoria cadastrada.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={openCreateDialog}
                >
                  <Plus className="size-4" data-icon="inline-start" />
                  Criar primeira categoria
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Icone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data de Criacao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorias.map((categoria) => (
                    <TableRow key={categoria.id}>
                      <TableCell>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C1B8FF]/10 text-[#C1B8FF]">
                          {categoria.icone ? (
                            <DynamicIcon name={categoria.icone} className="size-[18px]" />
                          ) : (
                            <Layers className="size-[18px]" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {categoria.nome}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(categoria.criadoEm)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditDialog(categoria)}
                          >
                            <PenLine className="size-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={() => openDeleteDialog(categoria)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Excluir</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              {editingCategoria
                ? 'Altere o nome e icone da categoria.'
                : 'Informe o nome e escolha um icone para a nova categoria.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome-categoria">Nome</Label>
              <Input
                id="nome-categoria"
                placeholder="Nome da categoria"
                value={nomeInput}
                onChange={(e) => setNomeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !saving) {
                    handleSave();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Icone</Label>
              <IconPicker
                value={iconeInput}
                onChange={setIconeInput}
                placeholder="Escolher icone..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Categoria</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a categoria{' '}
              <strong>{deletingCategoria?.nome}</strong>? Essa acao nao pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
