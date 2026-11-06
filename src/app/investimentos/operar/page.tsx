'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { ArrowLeft, Lock, ShieldAlert, Send, XCircle, Octagon, ScrollText, Siren, FlaskConical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usoDoLimiteDiario } from '@/lib/trading/limites';
import {
  type ContaCorretora, type PosicaoLista, MERCADO_LABEL, formatCentavos, formatResultado, corResultado, formatPreco, nativeSelectClass,
} from '@/components/investimentos/shared';
import { bolsaSugerida } from '@/lib/brokers/types';

interface Config {
  id: number;
  tradingHabilitado: boolean;
  modo: 'simulacao' | 'real';
  quantidadeMaxima: number;
  perdaDiariaMaxima: number;
  modoRealAceitoEm: string | null;
  habilitadoEm: string | null;
}

interface OrdemAberta {
  id: string;
  localOrderId: string | null;
  ativo: string;
  bolsa: string | null;
  lado: 'compra' | 'venda';
  tipo: string;
  quantidade: number;
  quantidadeExecutada: number;
  preco: number | null;
  precoStop: number | null;
  precoMedio: number | null;
  status: string;
  atualizadoEm: string;
}

interface Evento {
  id: number;
  ordemRef: string;
  evento: string;
  modo: string;
  ativo: string | null;
  lado: string | null;
  tipo: string | null;
  quantidade: number | null;
  preco: number | null;
  localOrderId: string | null;
  mensagem: string | null;
  criadoEm: string;
}

const STATUS_ABERTO = new Set(['nova', 'parcial', 'pendente_nova', 'recebida', 'pendente_alteracao', 'pendente_cancel', 'disparada', 'substituida', 'suspensa']);
const EVENTO_LABEL: Record<string, string> = {
  envio: 'Envio', enviada: 'Aceita pelo conector', rejeitada: 'Rejeitada', envio_recusado: 'Recusada pelo sistema', erro: 'Erro',
  cancelamento: 'Cancelamento', cancelar_todas: 'Cancelar todas', zerar_posicao: 'Zerar posição', resposta_conector: 'Resposta do conector',
  config_alterada: 'Configuração alterada', trading_habilitado: 'Trading habilitado', trading_desabilitado: 'Trading desabilitado',
};

function fmtDataHora(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function OperarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [contas, setContas] = useState<ContaCorretora[]>([]);
  const [contaId, setContaId] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [resultadoHoje, setResultadoHoje] = useState(0);
  const [ordens, setOrdens] = useState<OrdemAberta[]>([]);
  const [temConector, setTemConector] = useState(false);
  const [statusConector, setStatusConector] = useState<{ online: boolean; modo: string; pronto: boolean } | null>(null);
  const [erroConector, setErroConector] = useState<string | null>(null);
  const [posicoes, setPosicoes] = useState<PosicaoLista[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // limites
  const [lQtd, setLQtd] = useState('');
  const [lPerda, setLPerda] = useState('');
  const [modoDialog, setModoDialog] = useState(false);
  const [confirmReal, setConfirmReal] = useState('');

  // boleta
  const [bAtivo, setBAtivo] = useState('');
  const [bBolsa, setBBolsa] = useState<'F' | 'B'>('B');
  const [bLado, setBLado] = useState<'compra' | 'venda'>('compra');
  const [bTipo, setBTipo] = useState<'mercado' | 'limite' | 'stop_limite'>('mercado');
  const [bQtd, setBQtd] = useState('1');
  const [bPreco, setBPreco] = useState('');
  const [bStop, setBStop] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTexto, setConfirmTexto] = useState('');
  const [zerar, setZerar] = useState<PosicaoLista | null>(null);
  const [killOpen, setKillOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user && user.role === 'employee') router.replace('/dashboard');
  }, [authLoading, user, router]);

  const fetchTudo = useCallback(async (cid: string) => {
    try {
      const [o, a, r] = await Promise.all([
        fetch(`/api/investimentos/trading/ordens?contaCorretoraId=${cid}`, { credentials: 'include' }),
        fetch('/api/investimentos/trading/auditoria?limite=50', { credentials: 'include' }),
        fetch(`/api/investimentos/resumo?contaCorretoraId=${cid}`, { credentials: 'include' }),
      ]);
      if (o.ok) {
        const d = await o.json();
        setConfig(d.config);
        setResultadoHoje(d.resultadoHoje ?? 0);
        setOrdens(d.ordens ?? []);
        setTemConector(!!d.temConector);
        setStatusConector(d.status ?? null);
        setErroConector(d.erroConector ?? null);
        setLQtd((v) => v || String(d.config?.quantidadeMaxima ?? 1));
        setLPerda((v) => v || ((d.config?.perdaDiariaMaxima ?? 10000) / 100).toFixed(2).replace('.', ','));
      }
      if (a.ok) setEventos((await a.json()).eventos ?? []);
      if (r.ok) setPosicoes((await r.json()).posicoes ?? []);
    } catch {
      toast.error('Erro ao carregar a mesa de operações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role === 'employee') return;
    fetch('/api/investimentos/contas', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { contas: [] }))
      .then((d) => {
        const lista: ContaCorretora[] = d.contas ?? [];
        setContas(lista);
        const primeira = lista.find((c) => c.origem === 'nelogica') ?? lista[0];
        if (primeira) setContaId(String(primeira.id));
        else setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (contaId) fetchTudo(contaId);
  }, [contaId, fetchTudo]);

  const ordensAbertas = ordens.filter((o) => STATUS_ABERTO.has(o.status));
  const limiteUso = config ? usoDoLimiteDiario(resultadoHoje, config.perdaDiariaMaxima) : 0;
  const bloqueadoPorPerda = !!config && resultadoHoje <= -config.perdaDiariaMaxima;
  const podeOperar = !!config?.tradingHabilitado && temConector && !!statusConector?.online && !!statusConector?.pronto;
  const modoCompativel = !!config && !!statusConector && ((config.modo === 'simulacao' && statusConector.modo === 'simulacao') || (config.modo === 'real' && statusConector.modo === 'dll'));

  async function salvarLimites() {
    setBusy('limites');
    try {
      const res = await fetch('/api/investimentos/trading/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ quantidadeMaxima: lQtd, perdaDiariaMaxima: lPerda.replace(/\./g, '').replace(',', '.') }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Erro');
      setConfig(d.config);
      toast.success('Limites atualizados.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(null);
    }
  }

  async function trocarModo(modo: 'simulacao' | 'real') {
    setBusy('modo');
    try {
      const res = await fetch('/api/investimentos/trading/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ modo, confirmacaoReal: confirmReal }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Erro');
      setConfig(d.config);
      setModoDialog(false);
      setConfirmReal('');
      toast.success(modo === 'real' ? 'Modo REAL ligado. Toda ordem agora vai para a corretora.' : 'De volta ao modo simulação.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(null);
    }
  }

  function abrirConfirmacao() {
    if (!bAtivo.trim()) return void toast.error('Informe o ativo.');
    if (!bQtd || Number(bQtd) <= 0) return void toast.error('Informe a quantidade.');
    if (bTipo !== 'mercado' && !bPreco) return void toast.error('Informe o preço.');
    if (bTipo === 'stop_limite' && !bStop) return void toast.error('Informe o preço de disparo.');
    setConfirmTexto('');
    setConfirmOpen(true);
  }

  async function enviar() {
    if (!config) return;
    if (config.modo === 'real' && confirmTexto !== 'CONFIRMAR') return void toast.error('Digite CONFIRMAR para enviar em modo real.');
    setBusy('enviar');
    try {
      const res = await fetch('/api/investimentos/trading/ordens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          contaCorretoraId: contaId, ativo: bAtivo, bolsa: bBolsa, lado: bLado, tipo: bTipo, quantidade: bQtd,
          preco: bTipo === 'mercado' ? null : bPreco, precoStop: bTipo === 'stop_limite' ? bStop : null, confirmado: true,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Ordem recusada');
      if (d.resultado?.aceita) toast.success(`Ordem aceita: ${d.resultado.mensagem ?? ''}`);
      else toast.error(`Ordem rejeitada: ${d.resultado?.mensagem ?? ''}`);
      setConfirmOpen(false);
      fetchTudo(contaId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
      fetchTudo(contaId);
    } finally {
      setBusy(null);
    }
  }

  async function cancelar(o: OrdemAberta) {
    setBusy(`cancel-${o.id}`);
    try {
      const res = await fetch(`/api/investimentos/trading/ordens/${encodeURIComponent(o.id)}/cancelar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ contaCorretoraId: contaId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Erro');
      toast[d.resultado?.aceita ? 'success' : 'error'](d.resultado?.mensagem ?? 'Cancelamento enviado');
      fetchTudo(contaId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar');
    } finally {
      setBusy(null);
    }
  }

  async function confirmarZerar() {
    if (!zerar) return;
    setBusy('zerar');
    try {
      const res = await fetch('/api/investimentos/trading/zerar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ contaCorretoraId: contaId, ativo: zerar.ativo, bolsa: bolsaSugerida(zerar.ativo), tipoPosicao: zerar.mercado === 'futuros' ? 1 : 2, confirmado: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Erro');
      toast[d.resultado?.aceita ? 'success' : 'error'](d.resultado?.mensagem ?? 'Zeragem enviada');
      setZerar(null);
      fetchTudo(contaId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao zerar');
    } finally {
      setBusy(null);
    }
  }

  async function killSwitch() {
    setBusy('kill');
    try {
      const res = await fetch('/api/investimentos/trading/cancelar-todas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ contaCorretoraId: contaId, confirmado: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Erro');
      toast[d.resultado?.aceita ? 'success' : 'error'](d.resultado?.mensagem ?? 'Enviado');
      setKillOpen(false);
      fetchTudo(contaId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(null);
    }
  }

  if (authLoading || (user && user.role === 'employee')) {
    return <AppLayout><Skeleton className="h-40 rounded-[2rem] bg-muted" /></AppLayout>;
  }

  const real = config?.modo === 'real';

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/investimentos" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3" /> Investimentos
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mesa de operações</p>
            <h1 className="text-2xl font-bold tracking-tight">Enviar ordens pela própria conta</h1>
          </div>
          {contas.length > 1 && (
            <select className={`${nativeSelectClass} w-auto`} value={contaId} onChange={(e) => { setContaId(e.target.value); setLoading(true); }}>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-48 rounded-[2rem] bg-muted" />
        ) : !config?.tradingHabilitado ? (
          <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Lock className="size-12 text-muted-foreground/30" />
              <p className="mt-4 font-medium">Envio de ordens desligado para a sua conta.</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Este recurso é liberado pela equipe do Meu Controle, usuário a usuário, e começa sempre em modo simulação.
                Você continua vendo carteira, resultados e cotações normalmente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* faixa de modo */}
            <div className={`flex flex-col gap-3 rounded-[2rem] border px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${real ? 'border-red-500/30 bg-red-500/8' : 'border-amber-500/30 bg-amber-500/8'}`}>
              <div className="flex items-center gap-3">
                {real ? <Siren className="size-6 text-red-600" /> : <FlaskConical className="size-6 text-amber-600" />}
                <div>
                  <p className={`text-sm font-bold uppercase tracking-wider ${real ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {real ? 'Modo real — dinheiro de verdade' : 'Modo simulação'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {real ? 'Toda ordem vai para a corretora pela sua licença. Confirmação dupla em cada envio.' : 'Ordens só são aceitas por um conector em simulação. Nada chega à corretora.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!temConector && <Badge variant="outline">Sem conector nesta conta</Badge>}
                {temConector && statusConector && (
                  <Badge className={statusConector.online && statusConector.pronto ? 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'}>
                    Conector {statusConector.online ? (statusConector.pronto ? 'pronto' : 'conectando') : 'offline'} · {statusConector.modo === 'simulacao' ? 'simulação' : 'ProfitDLL'}
                  </Badge>
                )}
                {temConector && statusConector && !modoCompativel && <Badge className="bg-red-50 text-red-700">Modo incompatível com o conector</Badge>}
                <Button variant="outline" size="sm" onClick={() => { setConfirmReal(''); setModoDialog(true); }}>
                  {real ? 'Voltar para simulação' : 'Ligar modo real'}
                </Button>
              </div>
            </div>
            {erroConector && <p className="text-sm text-red-600">Conector: {erroConector}</p>}

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              {/* boleta */}
              <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
                <CardHeader><CardTitle>Boleta</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="b-ativo">Ativo (contrato vigente)</Label>
                      <Input id="b-ativo" placeholder="WINZ26, PETR4..." value={bAtivo} onChange={(e) => { const v = e.target.value.toUpperCase(); setBAtivo(v); setBBolsa(bolsaSugerida(v)); }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-bolsa">Bolsa</Label>
                      <select id="b-bolsa" className={nativeSelectClass} value={bBolsa} onChange={(e) => setBBolsa(e.target.value as 'F' | 'B')}>
                        <option value="B">B (Bovespa)</option>
                        <option value="F">F (BM&F)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-lado">Lado</Label>
                      <select id="b-lado" className={nativeSelectClass} value={bLado} onChange={(e) => setBLado(e.target.value as 'compra' | 'venda')}>
                        <option value="compra">Compra</option>
                        <option value="venda">Venda</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="b-tipo">Tipo</Label>
                      <select id="b-tipo" className={nativeSelectClass} value={bTipo} onChange={(e) => setBTipo(e.target.value as typeof bTipo)}>
                        <option value="mercado">A mercado</option>
                        <option value="limite">Limitada</option>
                        <option value="stop_limite">Stop limite</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-qtd">Quantidade (máx. {config.quantidadeMaxima})</Label>
                      <Input id="b-qtd" type="number" min={1} max={config.quantidadeMaxima} value={bQtd} onChange={(e) => setBQtd(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-preco">Preço</Label>
                      <Input id="b-preco" inputMode="decimal" disabled={bTipo === 'mercado'} placeholder={bTipo === 'mercado' ? 'a mercado' : '0,00'} value={bPreco} onChange={(e) => setBPreco(e.target.value)} className="text-right tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-stop">Disparo (stop)</Label>
                      <Input id="b-stop" inputMode="decimal" disabled={bTipo !== 'stop_limite'} placeholder={bTipo !== 'stop_limite' ? '—' : '0,00'} value={bStop} onChange={(e) => setBStop(e.target.value)} className="text-right tabular-nums" />
                    </div>
                  </div>
                  {bloqueadoPorPerda && (
                    <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      <ShieldAlert className="size-4" /> Perda diária máxima atingida. Só é possível zerar posição.
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button className={bLado === 'venda' ? 'bg-orange-600 hover:bg-orange-700' : ''} onClick={abrirConfirmacao} disabled={!podeOperar || !modoCompativel || bloqueadoPorPerda}>
                      <Send className="size-4" data-icon="inline-start" />
                      {bLado === 'compra' ? 'Comprar' : 'Vender'} {bQtd || ''} {bAtivo || ''}
                    </Button>
                    <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => setKillOpen(true)} disabled={!podeOperar}>
                      <Octagon className="size-4" data-icon="inline-start" />
                      Cancelar todas as ordens
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* limites */}
              <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
                <CardHeader><CardTitle>Limites de proteção</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Resultado de hoje</span>
                      <span className={`font-semibold ${corResultado(resultadoHoje)}`}>{formatResultado(resultadoHoje)}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full transition-all ${limiteUso >= 1 ? 'bg-red-500' : limiteUso >= 0.7 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${Math.round(limiteUso * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{Math.round(limiteUso * 100)}% da perda diária máxima ({formatCentavos(config.perdaDiariaMaxima)})</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="l-qtd">Qtd. máxima por ordem</Label>
                      <Input id="l-qtd" type="number" min={1} value={lQtd} onChange={(e) => setLQtd(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="l-perda">Perda diária máx. (R$)</Label>
                      <Input id="l-perda" inputMode="decimal" value={lPerda} onChange={(e) => setLPerda(e.target.value)} className="text-right tabular-nums" />
                    </div>
                  </div>
                  <Button variant="outline" onClick={salvarLimites} disabled={busy === 'limites'}>Salvar limites</Button>
                  <p className="text-[11px] text-muted-foreground">Ao atingir a perda diária, novas ordens são bloqueadas; zerar posição continua liberado.</p>
                </CardContent>
              </Card>
            </div>

            {/* ordens abertas + posições */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
                <CardHeader><CardTitle>Ordens abertas</CardTitle></CardHeader>
                <CardContent>
                  {ordensAbertas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma ordem aberta no conector.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ativo</TableHead><TableHead>Lado</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Preço</TableHead><TableHead>Status</TableHead><TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ordensAbertas.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-semibold">{o.ativo}</TableCell>
                            <TableCell>{o.lado === 'compra' ? 'Compra' : 'Venda'}</TableCell>
                            <TableCell className="text-right tabular-nums">{o.quantidadeExecutada}/{o.quantidade}</TableCell>
                            <TableCell className="text-right tabular-nums">{o.preco !== null ? formatPreco(o.preco) : 'mercado'}</TableCell>
                            <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => cancelar(o)} disabled={busy === `cancel-${o.id}`}>
                                <XCircle className="size-4" data-icon="inline-start" /> Cancelar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
                <CardHeader><CardTitle>Posições (zerar a mercado)</CardTitle></CardHeader>
                <CardContent>
                  {posicoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma posição aberta nesta conta.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Ativo</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">PM</TableHead><TableHead className="text-right">Em aberto</TableHead><TableHead /></TableRow>
                      </TableHeader>
                      <TableBody>
                        {posicoes.map((p) => (
                          <TableRow key={p.ativo}>
                            <TableCell><span className="font-semibold">{p.ativo}</span> <span className="text-xs text-muted-foreground">{MERCADO_LABEL[p.mercado]}</span></TableCell>
                            <TableCell className="text-right tabular-nums">{p.quantidade}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPreco(p.precoMedio, p.mercado)}</TableCell>
                            <TableCell className={`text-right tabular-nums font-semibold ${corResultado(p.resultadoNaoRealizado)}`}>{p.resultadoNaoRealizado !== null ? formatResultado(p.resultadoNaoRealizado) : '—'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => setZerar(p)} disabled={!podeOperar || !modoCompativel}>Zerar</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* auditoria */}
            <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
              <CardHeader className="flex flex-row items-center gap-2">
                <ScrollText className="size-4 text-primary" />
                <CardTitle>Log de auditoria (imutável)</CardTitle>
              </CardHeader>
              <CardContent>
                {eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Quando</TableHead><TableHead>Evento</TableHead><TableHead>Modo</TableHead><TableHead>Ordem</TableHead><TableHead>Mensagem</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventos.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDataHora(e.criadoEm)}</TableCell>
                            <TableCell><Badge variant="outline" className={e.evento === 'rejeitada' || e.evento === 'erro' || e.evento === 'envio_recusado' ? 'border-red-300 text-red-700' : ''}>{EVENTO_LABEL[e.evento] ?? e.evento}</Badge></TableCell>
                            <TableCell>{e.modo === 'real' ? <span className="font-semibold text-red-600">REAL</span> : 'simulação'}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {e.ativo ? `${e.lado ?? ''} ${e.quantidade ?? ''} ${e.ativo}${e.preco ? ` @ ${formatPreco(e.preco)}` : ''}` : e.localOrderId ? `#${e.localOrderId}` : '—'}
                            </TableCell>
                            <TableCell className="max-w-[320px] truncate text-muted-foreground" title={e.mensagem ?? ''}>{e.mensagem ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* confirmação de envio */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{real ? 'Confirmar ordem REAL' : 'Confirmar ordem (simulação)'}</DialogTitle>
            <DialogDescription>Revise antes de enviar. Esta ação fica registrada no log de auditoria.</DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-muted/70 p-4 text-sm">
            <p><strong>{bLado === 'compra' ? 'COMPRA' : 'VENDA'}</strong> de <strong>{bQtd}</strong> {bAtivo} ({bBolsa})</p>
            <p className="text-muted-foreground">
              {bTipo === 'mercado' ? 'A mercado' : bTipo === 'limite' ? `Limitada a ${bPreco}` : `Stop limite: dispara em ${bStop}, ordem a ${bPreco}`}
            </p>
            <p className={`mt-2 text-xs font-semibold ${real ? 'text-red-600' : 'text-amber-700'}`}>{real ? 'DINHEIRO REAL' : 'Simulação — nada vai para a corretora'}</p>
          </div>
          {real && (
            <div className="space-y-1.5">
              <Label htmlFor="c-texto">Digite CONFIRMAR</Label>
              <Input id="c-texto" value={confirmTexto} onChange={(e) => setConfirmTexto(e.target.value.toUpperCase())} autoFocus />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy === 'enviar'}>Cancelar</Button>
            <Button onClick={enviar} disabled={busy === 'enviar' || (real && confirmTexto !== 'CONFIRMAR')}>{busy === 'enviar' ? 'Enviando...' : 'Enviar ordem'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* zerar */}
      <Dialog open={!!zerar} onOpenChange={(v) => !v && setZerar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zerar posição em {zerar?.ativo}</DialogTitle>
            <DialogDescription>Envia uma ordem a mercado para fechar {zerar ? Math.abs(zerar.quantidade) : ''} {zerar?.ativo}. {real ? 'Modo REAL.' : 'Simulação.'}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZerar(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarZerar} disabled={busy === 'zerar'}>{busy === 'zerar' ? 'Enviando...' : 'Zerar a mercado'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* kill switch */}
      <Dialog open={killOpen} onOpenChange={setKillOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar todas as ordens</DialogTitle>
            <DialogDescription>Cancela todas as ordens abertas desta conta no conector. Posições não são zeradas.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKillOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={killSwitch} disabled={busy === 'kill'}>{busy === 'kill' ? 'Enviando...' : 'Cancelar todas'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* modo */}
      <Dialog open={modoDialog} onOpenChange={setModoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{real ? 'Voltar para simulação' : 'Ligar modo real'}</DialogTitle>
            <DialogDescription>
              {real
                ? 'As ordens voltam a ser aceitas só por um conector em simulação.'
                : 'Em modo real, cada ordem vai para a corretora pela sua licença e sua conta. Exige o conector com a ProfitDLL e roteamento ligado. Para confirmar, digite exatamente: OPERAR COM DINHEIRO REAL'}
            </DialogDescription>
          </DialogHeader>
          {!real && <Input value={confirmReal} onChange={(e) => setConfirmReal(e.target.value.toUpperCase())} placeholder="OPERAR COM DINHEIRO REAL" autoFocus />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModoDialog(false)}>Cancelar</Button>
            {real
              ? <Button onClick={() => trocarModo('simulacao')} disabled={busy === 'modo'}>Voltar para simulação</Button>
              : <Button variant="destructive" onClick={() => trocarModo('real')} disabled={busy === 'modo' || confirmReal !== 'OPERAR COM DINHEIRO REAL'}>Ligar modo real</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
