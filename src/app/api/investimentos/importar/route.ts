import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, operacoes } from '@/lib/db';
import { and, eq, inArray } from 'drizzle-orm';
import { respostaErro } from '@/lib/investimentos/http';
import { contaDoUsuario, hashDedupe } from '@/lib/investimentos/servidor';
import { classificarModalidade, normalizarAtivo, multiplicadorSugerido, mercadoSugerido, type Modalidade } from '@/lib/investimentos/calculos';
import { parseDataBR, parseLado, parseMercado, type OperacaoImportada } from '@/lib/investimentos/csv';

/**
 * POST /api/investimentos/importar
 * body: { contaCorretoraId, operacoes: OperacaoImportada[], dryRun?: boolean }
 *
 * Deduplica por idExterno (quando a fonte informa) ou por hash de
 * data+ativo+lado+qtd+preço(+hora). Operações sem modalidade são
 * classificadas automaticamente (compra e venda no mesmo dia = day trade),
 * olhando também o que já está gravado naqueles dias.
 * Com dryRun só devolve a contagem — é o que a pré-visualização usa.
 */
const MAX_LINHAS = 5000;

export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const body = await request.json();
    const dryRun = body.dryRun === true;
    const contaId = parseInt(String(body.contaCorretoraId ?? ''), 10);
    const conta = Number.isInteger(contaId) ? await contaDoUsuario({ lojaId, userId }, contaId) : null;
    if (!conta) return NextResponse.json({ error: 'Escolha uma conta de corretora válida' }, { status: 400 });

    const entrada: unknown[] = Array.isArray(body.operacoes) ? body.operacoes : [];
    if (entrada.length === 0) return NextResponse.json({ error: 'Nenhuma operação para importar' }, { status: 400 });
    if (entrada.length > MAX_LINHAS) {
      return NextResponse.json({ error: `Importe no máximo ${MAX_LINHAS} operações por vez` }, { status: 400 });
    }

    // Revalida tudo no servidor (o cliente já converteu, mas não confiamos nele).
    const invalidas: { linha: number; motivo: string }[] = [];
    const validas: (OperacaoImportada & { hash: string | null })[] = [];
    entrada.forEach((raw, i) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const linha = Number(r.linha) || i + 1;
      const data = parseDataBR(String(r.dataOperacao ?? ''));
      const ativo = normalizarAtivo(String(r.ativo ?? ''));
      const lado = parseLado(String(r.lado ?? ''));
      const quantidade = parseInt(String(r.quantidade ?? ''), 10);
      const preco = parseFloat(String(r.preco ?? ''));
      if (!data) return void invalidas.push({ linha, motivo: 'Data inválida' });
      if (!ativo) return void invalidas.push({ linha, motivo: 'Ativo vazio' });
      if (!lado) return void invalidas.push({ linha, motivo: 'Lado inválido' });
      if (!Number.isInteger(quantidade) || quantidade <= 0) return void invalidas.push({ linha, motivo: 'Quantidade inválida' });
      if (!Number.isFinite(preco) || preco <= 0) return void invalidas.push({ linha, motivo: 'Preço inválido' });
      const mercado = parseMercado(r.mercado ? String(r.mercado) : null) ?? mercadoSugerido(ativo);
      const multRaw = parseFloat(String(r.multiplicador ?? ''));
      const multiplicador = Number.isFinite(multRaw) && multRaw > 0 ? multRaw : multiplicadorSugerido(ativo, mercado);
      const taxas = Math.round(Math.abs(Number(r.taxas) || 0));
      const horario = r.horario ? parseDataBR(`2000-01-01 ${String(r.horario)}`)?.horario ?? null : data.horario;
      const idExterno = r.idExterno ? String(r.idExterno).trim() || null : null;
      const modalidade: Modalidade | null = r.modalidade === 'daytrade' || r.modalidade === 'swing' ? r.modalidade : null;
      const op: OperacaoImportada = {
        linha, ativo, mercado, lado, quantidade, preco, multiplicador, taxas,
        dataOperacao: data.data, horario, modalidade, idExterno,
      };
      validas.push({ ...op, hash: idExterno ? null : hashDedupe(op) });
    });

    // Dedupe contra o banco (por idExterno e por hash) e dentro do próprio lote.
    const idsExternos = validas.map((v) => v.idExterno).filter((v): v is string => !!v);
    const hashes = validas.map((v) => v.hash).filter((v): v is string => !!v);
    const existentesId = idsExternos.length
      ? await db.select({ v: operacoes.idExterno }).from(operacoes)
          .where(and(eq(operacoes.contaCorretoraId, conta.id), inArray(operacoes.idExterno, idsExternos)))
      : [];
    const existentesHash = hashes.length
      ? await db.select({ v: operacoes.hashDedupe }).from(operacoes)
          .where(and(eq(operacoes.contaCorretoraId, conta.id), inArray(operacoes.hashDedupe, hashes)))
      : [];
    const vistos = new Set<string>([
      ...existentesId.map((e) => `id:${e.v}`),
      ...existentesHash.map((e) => `h:${e.v}`),
    ]);

    const novas: typeof validas = [];
    const duplicadas: { linha: number; motivo: string }[] = [];
    for (const v of validas) {
      const chave = v.idExterno ? `id:${v.idExterno}` : `h:${v.hash}`;
      if (vistos.has(chave)) {
        duplicadas.push({ linha: v.linha, motivo: v.idExterno ? `ID ${v.idExterno} já importado` : 'Operação idêntica já existe' });
        continue;
      }
      vistos.add(chave);
      novas.push(v);
    }

    // Classificação automática de modalidade, considerando o que já existe nos mesmos dias.
    const datas = Array.from(new Set(novas.filter((n) => !n.modalidade).map((n) => n.dataOperacao)));
    const existentesDias = datas.length
      ? await db.select({ ativo: operacoes.ativo, lado: operacoes.lado, dataOperacao: operacoes.dataOperacao })
          .from(operacoes)
          .where(and(eq(operacoes.contaCorretoraId, conta.id), inArray(operacoes.dataOperacao, datas)))
      : [];
    // Mesmo formato das novas, só para a classificação enxergar os lados já gravados.
    const contexto = existentesDias.map((e, i) => ({
      id: `exist-${i}`, linha: 0, ativo: e.ativo, lado: e.lado, dataOperacao: e.dataOperacao,
      mercado: 'outros' as const, quantidade: 0, preco: 0, multiplicador: 1, taxas: 0,
      horario: null, idExterno: null, hash: null, modalidade: 'swing' as Modalidade | undefined,
    }));
    const classificadas = classificarModalidade([
      ...novas.map((n) => ({ ...n, id: `nova-${n.linha}`, modalidade: n.modalidade ?? undefined })),
      ...contexto,
    ]).filter((c) => c.id.startsWith('nova-'));

    const resumo = {
      total: entrada.length,
      novas: classificadas.length,
      duplicadas: duplicadas.length,
      invalidas: invalidas.length,
      daytrade: classificadas.filter((c) => c.modalidade === 'daytrade').length,
      swing: classificadas.filter((c) => c.modalidade === 'swing').length,
      detalhesDuplicadas: duplicadas.slice(0, 50),
      detalhesInvalidas: invalidas.slice(0, 50),
    };

    if (dryRun || classificadas.length === 0) {
      return NextResponse.json({ dryRun: true, ...resumo });
    }

    await db.insert(operacoes).values(
      classificadas.map((c) => ({
        lojaId,
        usuarioId: userId,
        contaCorretoraId: conta.id,
        ativo: c.ativo,
        mercado: c.mercado,
        lado: c.lado,
        quantidade: c.quantidade,
        preco: String(c.preco),
        multiplicador: String(c.multiplicador),
        taxas: c.taxas,
        dataOperacao: c.dataOperacao,
        horario: c.horario,
        modalidade: c.modalidade,
        origem: 'importacao' as const,
        idExterno: c.idExterno,
        hashDedupe: c.hash,
      })),
    );

    return NextResponse.json({ dryRun: false, ...resumo });
  } catch (error) {
    return respostaErro(error, 'importar operações');
  }
}
