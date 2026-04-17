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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Users, UserPlus, Trash2, ShieldCheck, UserCog, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: string;
  ativo: number;
  criadoEm: string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof User; variant: 'default' | 'secondary' | 'outline' }> = {
  owner: { label: 'Dono da Loja', icon: ShieldCheck, variant: 'default' },
  employee: { label: 'Funcionario', icon: User, variant: 'secondary' },
  super_admin: { label: 'Super Admin', icon: UserCog, variant: 'outline' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function EquipePage() {
  const { user, fetchWithAuth } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/auth/invite');
      if (!res.ok) throw new Error('Erro ao carregar equipe');
      const data = await res.json();
      setUsuarios(data.usuarios);
    } catch {
      toast.error('Erro ao carregar equipe');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  function openInviteDialog() {
    setNomeInput('');
    setEmailInput('');
    setSenhaInput('');
    setDialogOpen(true);
  }

  async function handleInvite() {
    if (!nomeInput.trim() || !emailInput.trim() || !senhaInput.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (senhaInput.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeInput.trim(),
          email: emailInput.trim(),
          senha: senhaInput,
          role: 'employee',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao convidar usuario');
      }

      toast.success('Funcionario adicionado com sucesso');
      setDialogOpen(false);
      await fetchUsuarios();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar usuario');
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(u: Usuario) {
    setDeletingUser(u);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingUser) return;

    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/auth/invite/${deletingUser.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao remover usuario');
      }

      toast.success('Usuario removido com sucesso');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      await fetchUsuarios();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover usuario');
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
            <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os usuarios da sua loja
            </p>
          </div>
          <Button onClick={openInviteDialog}>
            <UserPlus className="size-4" data-icon="inline-start" />
            Adicionar Funcionario
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
            <CardContent className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C1B8FF]/10 text-[#C1B8FF]">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#1A1D1F]">{usuarios.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Total de usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
            <CardContent className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C1B8FF]/10 text-[#C1B8FF]">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#1A1D1F]">
                    {usuarios.filter(u => u.role === 'owner').length}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Administradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
            <CardContent className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <User className="size-5" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#1A1D1F]">
                    {usuarios.filter(u => u.role === 'employee').length}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Funcionarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Membros da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : usuarios.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="size-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">
                  Nenhum usuario encontrado.
                </p>
                <Button variant="outline" className="mt-4" onClick={openInviteDialog}>
                  <UserPlus className="size-4" data-icon="inline-start" />
                  Adicionar primeiro funcionario
                </Button>
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
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => {
                    const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.employee;
                    const RoleIcon = roleConfig.icon;
                    const isCurrentUser = u.id === user?.id;

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-full bg-[#C1B8FF]/10 text-sm font-bold text-[#C1B8FF]">
                              {u.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">
                                {u.nome}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-muted-foreground">(voce)</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleConfig.variant} className="gap-1">
                            <RoleIcon className="size-3" />
                            {roleConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.ativo ? 'default' : 'destructive'}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(u.criadoEm)}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isCurrentUser && u.role !== 'owner' && (
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => openDeleteDialog(u)}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Remover</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Funcionario</DialogTitle>
            <DialogDescription>
              Crie uma conta para um novo membro da equipe. Ele tera acesso
              operacional ao estoque (visualizar produtos, registrar vendas).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-nome">Nome</Label>
              <Input
                id="invite-nome"
                placeholder="Nome completo"
                value={nomeInput}
                onChange={(e) => setNomeInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="email@exemplo.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-senha">Senha inicial</Label>
              <Input
                id="invite-senha"
                type="password"
                placeholder="Minimo 8 caracteres"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !saving) handleInvite();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={saving}>
              {saving ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Usuario</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <strong>{deletingUser?.nome}</strong> da equipe?
              Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
