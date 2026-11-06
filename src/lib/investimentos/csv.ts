/**
 * Leitura de CSV de operações (exportação do Profit, nota de corretagem
 * convertida, planilha própria). Roda no navegador, na tela de
 * importação, e no servidor para validar. Sem dependências.
 */
import type { Lado, Mercado, Modalidade } from './calculos';
import { mercadoSugerido, multiplicadorSugerido, normalizarAtivo } from './calculos';

export interface CsvParseado {
  cabecalho: string[];
  linhas: string[][];
  delimitador: string;
}

/** Detecta o delimitador pela primeira linha (; , ou tab). */
export function detectarDelimitador(primeiraLinha: string): string {
  const candidatos = [';', ',', '\t', '|'];
  let melhor = ',';
  let maior = -1;
  for (const d of candidatos) {
    const n = primeiraLinha.split(d).length - 1;
    if (n > maior) {
      maior = n;
      melhor = d;
    }
  }
  return melhor;
}

function dividirLinha(linha: string, delimitador: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const ch = linha[i];
    if (ch === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (ch === delimitador && !entreAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += ch;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

export function parseCsv(texto: string, delimitador?: string): CsvParseado {
  const limpo = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const linhasBrutas = limpo.split('\n').filter((l) => l.trim().length > 0);
  if (linhasBrutas.length === 0) return { cabecalho: [], linhas: [], delimitador: delimitador ?? ',' };
  const d = delimitador ?? detectarDelimitador(linhasBrutas[0]);
  const cabecalho = dividirLinha(linhasBrutas[0], d);
  const linhas = linhasBrutas.slice(1).map((l) => dividirLinha(l, d));
  return { cabecalho, linhas, delimitador: d };
}

/** "1.234,56" → 1234.56; "1,234.56" → 1234.56; "120.000" → 120000; "R$ 10,50" → 10.5 */
export function parseNumeroBR(valor: string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  let s = String(valor).trim().replace(/[R$\s]/g, '').replace(/[A-Za-z]/g, '');
  if (!s) return null;
  const negativo = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-+]/g, '');
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) {
    // O último separador é o decimal.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (temVirgula) {
    s = s.replace(',', '.');
  } else if (temPonto) {
    // "120.000" (milhar pt-BR) vs "120.5" (decimal): 3 dígitos após o único ponto = milhar.
    const partes = s.split('.');
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) s = partes.join('');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** dd/mm/yyyy, dd/mm/yy, yyyy-mm-dd, dd-mm-yyyy, com ou sem hora → { data, horario } */
export function parseDataBR(valor: string | null | undefined): { data: string; horario: string | null } | null {
  if (!valor) return null;
  const s = String(valor).trim();
  const hora = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const horario = hora ? `${hora[1].padStart(2, '0')}:${hora[2]}:${hora[3] ?? '00'}` : null;
  const somenteData = s.replace(/\s*\d{1,2}:\d{2}(:\d{2})?.*$/, '').replace(/T.*$/, '');
  let m = somenteData.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { data: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, horario };
  m = somenteData.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mes = Number(m[2]);
    const dia = Number(m[1]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return { data: `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, horario };
  }
  return null;
}

export function parseLado(valor: string | null | undefined): Lado | null {
  if (!valor) return null;
  const s = String(valor).trim().toLowerCase();
  if (['c', 'compra', 'comprado', 'buy', 'b', 'long'].includes(s)) return 'compra';
  if (['v', 'venda', 'vendido', 'sell', 's', 'short'].includes(s)) return 'venda';
  if (s.startsWith('comp') || s.startsWith('buy')) return 'compra';
  if (s.startsWith('vend') || s.startsWith('sell')) return 'venda';
  return null;
}

export function parseModalidade(valor: string | null | undefined): Modalidade | null {
  if (!valor) return null;
  const s = String(valor).trim().toLowerCase().replace(/[\s_-]/g, '');
  if (['daytrade', 'dt', 'day', 'd'].includes(s)) return 'daytrade';
  if (['swing', 'swingtrade', 'st', 'posicao', 'posição', 'normal', 'n', 's'].includes(s)) return 'swing';
  return null;
}

export function parseMercado(valor: string | null | undefined): Mercado | null {
  if (!valor) return null;
  const s = String(valor).trim().toLowerCase();
  if (s.includes('fut') || s.includes('bmf') || s.includes('índice') || s.includes('indice') || s.includes('dólar') || s.includes('dolar')) return 'futuros';
  if (s.includes('opç') || s.includes('opc') || s.includes('option')) return 'opcoes';
  if (s.includes('fii') || s.includes('fundo')) return 'fii';
  if (s.includes('aç') || s.includes('ac') || s.includes('vista') || s.includes('stock') || s.includes('bovespa')) return 'acoes';
  return 'outros';
}

// ── Mapeamento de colunas ────────────────────────────────────────
export const CAMPOS_IMPORTACAO = [
  'data', 'horario', 'ativo', 'lado', 'quantidade', 'preco', 'taxas',
  'modalidade', 'mercado', 'multiplicador', 'idExterno',
] as const;
export type CampoImportacao = (typeof CAMPOS_IMPORTACAO)[number];

export const CAMPO_LABEL: Record<CampoImportacao, string> = {
  data: 'Data',
  horario: 'Horário',
  ativo: 'Ativo',
  lado: 'Lado (C/V)',
  quantidade: 'Quantidade',
  preco: 'Preço',
  taxas: 'Taxas (R$)',
  modalidade: 'Modalidade (DT/Swing)',
  mercado: 'Mercado',
  multiplicador: 'Multiplicador',
  idExterno: 'ID da operação',
};

export const CAMPOS_OBRIGATORIOS: CampoImportacao[] = ['data', 'ativo', 'lado', 'quantidade', 'preco'];

/** Mapeamento campo → índice da coluna no CSV (−1 = não mapeado). */
export type MapeamentoColunas = Record<CampoImportacao, number>;

const SINONIMOS: Record<CampoImportacao, string[]> = {
  data: ['data', 'date', 'dt', 'data negocio', 'data negócio', 'data do negocio', 'data da operacao', 'data da operação', 'data hora', 'data/hora', 'abertura', 'data pregao', 'data pregão'],
  horario: ['hora', 'horario', 'horário', 'time', 'hora abertura'],
  ativo: ['ativo', 'papel', 'symbol', 'ticker', 'codigo', 'código', 'instrumento', 'contrato', 'especificacao do titulo', 'especificação do título'],
  lado: ['lado', 'c/v', 'cv', 'side', 'operacao', 'operação', 'tipo', 'natureza', 'compra/venda', 'direcao', 'direção', 'd/c'],
  quantidade: ['quantidade', 'qtd', 'qtde', 'qty', 'quantity', 'contratos', 'qtd executada', 'quant'],
  preco: ['preco', 'preço', 'price', 'preco medio', 'preço médio', 'preco unitario', 'preço unitário', 'valor unitario', 'preco execucao', 'preço execução', 'preco/ajuste', 'preço/ajuste'],
  taxas: ['taxas', 'taxa', 'custos', 'custo', 'corretagem', 'emolumentos', 'fees', 'despesas'],
  modalidade: ['modalidade', 'tipo trade', 'day trade', 'daytrade', 'dt/swing', 'tipo operacao', 'tipo operação', 'estrategia', 'estratégia'],
  mercado: ['mercado', 'market', 'segmento', 'bolsa', 'tipo mercado'],
  multiplicador: ['multiplicador', 'mult', 'valor do ponto', 'ponto'],
  idExterno: ['id', 'id operacao', 'id operação', 'codigo operacao', 'numero', 'número', 'nro', 'n°', 'nº', 'negocio', 'negócio', 'order id', 'ordem', 'id ordem', 'id negocio', 'id negócio', 'trade id', 'exec id'],
};

function normalizarCabecalho(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Sugere o mapeamento pelos nomes das colunas. */
export function sugerirMapeamento(cabecalho: string[]): MapeamentoColunas {
  const map = Object.fromEntries(CAMPOS_IMPORTACAO.map((c) => [c, -1])) as MapeamentoColunas;
  const normalizados = cabecalho.map(normalizarCabecalho);
  const usados = new Set<number>();

  // 1ª passada: igualdade exata; 2ª: contém.
  for (const exato of [true, false]) {
    for (const campo of CAMPOS_IMPORTACAO) {
      if (map[campo] !== -1) continue;
      const sins = SINONIMOS[campo].map(normalizarCabecalho);
      const idx = normalizados.findIndex((h, i) =>
        !usados.has(i) && (exato ? sins.includes(h) : sins.some((s) => s.length > 2 && h.includes(s))),
      );
      if (idx !== -1) {
        map[campo] = idx;
        usados.add(idx);
      }
    }
  }
  // "data" com hora embutida cobre "horario".
  return map;
}

export interface OperacaoImportada {
  linha: number; // 1-based (sem contar cabeçalho)
  ativo: string;
  mercado: Mercado;
  lado: Lado;
  quantidade: number;
  preco: number;
  multiplicador: number;
  taxas: number; // centavos
  dataOperacao: string;
  horario: string | null;
  modalidade: Modalidade | null; // null = classificar automaticamente
  idExterno: string | null;
}

export interface LinhaInvalida {
  linha: number;
  motivo: string;
}

/** Converte as linhas do CSV em operações normalizadas usando o mapeamento. */
export function converterLinhas(
  linhas: string[][],
  map: MapeamentoColunas,
): { operacoes: OperacaoImportada[]; invalidas: LinhaInvalida[] } {
  const operacoes: OperacaoImportada[] = [];
  const invalidas: LinhaInvalida[] = [];
  const get = (linha: string[], campo: CampoImportacao) => (map[campo] >= 0 ? linha[map[campo]] ?? '' : '');

  linhas.forEach((linha, i) => {
    const n = i + 1;
    if (linha.every((c) => !c.trim())) return;
    const dataParse = parseDataBR(get(linha, 'data'));
    if (!dataParse) return void invalidas.push({ linha: n, motivo: `Data inválida: "${get(linha, 'data')}"` });
    const ativo = normalizarAtivo(get(linha, 'ativo'));
    if (!ativo) return void invalidas.push({ linha: n, motivo: 'Ativo vazio' });
    const lado = parseLado(get(linha, 'lado'));
    if (!lado) return void invalidas.push({ linha: n, motivo: `Lado inválido: "${get(linha, 'lado')}"` });
    const quantidade = parseNumeroBR(get(linha, 'quantidade'));
    if (!quantidade || quantidade <= 0 || !Number.isInteger(quantidade)) {
      return void invalidas.push({ linha: n, motivo: `Quantidade inválida: "${get(linha, 'quantidade')}"` });
    }
    const preco = parseNumeroBR(get(linha, 'preco'));
    if (preco === null || preco <= 0) return void invalidas.push({ linha: n, motivo: `Preço inválido: "${get(linha, 'preco')}"` });

    const horarioCol = map.horario >= 0 ? parseDataBR(`2000-01-01 ${get(linha, 'horario')}`)?.horario ?? null : null;
    const mercado = parseMercado(get(linha, 'mercado')) ?? mercadoSugerido(ativo);
    const multiplicador = parseNumeroBR(get(linha, 'multiplicador')) ?? multiplicadorSugerido(ativo, mercado);
    const taxasReais = parseNumeroBR(get(linha, 'taxas')) ?? 0;

    operacoes.push({
      linha: n,
      ativo,
      mercado,
      lado,
      quantidade,
      preco,
      multiplicador: multiplicador > 0 ? multiplicador : 1,
      taxas: Math.round(Math.abs(taxasReais) * 100),
      dataOperacao: dataParse.data,
      horario: horarioCol ?? dataParse.horario,
      modalidade: parseModalidade(get(linha, 'modalidade')),
      idExterno: get(linha, 'idExterno').trim() || null,
    });
  });

  return { operacoes, invalidas };
}

/** Chave determinística para deduplicar operações sem id externo. */
export function chaveDedupe(op: Pick<OperacaoImportada, 'dataOperacao' | 'ativo' | 'lado' | 'quantidade' | 'preco' | 'horario'>): string {
  return [op.dataOperacao, normalizarAtivo(op.ativo), op.lado, op.quantidade, Number(op.preco).toFixed(6), op.horario ?? ''].join('|');
}
