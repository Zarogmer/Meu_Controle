import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, categorias } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';

export async function GET() {
  try {
    const { lojaId } = await requireAuthWithTenant();

    const rows = await db
      .select({
        id: categorias.id,
        nome: categorias.nome,
        icone: categorias.icone,
        criadoEm: categorias.criadoEm,
      })
      .from(categorias)
      .where(eq(categorias.lojaId, lojaId))
      .orderBy(asc(categorias.nome));

    return NextResponse.json({ categorias: rows });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Erro ao listar categorias' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId } = await requireAuthWithTenant();
    const body = await request.json();
    const { nome, icone } = body;

    if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome da categoria é obrigatório' },
        { status: 400 }
      );
    }

    const [categoria] = await db
      .insert(categorias)
      .values({
        lojaId,
        nome: nome.trim(),
        icone: icone || null,
      })
      .returning({
        id: categorias.id,
        nome: categorias.nome,
        icone: categorias.icone,
        criadoEm: categorias.criadoEm,
      });

    return NextResponse.json({ categoria }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Erro ao criar categoria' },
      { status: 500 }
    );
  }
}
