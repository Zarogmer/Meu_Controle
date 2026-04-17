import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, produtos, categorias } from '@/lib/db';
import { eq, and, lte, asc, sql } from 'drizzle-orm';
import { isDemoMode, demoEstoqueBaixo } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoEstoqueBaixo);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const rows = await db
      .select({
        id: produtos.id,
        nome: produtos.nome,
        quantidade: produtos.quantidade,
        precoVenda: produtos.precoVenda,
        categoriaNome: categorias.nome,
      })
      .from(produtos)
      .leftJoin(categorias, eq(produtos.categoriaId, categorias.id))
      .where(and(eq(produtos.lojaId, lojaId), lte(produtos.quantidade, 10)))
      .orderBy(asc(produtos.quantidade))
      .limit(10);

    return NextResponse.json({ produtos: rows });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
