'use client';

import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, TriangleAlert, RotateCcw } from 'lucide-react';
import {
  CAMPOS_IMPORTACAO,
  CAMPOS_OBRIGATORIOS,
  CAMPO_LABEL,
  converterLinhas,
  parseCsv,
  sugerirMapeamento,
  type CsvParseado,
  type MapeamentoColunas,
  type OperacaoImportada,
  type LinhaInvalida,
} from '@/lib/investimentos/csv';
import { type ContaCorretora, MERCADO_LABEL, formatPreco, formatDate, nativeSelectClass } from './shared';

interface Props {
  contas: ContaCorretora[];
  contaFiltro: string;
  onImported: () => void;
}

interface ResultadoDryRun {
  dryRun: boolean;
  total: number;
  novas: number;
  duplicadas: number;
  invalidas: number;
  daytrade: number;
  swing: number;
  detalhesDuplicadas: { linha: number; motivo: string }[];
  detalhesInvalidas: { linha: number; motivo: string }[];
}

async function lerArquivo(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    // Exportações do Profit/Excel em Windows costumam vir em Latin-1.
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export function ImportarTab({ contas, contaFiltro, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [csv, setCsv] = useState<CsvParseado | null>(null);
  const [map, setMap] = useState<MapeamentoColunas | null>(null);
  const [conta, setConta] = useState(contaFiltro || String(contas[0]?.id ?? ''));
  const [verificacao, setVerificacao] = useState<ResultadoDryRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [concluido, setConcluido] = useState<ResultadoDryRun | null>(null);

  const convertido = useMemo<{ operacoes: OperacaoImportada[]; invalidas: LinhaInvalida[] } | null>(() => {
    if (!csv || !map) return null;
    return converterLinhas(csv.linhas, map);
  }, [csv, map]);

  const faltando = useMemo(
    () => (map ? CAMPOS_OBRIGATORIOS.filter((c) => map[c] < 0) : CAMPOS_OBRIGATORIOS),
    [map],
  );

  async function onFile(file: File) {
    try {
      const texto = await lerArquivo(file);
      const parsed = parseCsv(texto);
      if (parsed.cabecalho.length < 2 || parsed.linhas.length === 0) {
        toast.error('Não consegui ler o arquivo. Ele precisa ter cabeçalho e ao menos uma linha.');
        return;
      }
      setNomeArquivo(file.name);
      setCsv(parsed);
      setMap(sugerirMapeamento(parsed.cabecalho));
      setVerificacao(null);
      setConcluido(null);
    } catch {
      toast.error('Erro ao ler o arquivo.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function enviar(dryRun: boolean) {
    if (!convertido || !conta) return;
    if (convertido.operacoes.length === 0) {
      toast.error('Nenhuma linha válida para importar.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/investimentos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contaCorretoraId: conta, operacoes: convertido.operacoes, dryRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro na importação');
      if (dryRun) {
        setVerificacao(data);
      } else {
        setConcluido(data);
        toast.success(`${data.novas} operação(ões) importada(s).`);
        onImported();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na importação');
    } finally {
      setBusy(false);
    }
  }

  function reiniciar() {
    setCsv(null);
    setMap(null);
    setNomeArquivo('');
    setVerificacao(null);
    setConcluido(null);
  }

  const preview = convertido?.operacoes.slice(0, 8) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
        <CardHeader>
          <CardTitle>Importar operações (CSV)</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Exportação do Profit, nota de corretagem convertida ou planilha própria. Precisa de data, ativo, lado (C/V), quantidade e preço.
            Operações já importadas são ignoradas.
          </p>
        </CardHeader>
        <CardContent>
          {contas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Cadastre uma conta de corretora na aba <strong>Contas</strong> antes de importar.
            </div>
          ) : !csv ? (
            <div
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 py-12 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
            >
              <FileSpreadsheet className="size-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Arraste o arquivo aqui ou</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
              <Button variant="outline" className="mt-3" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" data-icon="inline-start" />
                Escolher CSV
              </Button>
            </div>
          ) : concluido ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="size-12 text-emerald-500" />
              <p className="mt-4 text-lg font-semibold">{concluido.novas} operação(ões) importada(s)</p>
              <p className="text-sm text-muted-foreground">
                {concluido.daytrade} day trade · {concluido.swing} swing · {concluido.duplicadas} ignorada(s) por duplicidade · {concluido.invalidas} inválida(s)
              </p>
              <Button variant="outline" className="mt-5" onClick={reiniciar}>
                <RotateCcw className="size-4" data-icon="inline-start" />
                Importar outro arquivo
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-primary" />
                  <span className="font-medium">{nomeArquivo}</span>
                  <span className="text-muted-foreground">· {csv.linhas.length} linha(s) · separador &quot;{csv.delimitador === '\t' ? 'tab' : csv.delimitador}&quot;</span>
                </div>
                <Button variant="ghost" size="sm" onClick={reiniciar}>Trocar arquivo</Button>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mapeamento de colunas</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {CAMPOS_IMPORTACAO.map((campo) => (
                    <div key={campo} className="space-y-1">
                      <Label htmlFor={`map-${campo}`} className="text-xs">
                        {CAMPO_LABEL[campo]}{CAMPOS_OBRIGATORIOS.includes(campo) ? ' *' : ''}
                      </Label>
                      <select
                        id={`map-${campo}`}
                        className={nativeSelectClass}
                        value={map?.[campo] ?? -1}
                        onChange={(e) => {
                          setMap((m) => (m ? { ...m, [campo]: Number(e.target.value) } : m));
                          setVerificacao(null);
                        }}
                      >
                        <option value={-1}>— não usar —</option>
                        {csv.cabecalho.map((h, i) => <option key={i} value={i}>{h || `coluna ${i + 1}`}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {faltando.length > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="size-4" />
                    Falta mapear: {faltando.map((c) => CAMPO_LABEL[c]).join(', ')}.
                  </p>
                )}
              </div>

              {convertido && faltando.length === 0 && (
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pré-visualização</p>
                    <Badge variant="outline">{convertido.operacoes.length} válida(s)</Badge>
                    {convertido.invalidas.length > 0 && (
                      <Badge className="bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300">{convertido.invalidas.length} inválida(s)</Badge>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Ativo</TableHead>
                          <TableHead>Mercado</TableHead>
                          <TableHead>Lado</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead className="text-right">Mult.</TableHead>
                          <TableHead className="text-right">Taxas</TableHead>
                          <TableHead>ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((o) => (
                          <TableRow key={o.linha}>
                            <TableCell className="whitespace-nowrap">{formatDate(o.dataOperacao)}{o.horario ? ` ${o.horario.slice(0, 5)}` : ''}</TableCell>
                            <TableCell className="font-semibold">{o.ativo}</TableCell>
                            <TableCell className="text-muted-foreground">{MERCADO_LABEL[o.mercado]}</TableCell>
                            <TableCell>{o.lado === 'compra' ? 'Compra' : 'Venda'}</TableCell>
                            <TableCell className="text-right tabular-nums">{o.quantidade}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPreco(o.preco, o.mercado)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{o.multiplicador}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{(o.taxas / 100).toFixed(2)}</TableCell>
                            <TableCell className="text-muted-foreground">{o.idExterno ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {convertido.operacoes.length > preview.length && (
                    <p className="mt-2 text-xs text-muted-foreground">Mostrando {preview.length} de {convertido.operacoes.length}.</p>
                  )}
                  {convertido.invalidas.length > 0 && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted-foreground">Ver linhas inválidas</summary>
                      <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                        {convertido.invalidas.slice(0, 30).map((i) => <li key={i.linha}>Linha {i.linha}: {i.motivo}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {convertido && faltando.length === 0 && (
                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1.5 sm:w-72">
                    <Label htmlFor="imp-conta">Importar para a conta</Label>
                    <select id="imp-conta" className={nativeSelectClass} value={conta} onChange={(e) => { setConta(e.target.value); setVerificacao(null); }}>
                      {contas.map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    {verificacao && (
                      <p className="text-sm text-muted-foreground">
                        <strong className="text-foreground">{verificacao.novas}</strong> nova(s) ({verificacao.daytrade} day trade, {verificacao.swing} swing) ·{' '}
                        <strong className="text-foreground">{verificacao.duplicadas}</strong> já existente(s)
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => enviar(true)} disabled={busy}>
                        {busy && !verificacao ? 'Verificando...' : 'Verificar duplicadas'}
                      </Button>
                      <Button onClick={() => enviar(false)} disabled={busy || (verificacao !== null && verificacao.novas === 0)}>
                        <Upload className="size-4" data-icon="inline-start" />
                        {busy ? 'Importando...' : verificacao ? `Importar ${verificacao.novas}` : 'Importar'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
