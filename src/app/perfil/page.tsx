'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AtSign, Mail, Phone, Save, User as UserIcon } from 'lucide-react';

// Pretty-prints digits as "(11) 91234-5678" / "(11) 1234-5678".
// Pure presentation — the API receives the raw string and normalizes to digits only.
function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function PerfilPage() {
  const { user, loading, refresh } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNome(user.nome ?? '');
    setEmail(user.email ?? '');
    setTelefone(formatPhone(user.telefone ?? ''));
    setWhatsapp(formatPhone(user.whatsapp ?? ''));
    setInstagram(user.instagram ?? '');
  }, [user]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const res = await fetch('/api/auth/perfil', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, telefone, whatsapp, instagram }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error ?? 'Não foi possível salvar o perfil');
      }

      toast.success('Perfil atualizado');
      if (refresh) await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  }

  function copyWhatsappFromPhone() {
    setWhatsapp(telefone);
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
          <p className="text-sm text-muted-foreground">
            Atualize seus dados de contato para facilitar a comunicação com clientes e equipe.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !user ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="perfil-nome" className="flex items-center gap-1.5">
                    <UserIcon className="size-3.5 text-muted-foreground" />
                    Nome completo
                  </Label>
                  <Input
                    id="perfil-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    required
                    maxLength={120}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="perfil-email" className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="perfil-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    required
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para entrar no sistema. Ao alterar, use o novo email no próximo login.
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-telefone" className="flex items-center gap-1.5">
                      <Phone className="size-3.5 text-muted-foreground" />
                      Telefone
                    </Label>
                    <Input
                      id="perfil-telefone"
                      inputMode="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      placeholder="(11) 91234-5678"
                      maxLength={16}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-whatsapp" className="flex items-center gap-1.5">
                      <Phone className="size-3.5 text-muted-foreground" />
                      WhatsApp
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="perfil-whatsapp"
                        inputMode="tel"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                        placeholder="(11) 91234-5678"
                        maxLength={16}
                      />
                      {telefone && telefone !== whatsapp && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyWhatsappFromPhone}
                          className="shrink-0"
                        >
                          Mesmo do telefone
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="perfil-instagram" className="flex items-center gap-1.5">
                    <AtSign className="size-3.5 text-muted-foreground" />
                    Instagram
                  </Label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="perfil-instagram"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value.replace(/^@+/, ''))}
                      placeholder="seu_perfil"
                      className="pl-9"
                      maxLength={60}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={saving} className="gap-1.5">
                    <Save className="size-4" />
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
