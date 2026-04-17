'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft, Store, Users, ShieldCheck, User, Calendar,
} from 'lucide-react';

interface Loja {
  id: number;
  nome: string;
  segmento: string;
  ativo: number;
  criadoEm: string;
  logoUrl: string | null;
  corPrimaria: string | null;
}

interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: string;
  ativo: number;
  criadoEm: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dono da Loja',
  employee: 'Funcionario',
  super_admin: 'Super Admin',
};

export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { fetchWithAuth } = useAuth();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenant = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/admin/tenants/${id}`);
      if (!res.ok) {
        toast.error('Loja nao encontrada');
        router.push('/admin');
        return;
      }
      const data = await res.json();
      setLoja(data.loja);
      setUsuarios(data.usuarios);
    } catch {
      toast.error('Erro ao carregar loja');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, id, router]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-[2rem]" />
            <Skeleton className="h-24 rounded-[2rem]" />
            <Skeleton className="h-24 rounded-[2rem]" />
          </div>
          <Skeleton className="h-64 rounded-[2rem]" />
        </div>
      </AppLayout>
    );
  }

  if (!loja) return null;

  const admins = usuarios.filter(u => u.role === 'owner');
  const employees = usuarios.filter(u => u.role === 'employee');

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push('/admin')}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{loja.nome}</h1>
              <Badge variant={loja.ativo ? 'default' : 'destructive'}>
                {loja.ativo ? 'Ativa' : 'Suspensa'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 capitalize">
              {loja.segmento}
            </p>
          </div>
        </div>

        {/* Info Cards */}
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
                  <p className="text-3xl font-bold text-[#1A1D1F]">{admins.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Administradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
            <CardContent className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Calendar className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1A1D1F]">{formatDate(loja.criadoEm)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A1D1F]/40">Data de criacao</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Usuarios desta Loja
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usuarios.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="size-10 text-muted-foreground/30" />
                <p className="mt-3 text-muted-foreground">Nenhum usuario cadastrado.</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-[#C1B8FF]/10 text-xs font-bold text-[#C1B8FF]">
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{u.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'owner' ? 'default' : 'secondary'}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.ativo ? 'default' : 'destructive'}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(u.criadoEm)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
