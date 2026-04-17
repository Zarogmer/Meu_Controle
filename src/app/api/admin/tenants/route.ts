import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { db, lojas, usuarios } from '@/lib/db';
import { eq, and, ilike, sql, desc } from 'drizzle-orm';
import bcrypt from 'bcrypt';

/** List all tenants (lojas) with metrics. */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';
    const status = searchParams.get('status') || '';

    const conditions = [];

    if (busca) {
      conditions.push(ilike(lojas.nome, `%${busca}%`));
    }

    if (status === 'ativo') {
      conditions.push(eq(lojas.ativo, true));
    } else if (status === 'suspenso') {
      conditions.push(eq(lojas.ativo, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: lojas.id,
        nome: lojas.nome,
        segmento: lojas.segmento,
        ativo: lojas.ativo,
        plano: lojas.plano,
        dataExpiracao: lojas.dataExpiracao,
        logoUrl: lojas.logoUrl,
        criadoEm: lojas.criadoEm,
        totalUsuarios: sql<number>`(SELECT COUNT(*) FROM usuarios u WHERE u.loja_id = ${lojas.id})`,
        totalOwners: sql<number>`(SELECT COUNT(*) FROM usuarios u WHERE u.loja_id = ${lojas.id} AND u.role = 'owner')`,
        totalProdutos: sql<number>`(SELECT COUNT(*) FROM produtos p WHERE p.loja_id = ${lojas.id})`,
        totalVendas: sql<number>`(SELECT COUNT(*) FROM vendas v WHERE v.loja_id = ${lojas.id})`,
      })
      .from(lojas)
      .where(whereClause)
      .orderBy(desc(lojas.criadoEm));

    return NextResponse.json({
      lojas: rows.map(r => ({
        ...r,
        totalUsuarios: Number(r.totalUsuarios),
        totalOwners: Number(r.totalOwners),
        totalProdutos: Number(r.totalProdutos),
        totalVendas: Number(r.totalVendas),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** Create a new tenant (loja) and its owner account. */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();
    const {
      nomeLoja,
      segmento,
      nome,
      email,
      senha,
      plano,
    } = body as {
      nomeLoja?: string;
      segmento?: string;
      nome?: string;
      email?: string;
      senha?: string;
      plano?: string;
    };

    if (!nomeLoja || !segmento || !nome || !email || !senha) {
      return NextResponse.json(
        { error: 'Nome da loja, segmento, nome, email e senha sao obrigatorios' },
        { status: 400 }
      );
    }

    if (senha.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    const [existingUser] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, email.trim().toLowerCase()))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ja existe um usuario com este email' },
        { status: 400 }
      );
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const tenantPlan = plano === 'premium' || plano === 'enterprise' ? plano : 'free';

    const created = await db.transaction(async (tx) => {
      const [novaLoja] = await tx
        .insert(lojas)
        .values({
          nome: nomeLoja.trim(),
          segmento: segmento.trim(),
          ativo: true,
          plano: tenantPlan,
        })
        .returning({
          id: lojas.id,
          nome: lojas.nome,
          segmento: lojas.segmento,
          plano: lojas.plano,
          ativo: lojas.ativo,
          criadoEm: lojas.criadoEm,
        });

      const [novoOwner] = await tx
        .insert(usuarios)
        .values({
          lojaId: novaLoja.id,
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senhaHash,
          role: 'owner',
          ativo: true,
        })
        .returning({
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
          role: usuarios.role,
        });

      return { loja: novaLoja, owner: novoOwner };
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'NÃ£o autorizado') {
      return NextResponse.json({ error: 'NÃ£o autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'PermissÃ£o insuficiente') {
      return NextResponse.json({ error: 'PermissÃ£o insuficiente' }, { status: 403 });
    }
    console.error('Erro ao criar loja:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
