import { describe, expect, it } from 'vitest';
import {
  chaveDedupe,
  converterLinhas,
  detectarDelimitador,
  parseCsv,
  parseDataBR,
  parseLado,
  parseNumeroBR,
  sugerirMapeamento,
} from './csv';

describe('parseNumeroBR', () => {
  it('entende formatos brasileiros e internacionais', () => {
    expect(parseNumeroBR('1.234,56')).toBe(1234.56);
    expect(parseNumeroBR('1,234.56')).toBe(1234.56);
    expect(parseNumeroBR('120.000')).toBe(120000);
    expect(parseNumeroBR('120.5')).toBe(120.5);
    expect(parseNumeroBR('R$ 10,50')).toBe(10.5);
    expect(parseNumeroBR('-2,30')).toBe(-2.3);
    expect(parseNumeroBR('(2,30)')).toBe(-2.3);
    expect(parseNumeroBR('')).toBeNull();
    expect(parseNumeroBR('abc')).toBeNull();
  });
});

describe('parseDataBR', () => {
  it('aceita dd/mm/yyyy, yyyy-mm-dd e data com hora', () => {
    expect(parseDataBR('10/03/2026')).toEqual({ data: '2026-03-10', horario: null });
    expect(parseDataBR('10/03/26')).toEqual({ data: '2026-03-10', horario: null });
    expect(parseDataBR('2026-03-10')).toEqual({ data: '2026-03-10', horario: null });
    expect(parseDataBR('10/03/2026 14:35:07')).toEqual({ data: '2026-03-10', horario: '14:35:07' });
    expect(parseDataBR('2026-03-10T09:05:00')).toEqual({ data: '2026-03-10', horario: '09:05:00' });
    expect(parseDataBR('31/13/2026')).toBeNull();
    expect(parseDataBR('x')).toBeNull();
  });
});

describe('parseLado', () => {
  it('normaliza C/V, Compra/Venda, Buy/Sell', () => {
    expect(parseLado('C')).toBe('compra');
    expect(parseLado('Venda')).toBe('venda');
    expect(parseLado('BUY')).toBe('compra');
    expect(parseLado('sell')).toBe('venda');
    expect(parseLado('?')).toBeNull();
  });
});

describe('parseCsv', () => {
  it('detecta delimitador, remove BOM e respeita aspas', () => {
    const texto = '﻿Ativo;Data;"C/V";Qtd;Preço\r\nWINZ26;10/03/2026 10:00:00;C;2;"120.000"\r\nPETR4;10/03/2026;"V";100;"30,50"\r\n';
    const csv = parseCsv(texto);
    expect(csv.delimitador).toBe(';');
    expect(csv.cabecalho).toEqual(['Ativo', 'Data', 'C/V', 'Qtd', 'Preço']);
    expect(csv.linhas).toHaveLength(2);
    expect(csv.linhas[0]).toEqual(['WINZ26', '10/03/2026 10:00:00', 'C', '2', '120.000']);
    expect(detectarDelimitador('a,b,c')).toBe(',');
    expect(detectarDelimitador('a\tb\tc')).toBe('\t');
  });
});

describe('sugerirMapeamento + converterLinhas', () => {
  it('mapeia cabeçalhos do Profit e converte as linhas', () => {
    const csv = parseCsv([
      'Ativo;Data/Hora;C/V;Qtd;Preço;Taxas;Nº Negócio',
      'WINZ26;10/03/2026 10:00:00;C;2;120.000;1,80;123',
      'WINZ26;10/03/2026 10:05:00;V;2;120.150;1,80;124',
      'PETR4;11/03/2026;Compra;100;30,50;;',
      'XXXX;data ruim;C;1;10;;',
      'PETR4;11/03/2026;C;0;10;;',
    ].join('\n'));
    const map = sugerirMapeamento(csv.cabecalho);
    expect(map).toMatchObject({ ativo: 0, data: 1, lado: 2, quantidade: 3, preco: 4, taxas: 5, idExterno: 6, horario: -1 });

    const { operacoes, invalidas } = converterLinhas(csv.linhas, map);
    expect(operacoes).toHaveLength(3);
    expect(operacoes[0]).toMatchObject({
      ativo: 'WINZ26', mercado: 'futuros', lado: 'compra', quantidade: 2, preco: 120000,
      multiplicador: 0.2, taxas: 180, dataOperacao: '2026-03-10', horario: '10:00:00', idExterno: '123', modalidade: null,
    });
    expect(operacoes[2]).toMatchObject({ ativo: 'PETR4', mercado: 'acoes', lado: 'compra', quantidade: 100, preco: 30.5, multiplicador: 1, taxas: 0, idExterno: null });
    expect(invalidas).toEqual([
      { linha: 4, motivo: 'Data inválida: "data ruim"' },
      { linha: 5, motivo: 'Quantidade inválida: "0"' },
    ]);
  });

  it('chaveDedupe é determinística e inclui o horário', () => {
    const base = { dataOperacao: '2026-03-10', ativo: 'petr4', lado: 'compra' as const, quantidade: 100, preco: 30.5, horario: null };
    expect(chaveDedupe(base)).toBe('2026-03-10|PETR4|compra|100|30.500000|');
    expect(chaveDedupe({ ...base, horario: '10:00:00' })).not.toBe(chaveDedupe(base));
  });
});
