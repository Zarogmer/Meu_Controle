'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Boxes } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, senha);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-[#1A1D1F] text-white">
          <Boxes className="size-7" />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1D1F]">Meu Estoque</h1>
          <p className="mt-1 text-sm text-[#9A9FA5]">
            Entre na sua conta para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full bg-[#1A1D1F] text-white hover:bg-[#1A1D1F]/90 rounded-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[#9A9FA5]">
          O acesso e liberado pelo administrador da plataforma.
        </p>
      </div>
    </div>
  );
}
