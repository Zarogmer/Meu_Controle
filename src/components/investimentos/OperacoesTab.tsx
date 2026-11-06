'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, PenLine, Trash2, ListOrdered, Search } from 'lucide-react';
import { mercadoSugerido, multiplicadorSugerido, type Mercado, type Modalidade, type Lado } from '@/lib/investimentos/calculos';
import {
  type ContaCorretora,
  type OperacaoLista,
  MERCADO_LABEL,
  MODALIDADE_LABEL,
  formatCentavos,
  formatResultado,
  corResultado,
  formatPreco,
  formatDate,
  nativeSelectClass,
  nativeSelectInline,
} from './shared';

interface Props {
  contas: ContaCorretora[];
  contaFiltro: string;
  refreshKey: number;
  onChanged: () => void;
  /** Abre o dialog de nova operação (controlado pela página). */
  abrirNova: number;
}

export function OperacoesTab({ contas, contaFiltro, refreshKey, onChanged, abrirNova }: Props) {
  const [operacoes, setOperacoes] = useState<OperacaoLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [fModalidade, setFModalidade] = useState('');
  const [fMercado, setFMercado] = useState('');
  const [fInicio, setFInicio] = useState('');
  const [fFim, setFFim] = useState('');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OperacaoLista | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<OperacaoLista | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [oConta, setOConta] = useState('');
  const [oAtivo, setOAtivo] = useState('');
  const [oMercado, setOMercado] = useState<Mercado>('acoes');
  const [oLado, setOLado] = useState<Lado>('compra');
  const [oQtd, setOQtd] = useState('');
  const [oPreco, setOPreco] = useState('');
  const [oMult, setOMult] = useState('1');
  const [oTaxas, setOTaxas] = useState('');
  const [oData, setOData] = useState('');
  const [oHora, setOHora] = useState('');
  const [oModalidade, setOModalidade] = useState<Modalidade>('swing');
  const [oObs, setOObs] = useState('');

  const fetchOperacoes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (contaFiltro) params.set('contaCorretoraId', contaFiltro);
      if (busca) params.set('ativo', busca);
      if (fModalidade) params.set('modalidade', fModalidade);
      if (fMercado) params.set('mercado', fMercado);
      if (fInicio) params.set('dataInicio', fInicio);
      if (fFim) params.set('dataFim', fFim);
      const res = await fetch(`/api/investimentos/operacoes?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      setOperacoes((await res.json()).operacoes ?? []);
    } catch {
      toast.error('Erro ao carregar operações.');
    } finally {
      setLoading(false);
    }
  }, [contaFiltro, busca, fModalidade, fMercado, fInicio, fFim]);

  useEffect(() => {
    fetchOperacoes();
  }, [fetchOperacoes, refreshKey]);

  function resetForm() {
    setOConta(contaFiltro || String(contas[0]?.id ?? ''));
    setOAtivo('');
    setOMercado('acoes');
    setOLado('compra');
    setOQtd('');
    setOPreco('');
    setOMult('1');
    setOTaxas('');
    const hoje = new Date();
    setOData(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`);
    setOHora('');
    setOModalidade('swing');
    setOObs('');
  }

  const openCreate = useCallback(() => {
    if (contas.length === 0) {
      toast.error('Cadastre uma conta de corretora antes de lançar operações.');
      return;
    }
    setEditing(null);
    resetForm();
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contas, contaFiltro]);

  useEffect(() => {
    if (abrirNova > 0) openCreate();
  }, [abrirNova, openCreate]);

  function openEdit(o: OperacaoLista) {
    setEditing(o);
    setOConta(String(o.contaCorretoraId));
    setOAtivo(o.ativo);
    setOMercado(o.mercado);
    setOLado(o.lado);
    setOQtd(String(o.quantidade));
    setOPreco(String(o.preco).replace('.', ','));
    setOMult(String(o.multiplicador).replace('.', ','));
    setOTaxas(o.taxas ? (o.taxas / 100).toFixed(2).replace('.', ',') : '');
    setOData(o.dataOperacao);
    setOHora(o.horario ?? '');
    setOModalidade(o.modalidade);
    setOObs(o.observacao ?? '');
    setOpen(true);
  }

  function onAtivoBlur() {
    const a = oAtivo.trim().toUpperCase();
    if (!a || editing) return;
    const mercado = mercadoSugerido(a);
    setOMercado(mercado);
    setOMult(String(multiplicadorSugerido(a, mercado)).replace('.', ','));
  }

  const num = (s: string) => s.trim().replace(/\./g, '').replace(',', '.');

  async function save() {
    if (!oAtivo.trim()) return void toast.error('Informe o ativo.');
    if (!oQtd || Number(oQtd) <= 0) return void toast.error('Quantidade deve ser maior que zero.');
    if (!oPreco) return void toast.error('Informe o preço.');
    setSaving(true);
    try {
      const payload = {
        contaCorretoraId: oConta,
        ativo: oAtivo,
        mercado: oMercado,
        lado: oLado,
        quantidade: oQtd,
        preco: num(oPreco),
        multiplicador: num(oMult),
        taxas: num(oTaxas || '0'),
        dataOperacao: oData,
        horario: oHora || null,
        modalidade: oModalidade,
        observacao: oObs,
      };
      const res = await fetch(editing ? `/api/investimentos/operacoes/${editing.id}` : '/api/investimentos/operacoes', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar');
      }
      toast.success(editing ? 'Operação atualizada.' : 'Operação registrada.');
      setOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/investimentos/operacoes/${deleting.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      toast.success('Operação excluída.');
      setDeleting(null);
      onChanged();
    } catch {
      toast.error('Erro ao excluir operação.');
    } finally {
      setDeletingBusy(false);
    }
  }

  const totalLiquido = operacoes.reduce((s, o) => s + o.resultadoLiquido, 0);

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar ativo (ex: PETR4, WIN)" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={nativeSelectInline} value={fModalidade} onChange={(e) => setFModalidade(e.target.value)}>
            <option value="">Day trade e swing</option>
            <option value="daytrade">Day trade</option>
            <option value="swing">Swing</option>
          </select>
          <select className={nativeSelectInline} value={fMercado} onChange={(e) => setFMercado(e.target.value)}>
            <option value="">Todos os mercados</option>
            {Object.entries(MERCADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Input type="date" className="w-auto" value={fInicio} onChange={(e) => setFInicio(e.target.value)} title="De" />
          <Input type="date" className="w-auto" value={fFim} onChange={(e) => setFFim(e.target.value)} title="Até" />
          <Button onClick={openCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            Nova operação
          </Button>
        </div>
      </div>

      <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Histórico de operações</CardTitle>
          {!loading && operacoes.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {operacoes.length} operação(ões) · resultado{' '}
              <span className={`font-semibold ${corResultado(totalLiquido)}`}>{formatResultado(totalLiquido)}</span>
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl bg-muted" />)}
            </div>
          ) : operacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ListOrdered className="size-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Nenhuma operação encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Lado</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Taxas</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="hidden lg:table-cell">Conta</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operacoes.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(o.dataOperacao)}
                        {o.horario && <span className="ml-1 text-[11px]">{o.horario.slice(0, 5)}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{o.ativo}</span>
                          <Badge variant="outline" className="text-[10px]">{MODALIDADE_LABEL[o.modalidade]}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{MERCADO_LABEL[o.mercado]}{o.origem === 'importacao' ? ' · importada' : ''}</p>
                      </TableCell>
                      <TableCell>
                        {o.lado === 'compra'
                          ? <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Compra</Badge>
                          : <Badge className="bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">Venda</Badge>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{o.quantidade}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPreco(o.preco, o.mercado)}
                        {o.quantidadeFechada > 0 && (
                          <p className="text-[11px] text-muted-foreground">PM {formatPreco(o.precoMedioAntes, o.mercado)}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                        {o.taxas ? formatCentavos(o.taxas) : '—'}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${corResultado(o.resultadoLiquido)}`}>
                        {o.quantidadeFechada > 0 || o.taxas ? formatResultado(o.resultadoLiquido) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{o.contaApelido ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(o)}><PenLine className="size-4" /></Button>
                          <Button variant="destructive" size="icon-sm" onClick={() => setDeleting(o)}><Trash2 className="size-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar operação' : 'Nova operação'}</DialogTitle>
            <DialogDescription>
              Preço em reais (ações) ou pontos (futuros). O multiplicador converte pontos em reais por contrato.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="o-conta">Conta</Label>
              <select id="o-conta" className={nativeSelectClass} value={oConta} onChange={(e) => setOConta(e.target.value)}>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="o-ativo">Ativo *</Label>
                <Input id="o-ativo" placeholder="PETR4, WINZ26..." value={oAtivo} onChange={(e) => setOAtivo(e.target.value.toUpperCase())} onBlur={onAtivoBlur} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-mercado">Mercado</Label>
                <select id="o-mercado" className={nativeSelectClass} value={oMercado} onChange={(e) => setOMercado(e.target.value as Mercado)}>
                  {Object.entries(MERCADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="o-lado">Lado</Label>
                <select id="o-lado" className={nativeSelectClass} value={oLado} onChange={(e) => setOLado(e.target.value as Lado)}>
                  <option value="compra">Compra</option>
                  <option value="venda">Venda</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-qtd">Quantidade *</Label>
                <Input id="o-qtd" type="number" min={1} inputMode="numeric" value={oQtd} onChange={(e) => setOQtd(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-preco">Preço *</Label>
                <Input id="o-preco" inputMode="decimal" placeholder="30,50" value={oPreco} onChange={(e) => setOPreco(e.target.value)} className="text-right tabular-nums" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="o-mult">Multiplicador</Label>
                <Input id="o-mult" inputMode="decimal" value={oMult} onChange={(e) => setOMult(e.target.value)} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-taxas">Taxas (R$)</Label>
                <Input id="o-taxas" inputMode="decimal" placeholder="0,00" value={oTaxas} onChange={(e) => setOTaxas(e.target.value)} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-modalidade">Modalidade</Label>
                <select id="o-modalidade" className={nativeSelectClass} value={oModalidade} onChange={(e) => setOModalidade(e.target.value as Modalidade)}>
                  <option value="swing">Swing</option>
                  <option value="daytrade">Day trade</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="o-data">Data *</Label>
                <Input id="o-data" type="date" value={oData} onChange={(e) => setOData(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-hora">Horário</Label>
                <Input id="o-hora" type="time" step={1} value={oHora} onChange={(e) => setOHora(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-obs">Observação</Label>
              <Textarea id="o-obs" rows={2} value={oObs} onChange={(e) => setOObs(e.target.value)} placeholder="Setup, motivo da entrada..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir operação</DialogTitle>
            <DialogDescription>
              Excluir {deleting?.lado} de {deleting?.quantidade} {deleting?.ativo} em {formatDate(deleting?.dataOperacao)}? O preço médio e os resultados serão recalculados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>Cancelar</Button>
            <Button variant="destructive" onClick={remove} disabled={deletingBusy}>{deletingBusy ? 'Excluindo...' : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
