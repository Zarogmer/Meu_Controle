import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, contasCorretora, operacoes } from '@/lib/db';
import { and, asc, eq, sql } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';
import { respostaErro, CORRETORAS } from '@/lib/investimentos/http';

export async function GET() {
  if (isDemoMode) return NextResponse.json({ contas: [] });
  try {
    const { lojaId, userId } = await requireInvestidor();
    const rows = await db
      .select({
        id: contasCorretora.id,
        corretora: contasCorretora.corretora,
        apelido: contasCorretora.apelido,
        conta: contasCorretora.conta,
        origem: contasCorretora.origem,
        ativa: contasCorretora.ativa,
        criadoEm: contasCorretora.criadoEm,
        totalOperacoes: sql<number>`(SELECT COUNT(*) FROM ${operacoes} WHERE ${operacoes.contaCorretoraId} = ${contasCorretora.id})`,
      })
      .from(contasCorretora)
      .where(and(eq(contasCorretora.lojaId, lojaId), eq(contasCorretora.usuarioId, userId)))
      .orderBy(asc(contasCorretora.criadoEm));
    return NextResponse.json({ contas: rows.map((r) => ({ ...r, totalOperacoes: Number(r.totalOperacoes) })) });
  } catch (error) {
    return respostaErro(error, 'listar contas de corretora');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const body = await request.json();
    const { apelido, corretora, conta, ativa } = body;

    if (!apelido || !String(apelido).trim()) {
      return NextResponse.json({ error: 'Dê um apelido para a conta' }, { status: 400 });
    }
    const corretoraFinal = (CORRETORAS as readonly string[]).includes(corretora) ? corretora : 'outra';

    const [nova] = await db
      .insert(contasCorretora)
      .values({
        lojaId,
        usuarioId: userId,
        apelido: String(apelido).trim(),
        corretora: corretoraFinal,
        conta: conta ? String(conta).trim() || null : null,
        origem: 'manual',
        ativa: ativa === false ? false : true,
      })
      .returning();
    return NextResponse.json({ conta: nova }, { status: 201 });
  } catch (error) {
    return respostaErro(error, 'criar conta de corretora');
  }
}
