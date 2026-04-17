import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, categorias } from '@/lib/db';
import { normalizeCategoryName, PRESET_PRODUCT_CATEGORIES } from '@/lib/product-categories';

async function ensurePresetCategories(lojaId: number) {
  const existing = await db
    .select({
      id: categorias.id,
      nome: categorias.nome,
      icone: categorias.icone,
      criadoEm: categorias.criadoEm,
    })
    .from(categorias)
    .where(eq(categorias.lojaId, lojaId))
    .orderBy(asc(categorias.nome));

  const existingNames = new Set(existing.map((item) => normalizeCategoryName(item.nome)));

  const missing = PRESET_PRODUCT_CATEGORIES.filter(
    (name) => !existingNames.has(normalizeCategoryName(name))
  );

  if (missing.length > 0) {
    await db.insert(categorias).values(
      missing.map((nome) => ({
        lojaId,
        nome,
        icone: null,
      }))
    );
  }

  return db
    .select({
      id: categorias.id,
      nome: categorias.nome,
      icone: categorias.icone,
      criadoEm: categorias.criadoEm,
    })
    .from(categorias)
    .where(eq(categorias.lojaId, lojaId))
    .orderBy(asc(categorias.nome));
}

export async function GET() {
  try {
    const { lojaId } = await requireAuthWithTenant();
    const rows = await ensurePresetCategories(lojaId);

    return NextResponse.json({ categorias: rows });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Erro ao listar categorias.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'As categorias são padronizadas pela plataforma. Selecione uma opção da lista disponível.',
    },
    { status: 403 }
  );
}
