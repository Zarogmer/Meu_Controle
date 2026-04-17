'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  Store, Users, ShieldCheck, Search,
  Power, PowerOff, Trash2, Eye, Building2,
  TrendingUp, Activity, Package, ShoppingBag, Plus,
} from 'lucide-react';

interface Loja {
  id: number;
  nome: string;
  segmento: string;
  ativo: boolean;
  plano: string;
  dataExpiracao: string | null;
  criadoEm: string;
  totalUsuarios: number;
  totalOwners: number;
  totalProdutos: number;
  totalVendas: number;
}

interface Metrics {
  totalLojas: number;
  lojasAtivas: number;
  lojasSuspensas: number;
  totalUsuarios: number;
  usuariosAtivos: number;
  totalAdmins: number;
  totalEmployees: number;
  lojasRecentes: Loja[];
}

export default function AdminDashboard() {
  const { user, fetchWithAuth } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'suspenso'>('todos');
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [nomeLojaInput, setNomeLojaInput] = useState('');
  const [segmentoInput, setSegmentoInput] = useState('');
  const [ownerNomeInput, setOwnerNomeInput] = useState('');
  const [ownerEmailInput, setOwnerEmailInput] = useState('');
  const [ownerSenhaInput, setOwnerSenhaInput] = useState('');

  // Action dialogs
  const [actionLoja, setActionLoja] = useState<Loja | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | 'delete' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      toast.error('Erro ao carregar metricas');
    }
  }, [fetchWithAuth]);

  const fetchLojas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (busca) params.set('busca', busca);
      if (filtroStatus !== 'todos') params.set('status', filtroStatus);

      const res = await fetchWithAuth(`/api/admin/tenants?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLojas(data.lojas);
      }
    } catch {
      toast.error('Erro ao carregar lojas');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, busca, filtroStatus]);

  useEffect(() => {
    fetchMetrics();
    fetchLojas();
  }, [fetchMetrics, fetchLojas]);

  function openCreateDialog() {
    setNomeLojaInput('');
    setSegmentoInput('');
    setOwnerNomeInput('');
    setOwnerEmailInput('');
    setOwnerSenhaInput('');
    setCreateOpen(true);
  }

  async function handleCreateLoja() {
    if (!nomeLojaInput.trim() || !segmentoInput.trim() || !ownerNomeInput.trim() || !ownerEmailInput.trim() || !ownerSenhaInput.trim()) {
      toast.error('Preencha todos os campos da nova loja');
      return;
    }

    if (ownerSenhaInput.length < 8) {
      toast.error('A senha inicial deve ter pelo menos 8 caracteres');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeLoja: nomeLojaInput.trim(),
          segmento: segmentoInput.trim(),
          nome: ownerNomeInput.trim(),
          email: ownerEmailInput.trim(),
          senha: ownerSenhaInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar loja');
      }

      toast.success(`Loja "${data.loja.nome}" criada com sucesso`);
      setCreateOpen(false);
      await Promise.all([fetchMetrics(), fetchLojas()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar loja');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleAction() {
    if (!actionLoja || !actionType) return;
    setActionLoading(true);

    try {
      if (actionType === 'delete') {
        const res = await fetchWithAuth(`/api/admin/tenants/${actionLoja.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success(`Loja "${actionLoja.nome}" excluida`);
      } else {
        const ativo = actionType === 'activate';
        const res = await fetchWithAuth(`/api/admin/tenants/${actionLoja.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativo }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success(`Loja "${actionLoja.nome}" ${ativo ? 'ativada' : 'suspensa'}`);
      }

      setActionLoja(null);
      setActionType(null);
      await Promise.all([fetchMetrics(), fetchLojas()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na operacao');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#1A1D1F]">
                Ecossistema MeuEstoque
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestao global de parceiros e infraestrutura
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={openCreateDialog} className="rounded-full bg-[#1A1D1F] text-white hover:bg-[#1A1D1F]/90">
                <Plus className="size-4 mr-1.5" />
                Nova Loja
              </Button>
              <Badge variant="secondary" className="bg-[#C1B8FF]/10 text-[#C1B8FF] border-[#C1B8FF]/30 hidden sm:flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                Super Admin: {user?.nome?.split(' ')[0]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<Building2 className="size-5" />}
            label="Total de Lojas"
            value={metrics?.totalLojas ?? 0}
            color="bg-[#C1B8FF]/10 text-[#C1B8FF]"
          />
          <MetricCard
            icon={<Activity className="size-5" />}
            label="Lojas Ativas"
            value={metrics?.lojasAtivas ?? 0}
            sub={metrics?.lojasSuspensas ? `${metrics.lojasSuspensas} suspensa(s)` : undefined}
            color="bg-emerald-50 text-emerald-600"
          />
          <MetricCard
            icon={<Users className="size-5" />}
            label="Total de Usuarios"
            value={metrics?.totalUsuarios ?? 0}
            sub={`${metrics?.usuariosAtivos ?? 0} ativos`}
            color="bg-[#C1B8FF]/10 text-[#C1B8FF]"
          />
          <MetricCard
            icon={<TrendingUp className="size-5" />}
            label="Admins / Funcionarios"
            value={`${metrics?.totalAdmins ?? 0} / ${metrics?.totalEmployees ?? 0}`}
            color="bg-[#FED97B]/20 text-amber-600"
          />
        </div>

        {/* Tenants Table */}
        <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Lojas Cadastradas
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar loja..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(['todos', 'ativo', 'suspenso'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFiltroStatus(s)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                        filtroStatus === s
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : lojas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Store className="size-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Nenhuma loja encontrada.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identificacao</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Metricas de Uso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Controles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lojas.map((loja) => (
                    <TableRow key={loja.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-[#C1B8FF]/10 text-[#C1B8FF]">
                            <Store className="size-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#1A1D1F]">{loja.nome}</span>
                            <span className="text-xs text-muted-foreground capitalize">{loja.segmento} · ID: {loja.id}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={
                          loja.plano === 'enterprise' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          loja.plano === 'premium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-gray-50 text-gray-600 border-gray-100'
                        }>
                          {loja.plano === 'free' ? 'Free' : loja.plano === 'premium' ? 'Premium' : 'Enterprise'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-4 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1"><Package size={12} /> {loja.totalProdutos} prod</span>
                          <span className="flex items-center gap-1"><ShoppingBag size={12} /> {loja.totalVendas} vendas</span>
                          <span className="flex items-center gap-1"><Users size={12} /> {loja.totalUsuarios}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={loja.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}>
                          {loja.ativo ? 'Operacional' : 'Suspenso'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/${loja.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="size-3.5 mr-1.5" /> Ver
                            </Button>
                          </Link>
                          {loja.ativo ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-600 border-amber-200 hover:bg-amber-50"
                              onClick={() => { setActionLoja(loja); setActionType('suspend'); }}
                            >
                              <PowerOff className="size-3.5 mr-1.5" /> Suspender
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => { setActionLoja(loja); setActionType('activate'); }}
                            >
                              <Power className="size-3.5 mr-1.5" /> Ativar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => { setActionLoja(loja); setActionType('delete'); }}
                          >
                            <Trash2 className="size-3.5" />
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

      {/* Action Confirmation Dialog */}
      <Dialog
        open={!!actionLoja && !!actionType}
        onOpenChange={(open) => { if (!open) { setActionLoja(null); setActionType(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'delete' && 'Excluir Loja'}
              {actionType === 'suspend' && 'Suspender Loja'}
              {actionType === 'activate' && 'Ativar Loja'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'delete' && (
                <>Tem certeza que deseja excluir permanentemente a loja <strong>{actionLoja?.nome}</strong>? Todos os dados e usuarios serao removidos. Esta acao nao pode ser desfeita.</>
              )}
              {actionType === 'suspend' && (
                <>Deseja suspender a loja <strong>{actionLoja?.nome}</strong>? Os usuarios nao conseguirao fazer login enquanto a loja estiver suspensa.</>
              )}
              {actionType === 'activate' && (
                <>Deseja reativar a loja <strong>{actionLoja?.nome}</strong>? Os usuarios poderao fazer login novamente.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setActionLoja(null); setActionType(null); }}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button
              variant={actionType === 'delete' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processando...' : (
                actionType === 'delete' ? 'Excluir' :
                actionType === 'suspend' ? 'Suspender' : 'Ativar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Loja</DialogTitle>
            <DialogDescription>
              Crie a loja e a conta principal que vai administrar esse tenant.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nome-loja">Nome da loja</Label>
              <Input
                id="nome-loja"
                value={nomeLojaInput}
                onChange={(e) => setNomeLojaInput(e.target.value)}
                placeholder="Ex: Loja Centro"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="segmento-loja">Segmento</Label>
              <Input
                id="segmento-loja"
                value={segmentoInput}
                onChange={(e) => setSegmentoInput(e.target.value)}
                placeholder="Ex: roupas"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="owner-nome">Responsavel</Label>
              <Input
                id="owner-nome"
                value={ownerNomeInput}
                onChange={(e) => setOwnerNomeInput(e.target.value)}
                placeholder="Nome do dono da loja"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="owner-email">Email do responsavel</Label>
              <Input
                id="owner-email"
                type="email"
                value={ownerEmailInput}
                onChange={(e) => setOwnerEmailInput(e.target.value)}
                placeholder="email@loja.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="owner-senha">Senha inicial</Label>
              <Input
                id="owner-senha"
                type="password"
                value={ownerSenhaInput}
                onChange={(e) => setOwnerSenhaInput(e.target.value)}
                placeholder="Minimo 8 caracteres"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !createLoading) {
                    handleCreateLoja();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLoja} disabled={createLoading}>
              {createLoading ? 'Criando...' : 'Criar Loja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function MetricCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
      <CardContent className="p-8">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${color}`}>
            {icon}
          </div>
          <div>
            <p className="text-3xl font-bold text-[#1A1D1F]">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">{label}</p>
            {sub && <p className="text-[10px] text-[#1A1D1F]/30">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
