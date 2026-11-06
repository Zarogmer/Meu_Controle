import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, operacoes, contasCorretora } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';
import { respostaErro } from '@/lib/investimentos/http';
import { carregarOperacoes, contaDoUsuario, type FiltrosOperacoes } from '@/lib/investimentos/servidor';
import { processarCarteira } from '@/lib/investimentos/calculos';
import { validarOperacao } from '@/lib/investimentos/validacao';
import { isDataISO } from '@/lib/contas';

/**
 * GET /api/investimentos/operacoes?contaCorretoraId&ativo&mercado&modalidade&lado&dataInicio&dataFim
 * Devolve o histórico com o resultado realizado de cada operação
 * (calculado sobre a carteira inteira, depois filtrado).
 */
export async function GET(request: NextRequest) {
  if (isDemoMode) return NextResponse.json({ operacoes: [] });
  try {
    const { lojaId, userId } = await requireInvestidor();
    const auth = { lojaId, userId };
    const sp = request.nextUrl.searchParams;
    const contaId = parseInt(sp.get('contaCorretoraId') || '', 10);
    const filtros: FiltrosOperacoes = {
      contaCorretoraId: Number.isInteger(contaId) && contaId > 0 ? contaId : undefined,
      ativo: sp.get('ativo') || undefined,
      mercado: sp.get('mercado') || undefined,
      modalidade: sp.get('modalidade') || undefined,
      lado: sp.get('lado') || undefined,
      dataInicio: isDataISO(sp.get('dataInicio')) ? sp.get('dataInicio')! : undefined,
      dataFim: isDataISO(sp.get('dataFim')) ? sp.get('dataFim')! : undefined,
    };

    // Carteira completa (por conta, se filtrada) para o resultado por operação ficar certo.
    const todas = await carregarOperacoes(auth, { contaCorretoraId: filtros.contaCorretoraId });
    const carteira = processarCarteira(todas);
    const resultadoPorId = new Map(carteira.operacoes.map((p) => [p.operacao.id, p]));

    const contas = await db
      .select({ id: contasCorretora.id, apelido: contasCorretora.apelido })
      .from(contasCorretora)
      .where(and(eq(contasCorretora.lojaId, lojaId), eq(contasCorretora.usuarioId, userId)));
    const apelidoPorConta = new Map(contas.map((c) => [c.id, c.apelido]));

    const ativoFiltro = filtros.ativo?.trim().toUpperCase();
    const lista = todas
      .filter((op) => {
        if (ativoFiltro && !op.ativo.includes(ativoFiltro)) return false;
        if (filtros.mercado && op.mercado !== filtros.mercado) return false;
        if (filtros.modalidade && op.modalidade !== filtros.modalidade) return false;
        if (filtros.lado && op.lado !== filtros.lado) return false;
        if (filtros.dataInicio && op.dataOperacao < filtros.dataInicio) return false;
        if (filtros.dataFim && op.dataOperacao > filtros.dataFim) return false;
        return true;
      })
      .map((op) => {
        const p = resultadoPorId.get(op.id);
        return {
          ...op.row,
          preco: Number(op.row.preco),
          multiplicador: Number(op.row.multiplicador),
          contaApelido: apelidoPorConta.get(op.row.contaCorretoraId) ?? null,
          precoMedioAntes: p?.precoMedioAntes ?? 0,
          quantidadeFechada: p?.quantidadeFechada ?? 0,
          resultadoBruto: p?.resultadoBruto ?? 0,
          resultadoLiquido: p?.resultadoLiquido ?? 0,
        };
      })
      .reverse(); // mais recentes primeiro

    return NextResponse.json({ operacoes: lista });
  } catch (error) {
    return respostaErro(error, 'listar operações');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const body = await request.json();
    const validado = validarOperacao(body);
    if ('error' in validado) return NextResponse.json({ error: validado.error }, { status: 400 });

    const conta = await contaDoUsuario({ lojaId, userId }, validado.contaCorretoraId);
    if (!conta) return NextResponse.json({ error: 'Conta de corretora não encontrada' }, { status: 404 });

    const [nova] = await db
      .insert(operacoes)
      .values({
        lojaId,
        usuarioId: userId,
        contaCorretoraId: conta.id,
        ativo: validado.ativo,
        mercado: validado.mercado,
        lado: validado.lado,
        quantidade: validado.quantidade,
        preco: String(validado.preco),
        multiplicador: String(validado.multiplicador),
        taxas: validado.taxas,
        dataOperacao: validado.dataOperacao,
        horario: validado.horario,
        modalidade: validado.modalidade,
        origem: 'manual',
        observacao: validado.observacao,
      })
      .returning();
    return NextResponse.json({ operacao: nova }, { status: 201 });
  } catch (error) {
    return respostaErro(error, 'criar operação');
  }
}
