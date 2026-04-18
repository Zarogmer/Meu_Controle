import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { db, lojas, usuarios, produtos, vendas, dividas, gastos, lancamentos, tarefas } from '@/lib/db';
import { eq, desc, asc, sql, and, ne } from 'drizzle-orm';

/** GET: View tenant details with all users. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const lojaId = parseInt(id, 10);

    const [loja] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!loja) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    const userList = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        role: usuarios.role,
        ativo: usuarios.ativo,
        criadoEm: usuarios.criadoEm,
      })
      .from(usuarios)
      .where(eq(usuarios.lojaId, lojaId))
      .orderBy(desc(usuarios.role), asc(usuarios.nome));

    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // ── Financial aggregates ────────────────────────────────────
    const [vendasAgg] = await db
      .select({
        totalVendas: sql<number>`COALESCE(SUM(${vendas.quantidade} * ${vendas.precoUnitarioVenda}), 0)`,
        totalCusto: sql<number>`COALESCE(SUM(${vendas.quantidade} * ${vendas.precoUnitarioCusto}), 0)`,
        qtdVendas: sql<number>`COUNT(*)`,
      })
      .from(vendas)
      .where(eq(vendas.lojaId, lojaId));

    const [vendasMesAgg] = await db
      .select({
        totalVendas: sql<number>`COALESCE(SUM(${vendas.quantidade} * ${vendas.precoUnitarioVenda}), 0)`,
        qtdVendas: sql<number>`COUNT(*)`,
      })
      .from(vendas)
      .where(and(eq(vendas.lojaId, lojaId), sql`${vendas.dataVenda} >= ${firstOfMonth}`));

    const [dividasAgg] = await db
      .select({
        totalAberto: sql<number>`COALESCE(SUM(${dividas.valorTotal} - ${dividas.valorPago}), 0)`,
        qtdAberto: sql<number>`COUNT(*)`,
      })
      .from(dividas)
      .where(and(eq(dividas.lojaId, lojaId), ne(dividas.status, 'pago')));

    const [gastosAgg] = await db
      .select({
        totalMes: sql<number>`COALESCE(SUM(${gastos.valor}), 0)`,
        qtdMes: sql<number>`COUNT(*)`,
      })
      .from(gastos)
      .where(and(eq(gastos.lojaId, lojaId), sql`${gastos.dataGasto} >= ${firstOfMonth}`));

    const [produtosAgg] = await db
      .select({
        qtdProdutos: sql<number>`COUNT(*)`,
        estoqueValor: sql<number>`COALESCE(SUM(${produtos.quantidade} * ${produtos.precoCusto}), 0)`,
        unidadesEstoque: sql<number>`COALESCE(SUM(${produtos.quantidade}), 0)`,
      })
      .from(produtos)
      .where(eq(produtos.lojaId, lojaId));

    const [lancamentosAgg] = await db
      .select({
        qtdPendentes: sql<number>`COUNT(*) FILTER (WHERE ${lancamentos.status} != 'pago')`,
        valorPendente: sql<number>`COALESCE(SUM(${lancamentos.valor}) FILTER (WHERE ${lancamentos.status} != 'pago'), 0)`,
      })
      .from(lancamentos)
      .where(eq(lancamentos.lojaId, lojaId));

    const [tarefasAgg] = await db
      .select({
        qtdPendentes: sql<number>`COUNT(*) FILTER (WHERE ${tarefas.status} = 'pendente')`,
      })
      .from(tarefas)
      .where(eq(tarefas.lojaId, lojaId));

    const vendasRecentes = await db
      .select({
        id: vendas.id,
        dataVenda: vendas.dataVenda,
        quantidade: vendas.quantidade,
        precoUnitarioVenda: vendas.precoUnitarioVenda,
        precoUnitarioCusto: vendas.precoUnitarioCusto,
        produtoNome: produtos.nome,
      })
      .from(vendas)
      .leftJoin(produtos, eq(vendas.produtoId, produtos.id))
      .where(eq(vendas.lojaId, lojaId))
      .orderBy(desc(vendas.dataVenda), desc(vendas.id))
      .limit(5);

    const faturamento = Number(vendasAgg.totalVendas);
    const custo = Number(vendasAgg.totalCusto);
    const qtdVendas = Number(vendasAgg.qtdVendas);

    const metricas = {
      faturamentoTotal: faturamento,
      lucroBruto: faturamento - custo,
      margemPercentual: faturamento > 0 ? ((faturamento - custo) / faturamento) * 100 : 0,
      totalVendas: qtdVendas,
      ticketMedio: qtdVendas > 0 ? Math.round(faturamento / qtdVendas) : 0,
      faturamentoMes: Number(vendasMesAgg.totalVendas),
      vendasMes: Number(vendasMesAgg.qtdVendas),
      dividasAberto: Number(dividasAgg.totalAberto),
      qtdDividasAberto: Number(dividasAgg.qtdAberto),
      gastosMes: Number(gastosAgg.totalMes),
      qtdGastosMes: Number(gastosAgg.qtdMes),
      totalProdutos: Number(produtosAgg.qtdProdutos),
      estoqueValor: Number(produtosAgg.estoqueValor),
      unidadesEstoque: Number(produtosAgg.unidadesEstoque),
      lancamentosPendentes: Number(lancamentosAgg.qtdPendentes),
      valorLancamentosPendentes: Number(lancamentosAgg.valorPendente),
      tarefasPendentes: Number(tarefasAgg.qtdPendentes),
    };

    return NextResponse.json({
      loja,
      usuarios: userList,
      metricas,
      vendasRecentes: vendasRecentes.map(v => ({
        ...v,
        quantidade: Number(v.quantidade),
        precoUnitarioVenda: Number(v.precoUnitarioVenda),
        precoUnitarioCusto: Number(v.precoUnitarioCusto),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** PUT: Update tenant (suspend, change name, etc.). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const lojaId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { nome, segmento, ativo, logoUrl, corPrimaria } = body;

    // Build update fields using COALESCE-like logic
    const updateFields: Record<string, unknown> = {};
    if (nome !== undefined && nome !== null) updateFields.nome = nome;
    if (segmento !== undefined && segmento !== null) updateFields.segmento = segmento;
    if (ativo !== undefined) updateFields.ativo = ativo;
    if (logoUrl !== undefined && logoUrl !== null) updateFields.logoUrl = logoUrl;
    if (corPrimaria !== undefined && corPrimaria !== null) updateFields.corPrimaria = corPrimaria;

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(lojas)
        .set(updateFields)
        .where(eq(lojas.id, lojaId));
    }

    const [loja] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    return NextResponse.json({ loja });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** DELETE: Remove tenant and all associated data. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const lojaId = parseInt(id, 10);

    const [existing] = await db
      .select({ id: lojas.id })
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    // Delete users first, then the loja (cascade should handle it, but be explicit)
    await db.delete(usuarios).where(eq(usuarios.lojaId, lojaId));
    await db.delete(lojas).where(eq(lojas.id, lojaId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
