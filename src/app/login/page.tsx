'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { MascotCube } from '@/components/MascotCube';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  // Login screen is always light regardless of the user's saved theme.
  // We flip the <html> class directly because next-themes doesn't expose
  // per-route forcedTheme, and we restore the previous class on unmount.
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains('dark');
    html.classList.remove('dark');
    html.style.colorScheme = 'light';
    return () => {
      if (hadDark) html.classList.add('dark');
      html.style.colorScheme = '';
    };
  }, []);

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
    <div className="app-shell min-h-screen px-4 py-10 text-foreground">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <ShieldCheck className="size-4" />
              Painel interno para operação e gestão
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-foreground">
              Meu Controle
            </h1>
            <p className="mt-4 text-xl text-muted-foreground">
              Seu negócio na sua mão.
            </p>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">
              Acompanhe caixa, produtos, rotina da equipe e indicadores do negócio em um único painel claro, moderno e feito para operação real.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <FeatureCard title="Controle diário" description="Organize produtos, contas e movimentações do negócio." />
              <FeatureCard title="Visão clara" description="Tenha leitura rápida do que exige atenção agora." />
              <FeatureCard title="Base escalável" description="Prepare sua operação para crescer com mais ordem." />
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border/80 bg-card/95 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur">
            <div className="mb-6 flex items-center gap-4">
              <div
                className="cosmic-glow flex size-14 items-center justify-center rounded-[1.5rem]"
                style={{ backgroundColor: 'var(--mascot-bg)' }}
              >
                <MascotCube size={42} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Meu Controle</h1>
                <p className="text-sm text-muted-foreground">Entre na sua conta para continuar</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="você@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-background"
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
                  className="h-12 rounded-xl bg-background"
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Acessar painel'}
                {!loading && <ArrowRight className="ml-2 size-4" />}
              </Button>
            </form>

            <div className="mt-6 rounded-2xl bg-accent px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Plataforma interna para acompanhar operação, caixa, produtos e desempenho do negócio.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-card/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
