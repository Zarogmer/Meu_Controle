import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, vendas, produtos, withTenant } from '@/lib/db';
import { eq, and, between, desc, sql } from 'drizzle-orm';

function getDateRange(periodo: string | null, de: string | null, ate: string | null): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = ate || now.toISOString().split('T')[0];
  let startDate: string;

  switch (periodo) {
    case 'semana': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().split('T')[0];
      break;
    }
    case 'trimestre': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      startDate = d.toISOString().split('T')[0];
      break;
    }
    case 'personalizado': {
      startDate = de || now.toISOString().split('T')[0];
      break;
    }
    default: { // mes
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      startDate = d.toISOString().split('T')[0];
      break;
    }
  }
  return { startDate, endDate };
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId } = await requireAuthWithTenant();

    const body = await request.json();
    const { produtoId, quantidade, dataVenda } = body;

    if (!produtoId || !quantidade || quantidade <= 0) {
      return NextResponse.json(
        { error: 'produtoId e quantidade (> 0) são obrigatórios' },
        { status: 400 }
      );
    }

    const dataVendaFinal = dataVenda || new Date().toISOString().split('T')[0];

    // ── Transação atômica: venda + baixa de estoque ──────────────
    // Se qualquer etapa falhar, TUDO é revertido automaticamente.
    // Isso garante que nunca teremos venda sem baixa de estoque,
    // nem estoque negativo no banco.
    const resultado = await db.transaction(async (tx) => {
      // 1. Busca o produto (dentro da transação para lock de leitura)
      const [produto] = await tx
        .select()
        .from(produtos)
        .where(withTenant(produtos.lojaId, lojaId, eq(produtos.id, produtoId)))
        .limit(1);

      if (!produto) {
        throw new Error('PRODUTO_NAO_ENCONTRADO');
      }

      if (quantidade > produto.quantidade) {
        throw new Error(`ESTOQUE_INSUFICIENTE:${produto.quantidade}`);
      }

      // 2. Decrementa o estoque
      const [produtoAtualizado] = await tx
        .update(produtos)
        .set({
          quantidade: sql`${produtos.quantidade} - ${quantidade}`,
          atualizadoEm: new Date(),
        })
        .where(withTenant(produtos.lojaId, lojaId, eq(produtos.id, produtoId)))
        .returning();

      // 3. Verifica se o estoque ficou negativo (race condition protection)
      if (produtoAtualizado.quantidade < 0) {
        throw new Error(`ESTOQUE_INSUFICIENTE:${produto.quantidade}`);
      }

      // 4. Cria o registro da venda
      const [venda] = await tx
        .insert(vendas)
        .values({
          lojaId,
          produtoId,
          quantidade,
          precoUnitarioVenda: produto.precoVenda,
          precoUnitarioCusto: produto.precoCusto,
          dataVenda: dataVendaFinal,
        })
        .returning();

      return { venda, estoqueRestante: produtoAtualizado.quantidade };
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Não autorizado') {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
      if (error.message === 'PRODUTO_NAO_ENCONTRADO') {
        return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
      }
      if (error.message.startsWith('ESTOQUE_INSUFICIENTE:')) {
        const disponivel = error.message.split(':')[1];
        return NextResponse.json(
          { error: `Estoque insuficiente. Disponível: ${disponivel}` },
          { status: 400 }
        );
      }
    }
    console.error('Erro ao registrar venda:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { lojaId } = await requireAuthWithTenant();

    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo');
    const de = searchParams.get('de');
    const ate = searchParams.get('ate');

    const { startDate, endDate } = getDateRange(periodo, de, ate);

    const rows = await db
      .select({
        id: vendas.id,
        lojaId: vendas.lojaId,
        produtoId: vendas.produtoId,
        quantidade: vendas.quantidade,
        precoUnitarioVenda: vendas.precoUnitarioVenda,
        precoUnitarioCusto: vendas.precoUnitarioCusto,
        dataVenda: vendas.dataVenda,
        criadoEm: vendas.criadoEm,
        produtoNome: produtos.nome,
      })
      .from(vendas)
      .innerJoin(produtos, eq(produtos.id, vendas.produtoId))
      .where(
        withTenant(vendas.lojaId, lojaId, between(vendas.dataVenda, startDate, endDate))
      )
      .orderBy(desc(vendas.dataVenda));

    return NextResponse.json({ vendas: rows });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao listar vendas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
