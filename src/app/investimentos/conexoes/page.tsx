'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plug, PlugZap, RefreshCw, Trash2, Wifi, WifiOff, Radio, Landmark, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  type ContaCorretora,
  type PosicaoLista,
  CORRETORA_LABEL,
  formatCentavos,
  formatResultado,
  corResultado,
  formatPreco,
} from '@/components/investimentos/shared';

interface Integracao {
  id: number;
  contaCorretoraId: number;
  provider: string;
  urlConector: string;
  tokenMascarado: string;
  temChaveAtivacao: boolean;
  status: 'desconectado' | 'conectado' | 'erro';
  ultimoSyncEm: string | null;
  ultimoErro: string | null;
  cursorTrades: string | null;
  ultimoHealth: {
    online?: boolean; modo?: string; pronto?: boolean; verificadoEm?: string; sincronizadoEm?: string;
    detalhes?: { estados?: Record<string, { result: number; label: string }>; conta?: unknown; assinaturas?: string[]; versaoConector?: string | null };
  } | null;
  atualizadoEm: string;
}

interface Conexao {
  conta: Pick<ContaCorretora, 'id' | 'apelido' | 'corretora' | 'ativa'>;
  integracao: Integracao | null;
}

interface CotacaoViva {
  last: number | null;
  bid: number | null;
  ask: number | null;
  updated_at: string | null;
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(i: Integracao | null) {
  if (!i) return <Badge variant="outline">Sem conexão</Badge>;
  if (i.status === 'conectado') {
    return (
      <Badge className="bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">
        <Wifi className="mr-1 size-3" />
        Online{i.ultimoHealth?.pronto === false ? ' (aguardando DLL)' : ''}
      </Badge>
    );
  }
  if (i.status === 'erro') {
    return (
      <Badge className="bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300">
        <WifiOff className="mr-1 size-3" />
        Offline
      </Badge>
    );
  }
  return <Badge className="bg-muted text-muted-foreground">Não testada</Badge>;
}

export default function ConexoesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // formulário por conta
  const [form, setForm] = useState<Record<number, { url: string; token: string; chave: string }>>({});
  const [removendo, setRemovendo] = useState<Integracao | null>(null);

  // cotações ao vivo
  const [vivoConta, setVivoConta] = useState<number | null>(null);
  const [posicoes, setPosicoes] = useState<PosicaoLista[]>([]);
  const [cotacoes, setCotacoes] = useState<Record<string, CotacaoViva>>({});
  const [wsEstado, setWsEstado] = useState<'fechado' | 'conectando' | 'aberto' | 'erro'>('fechado');
  const wsRef = useRef<WebSocket | null>(null);
  const ultimoEnvioRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && user && user.role === 'employee') router.replace('/dashboard');
  }, [authLoading, user, router]);

  const fetchConexoes = useCallback(async () => {
    try {
      const res = await fetch('/api/investimentos/conexoes', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConexoes(data.conexoes ?? []);
      setForm((f) => {
        const novo = { ...f };
        for (const c of data.conexoes as Conexao[]) {
          if (!novo[c.conta.id]) novo[c.conta.id] = { url: c.integracao?.urlConector ?? '', token: '', chave: '' };
        }
        return novo;
      });
    } catch {
      toast.error('Erro ao carregar conexões.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== 'employee') fetchConexoes();
  }, [user, fetchConexoes]);

  function atualizarIntegracao(integracao: Integracao) {
    setConexoes((cs) => cs.map((c) => (c.conta.id === integracao.contaCorretoraId ? { ...c, integracao } : c)));
  }

  async function salvar(contaId: number) {
    const f = form[contaId];
    if (!f?.url.trim()) return void toast.error('Informe a URL do conector.');
    setBusy(`salvar-${contaId}`);
    try {
      const res = await fetch('/api/investimentos/conexoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contaCorretoraId: contaId, urlConector: f.url, token: f.token || undefined, chaveAtivacao: f.chave || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      atualizarIntegracao(data.integracao);
      setForm((x) => ({ ...x, [contaId]: { ...x[contaId], token: '', chave: '' } }));
      toast.success('Conexão salva. Teste a conexão para confirmar.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setBusy(null);
    }
  }

  async function testar(i: Integracao) {
    setBusy(`testar-${i.id}`);
    try {
      const res = await fetch(`/api/investimentos/conexoes/${i.id}/testar`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao testar');
      atualizarIntegracao(data.integracao);
      if (data.ok) toast.success(data.status?.pronto ? 'Conector online e DLL conectada.' : 'Conector online, mas a DLL ainda não está pronta.');
      else toast.error(`Conector offline: ${data.error}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao testar');
    } finally {
      setBusy(null);
    }
  }

  async function sincronizar(i: Integracao) {
    setBusy(`sync-${i.id}`);
    try {
      const res = await fetch(`/api/investimentos/conexoes/${i.id}/sincronizar`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar');
      atualizarIntegracao(data.integracao);
      const r = data.resultado;
      if (r?.ok) toast.success(`${r.novas} operação(ões) nova(s), ${r.cotacoesAtualizadas} cotação(ões) atualizada(s).`);
      else toast.error(`Falha na sincronização: ${r?.erro ?? 'erro'}`);
      if (vivoConta === i.contaCorretoraId) carregarPosicoes(i.contaCorretoraId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setBusy(null);
    }
  }

  async function remover() {
    if (!removendo) return;
    setBusy(`remover-${removendo.id}`);
    try {
      const res = await fetch(`/api/investimentos/conexoes/${removendo.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      toast.success('Conexão removida. As operações já sincronizadas ficam.');
      setRemovendo(null);
      if (vivoConta === removendo.contaCorretoraId) pararVivo();
      fetchConexoes();
    } catch {
      toast.error('Erro ao remover conexão.');
    } finally {
      setBusy(null);
    }
  }

  // ── cotações ao vivo ──────────────────────────────────────────
  const carregarPosicoes = useCallback(async (contaId: number) => {
    const res = await fetch(`/api/investimentos/resumo?contaCorretoraId=${contaId}`, { credentials: 'include' });
    if (res.ok) setPosicoes((await res.json()).posicoes ?? []);
  }, []);

  function pararVivo() {
    wsRef.current?.close();
    wsRef.current = null;
    setVivoConta(null);
    setWsEstado('fechado');
    setCotacoes({});
  }

  async function iniciarVivo(i: Integracao) {
    pararVivo();
    setVivoConta(i.contaCorretoraId);
    setWsEstado('conectando');
    try {
      await carregarPosicoes(i.contaCorretoraId);
      const res = await fetch(`/api/investimentos/conexoes/${i.id}/ticket`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao obter acesso ao conector');
      const ws = new WebSocket(data.url);
      wsRef.current = ws;
      ws.onopen = () => {
        setWsEstado('aberto');
        if (Array.isArray(data.ativos) && data.ativos.length > 0) {
          ws.send(JSON.stringify({ subscribe: data.ativos.map((a: { ativo: string; bolsa: string }) => ({ ticker: a.ativo, exchange: a.bolsa })) }));
        }
      };
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === 'quote' && m.ticker) {
            const ativo = String(m.ticker).toUpperCase();
            setCotacoes((c) => ({ ...c, [ativo]: { last: m.last ?? null, bid: m.bid ?? null, ask: m.ask ?? null, updated_at: m.updated_at ?? null } }));
            // alimenta o cache de cotações do app (no máximo a cada 15 s por ativo)
            const agora = Date.now();
            if (m.last && agora - (ultimoEnvioRef.current[ativo] ?? 0) > 15000) {
              ultimoEnvioRef.current[ativo] = agora;
              fetch('/api/investimentos/cotacoes', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ ativo, preco: m.last }),
              }).catch(() => {});
            }
          } else if (m.type === 'fill') {
            toast.info(`Execução: ${m.side === 1 ? 'compra' : 'venda'} ${m.quantity} ${m.ticker} @ ${m.price}`);
          }
        } catch { /* ignora */ }
      };
      ws.onerror = () => setWsEstado('erro');
      ws.onclose = () => setWsEstado((s) => (s === 'erro' ? 'erro' : 'fechado'));
    } catch (err) {
      setWsEstado('erro');
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir cotações ao vivo');
    }
  }

  useEffect(() => () => { wsRef.current?.close(); }, []);

  if (authLoading || (user && user.role === 'employee')) {
    return <AppLayout><Skeleton className="h-40 rounded-[2rem] bg-muted" /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/investimentos" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3" /> Investimentos
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Conexões</p>
            <h1 className="text-2xl font-bold tracking-tight">Corretora conectada (Nelogica / Ágora)</h1>
          </div>
        </div>

        <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
          <CardContent className="flex flex-col gap-3 p-6 text-sm text-muted-foreground sm:flex-row sm:items-start">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Como funciona</p>
              <p className="mt-1">
                O conector roda no seu Windows com a ProfitDLL e a sua licença. Aqui você só informa a URL pública dele
                (via túnel HTTPS) e o token gerado por <code className="rounded bg-muted px-1">python run.py --gerar-token</code>.
                Senha da corretora e chave de ativação ficam na sua máquina. Veja <code className="rounded bg-muted px-1">connectors/nelogica/README.md</code>.
              </p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Skeleton className="h-48 rounded-[2rem] bg-muted" />
        ) : conexoes.length === 0 ? (
          <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Landmark className="size-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Cadastre uma conta de corretora em Investimentos → Contas antes de conectar.</p>
            </CardContent>
          </Card>
        ) : (
          conexoes.map(({ conta, integracao }) => {
            const f = form[conta.id] ?? { url: '', token: '', chave: '' };
            const estados = integracao?.ultimoHealth?.detalhes?.estados ?? {};
            return (
              <Card key={conta.id} className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {integracao ? <PlugZap className="size-5" /> : <Plug className="size-5" />}
                    </div>
                    <div>
                      <CardTitle>{conta.apelido}</CardTitle>
                      <p className="text-xs text-muted-foreground">{CORRETORA_LABEL[conta.corretora] ?? conta.corretora}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(integracao)}
                    {integracao && (
                      <span className="text-xs text-muted-foreground">
                        Último sync: {fmtDataHora(integracao.ultimoSyncEm)}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid gap-3 lg:grid-cols-[2fr_1.5fr_1.5fr]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`url-${conta.id}`}>URL do conector</Label>
                      <Input id={`url-${conta.id}`} placeholder="https://meu-conector.exemplo.com" value={f.url} onChange={(e) => setForm((x) => ({ ...x, [conta.id]: { ...f, url: e.target.value } }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`token-${conta.id}`}>Token do conector</Label>
                      <Input id={`token-${conta.id}`} type="password" autoComplete="off" placeholder={integracao ? `salvo (${integracao.tokenMascarado}) — deixe vazio para manter` : 'cole o CONNECTOR_TOKEN'} value={f.token} onChange={(e) => setForm((x) => ({ ...x, [conta.id]: { ...f, token: e.target.value } }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`chave-${conta.id}`}>Chave de ativação (opcional)</Label>
                      <Input id={`chave-${conta.id}`} type="password" autoComplete="off" placeholder={integracao?.temChaveAtivacao ? 'salva — deixe vazio para manter' : 'só para referência'} value={f.chave} onChange={(e) => setForm((x) => ({ ...x, [conta.id]: { ...f, chave: e.target.value } }))} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => salvar(conta.id)} disabled={busy === `salvar-${conta.id}`}>
                      {busy === `salvar-${conta.id}` ? 'Salvando...' : integracao ? 'Salvar alterações' : 'Conectar'}
                    </Button>
                    {integracao && (
                      <>
                        <Button variant="outline" onClick={() => testar(integracao)} disabled={busy === `testar-${integracao.id}`}>
                          <Wifi className="size-4" data-icon="inline-start" />
                          {busy === `testar-${integracao.id}` ? 'Testando...' : 'Testar conexão'}
                        </Button>
                        <Button variant="outline" onClick={() => sincronizar(integracao)} disabled={busy === `sync-${integracao.id}`}>
                          <RefreshCw className={`size-4 ${busy === `sync-${integracao.id}` ? 'animate-spin' : ''}`} data-icon="inline-start" />
                          Sincronizar agora
                        </Button>
                        {vivoConta === conta.id ? (
                          <Button variant="outline" onClick={pararVivo}>
                            <Radio className="size-4 text-red-500" data-icon="inline-start" />
                            Parar cotações ao vivo
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => iniciarVivo(integracao)} disabled={integracao.status !== 'conectado'}>
                            <Radio className="size-4" data-icon="inline-start" />
                            Cotações ao vivo
                          </Button>
                        )}
                        <Button variant="ghost" className="text-red-600" onClick={() => setRemovendo(integracao)}>
                          <Trash2 className="size-4" data-icon="inline-start" />
                          Remover
                        </Button>
                      </>
                    )}
                  </div>

                  {integracao?.ultimoErro && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      {integracao.ultimoErro}
                    </div>
                  )}

                  {integracao?.ultimoHealth && (
                    <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      {Object.entries(estados).map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-muted/70 px-3 py-2">
                          <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                            {k === '0' ? 'Login' : k === '1' ? 'Roteamento' : k === '2' ? 'Market data' : k === '3' ? 'Ativação' : k}
                          </p>
                          <p className="mt-0.5 text-foreground">{v.label}</p>
                        </div>
                      ))}
                      <div className="rounded-xl bg-muted/70 px-3 py-2">
                        <p className="font-semibold uppercase tracking-wider text-muted-foreground">Modo</p>
                        <p className="mt-0.5 text-foreground">{integracao.ultimoHealth.modo === 'simulacao' ? 'Simulação' : 'ProfitDLL'} · verificado {fmtDataHora(integracao.ultimoHealth.verificadoEm)}</p>
                      </div>
                    </div>
                  )}

                  {vivoConta === conta.id && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Posições com cotação ao vivo</p>
                        <Badge variant="outline" className={wsEstado === 'aberto' ? 'border-green-300 text-green-700' : wsEstado === 'erro' ? 'border-red-300 text-red-700' : ''}>
                          {wsEstado === 'aberto' ? 'ao vivo' : wsEstado === 'conectando' ? 'conectando…' : wsEstado === 'erro' ? 'erro no WebSocket' : 'fechado'}
                        </Badge>
                      </div>
                      {posicoes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma posição aberta nesta conta.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-border/70">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ativo</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">PM</TableHead>
                                <TableHead className="text-right">Último</TableHead>
                                <TableHead className="hidden md:table-cell text-right">Compra / Venda</TableHead>
                                <TableHead className="text-right">Em aberto</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {posicoes.map((p) => {
                                const c = cotacoes[p.ativo];
                                const last = c?.last ?? p.cotacao;
                                const aberto = last ? Math.round((last - p.precoMedio) * Math.abs(p.quantidade) * p.multiplicador * Math.sign(p.quantidade) * 100) : null;
                                return (
                                  <TableRow key={p.ativo}>
                                    <TableCell className="font-semibold">{p.ativo}</TableCell>
                                    <TableCell className="text-right tabular-nums">{p.quantidade}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatPreco(p.precoMedio, p.mercado)}</TableCell>
                                    <TableCell className={`text-right tabular-nums ${c ? 'font-semibold' : 'text-muted-foreground'}`}>{last ? formatPreco(last, p.mercado) : '—'}</TableCell>
                                    <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                                      {c?.bid ? formatPreco(c.bid, p.mercado) : '—'} / {c?.ask ? formatPreco(c.ask, p.mercado) : '—'}
                                    </TableCell>
                                    <TableCell className={`text-right tabular-nums font-semibold ${corResultado(aberto)}`}>{aberto !== null ? formatResultado(aberto) : '—'}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                          <p className="px-4 py-2 text-[11px] text-muted-foreground">Custo total {formatCentavos(posicoes.reduce((s, p) => s + p.custoTotal, 0))}. As cotações recebidas alimentam o cache do painel a cada 15 s.</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!removendo} onOpenChange={(v) => !v && setRemovendo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover conexão</DialogTitle>
            <DialogDescription>O token salvo será apagado. As operações já sincronizadas continuam no histórico.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovendo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={remover} disabled={!!busy}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
