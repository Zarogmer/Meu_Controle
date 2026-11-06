'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Briefcase, Check } from 'lucide-react';
import {
  type PosicaoLista,
  MERCADO_LABEL,
  formatCentavos,
  formatResultado,
  corResultado,
  formatPreco,
  formatDate,
} from './shared';

interface Props {
  posicoes: PosicaoLista[];
  onChanged: () => void;
}

export function PosicoesTab({ posicoes, onChanged }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvarCotacao(ativo: string) {
    const preco = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(preco) || preco <= 0) {
      toast.error('Informe uma cotação válida.');
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch('/api/investimentos/cotacoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo, preco }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Cotação de ${ativo} atualizada.`);
      setEditando(null);
      onChanged();
    } catch {
      toast.error('Erro ao salvar cotação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
      <CardHeader>
        <CardTitle>Posições abertas</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Preço médio e resultado calculados a partir do histórico de operações. Informe a cotação para ver o resultado em aberto.
        </p>
      </CardHeader>
      <CardContent>
        {posicoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase className="size-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Nenhuma posição aberta.</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Registre operações ou importe o CSV da corretora para montar a carteira.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço médio</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Custo</TableHead>
                  <TableHead className="text-right">Cotação</TableHead>
                  <TableHead className="text-right">Em aberto</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Realizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posicoes.map((p) => (
                  <TableRow key={p.ativo}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.ativo}</span>
                        <Badge variant="outline" className="text-[10px]">{MERCADO_LABEL[p.mercado]}</Badge>
                        {p.quantidade < 0 && (
                          <Badge className="bg-amber-50 text-amber-700 text-[10px] dark:bg-amber-500/15 dark:text-amber-300">Vendido</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Última operação {formatDate(p.ultimaOperacao)}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{Math.abs(p.quantidade)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPreco(p.precoMedio, p.mercado)}</TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">{formatCentavos(p.custoTotal)}</TableCell>
                    <TableCell className="text-right">
                      {editando === p.ativo ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            autoFocus
                            inputMode="decimal"
                            className="h-8 w-28 text-right tabular-nums"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') salvarCotacao(p.ativo);
                              if (e.key === 'Escape') setEditando(null);
                            }}
                          />
                          <Button size="icon-sm" onClick={() => salvarCotacao(p.ativo)} disabled={salvando}>
                            <Check className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-right tabular-nums hover:bg-muted"
                          title="Clique para informar a cotação"
                          onClick={() => {
                            setEditando(p.ativo);
                            setValor(p.cotacao !== null ? String(p.cotacao).replace('.', ',') : '');
                          }}
                        >
                          {p.cotacao !== null ? formatPreco(p.cotacao, p.mercado) : <span className="text-muted-foreground">informar</span>}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${corResultado(p.resultadoNaoRealizado)}`}>
                      {p.resultadoNaoRealizado !== null ? formatResultado(p.resultadoNaoRealizado) : '—'}
                    </TableCell>
                    <TableCell className={`hidden lg:table-cell text-right tabular-nums ${corResultado(p.resultadoRealizado)}`}>
                      {formatResultado(p.resultadoRealizado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
