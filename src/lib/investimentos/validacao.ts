import { normalizarAtivo, multiplicadorSugerido, mercadoSugerido, type Mercado } from './calculos';
import { parseDataBR } from './csv';

export const MERCADOS = ['acoes', 'futuros', 'opcoes', 'fii', 'outros'] as const;

export interface OperacaoValidada {
  contaCorretoraId: number;
  ativo: string;
  mercado: Mercado;
  lado: 'compra' | 'venda';
  quantidade: number;
  preco: number;
  multiplicador: number;
  taxas: number;
  dataOperacao: string;
  horario: string | null;
  modalidade: 'daytrade' | 'swing';
  observacao: string | null;
}

/** Valida o corpo de criação/edição de operação manual (taxas chegam em reais). */
export function validarOperacao(body: Record<string, unknown>): OperacaoValidada | { error: string } {
  const contaCorretoraId = parseInt(String(body.contaCorretoraId ?? ''), 10);
  if (!Number.isInteger(contaCorretoraId) || contaCorretoraId <= 0) return { error: 'Escolha a conta de corretora' };

  const ativo = normalizarAtivo(String(body.ativo ?? ''));
  if (!ativo) return { error: 'Informe o ativo' };

  const lado = body.lado === 'compra' || body.lado === 'venda' ? body.lado : null;
  if (!lado) return { error: 'Lado deve ser compra ou venda' };

  const quantidade = parseInt(String(body.quantidade ?? ''), 10);
  if (!Number.isInteger(quantidade) || quantidade <= 0) return { error: 'Quantidade deve ser maior que zero' };

  const preco = parseFloat(String(body.preco ?? ''));
  if (!Number.isFinite(preco) || preco <= 0) return { error: 'Preço deve ser maior que zero' };

  const mercado = (MERCADOS as readonly string[]).includes(String(body.mercado))
    ? (body.mercado as Mercado)
    : mercadoSugerido(ativo);

  const multRaw = parseFloat(String(body.multiplicador ?? ''));
  const multiplicador = Number.isFinite(multRaw) && multRaw > 0 ? multRaw : multiplicadorSugerido(ativo, mercado);

  const taxasRaw = parseFloat(String(body.taxas ?? '0'));
  const taxas = Number.isFinite(taxasRaw) ? Math.round(Math.abs(taxasRaw) * 100) : 0;

  const dataParse = parseDataBR(String(body.dataOperacao ?? ''));
  if (!dataParse) return { error: 'Data da operação inválida' };

  const horarioParse = body.horario ? parseDataBR(`2000-01-01 ${String(body.horario)}`)?.horario ?? null : null;
  const modalidade = body.modalidade === 'daytrade' ? 'daytrade' : 'swing';

  return {
    contaCorretoraId,
    ativo,
    mercado,
    lado,
    quantidade,
    preco,
    multiplicador,
    taxas,
    dataOperacao: dataParse.data,
    horario: horarioParse ?? dataParse.horario,
    modalidade,
    observacao: body.observacao ? String(body.observacao).trim() || null : null,
  };
}
