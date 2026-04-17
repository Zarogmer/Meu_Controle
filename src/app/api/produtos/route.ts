import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, produtos, categorias } from '@/lib/db';
import { eq, and, ilike, count, asc, desc, sql } from 'drizzle-orm';
import { uploadImage } from '@/lib/blob';
import { v4 as uuidv4 } from 'uuid';

const VALID_SORT_COLUMNS = ['nome', 'quantidade', 'precoCusto', 'precoVenda', 'criadoEm'] as const;
const VALID_ORDER = ['asc', 'desc'] as const;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// GET: all authenticated users (employee, admin, super_admin)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthWithTenant();

    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';
    const categoria = searchParams.get('categoria') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const sortParam = searchParams.get('sort') || 'nome';
    const sort = (VALID_SORT_COLUMNS as readonly string[]).includes(sortParam) ? sortParam : 'nome';
    const orderParam = searchParams.get('order') || 'asc';
    const order = (VALID_ORDER as readonly string[]).includes(orderParam) ? orderParam : 'asc';

    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(produtos.lojaId, auth.lojaId)];

    if (busca) {
      conditions.push(ilike(produtos.nome, `%${busca}%`));
    }

    if (categoria) {
      conditions.push(eq(produtos.categoriaId, parseInt(categoria, 10)));
    }

    const whereClause = and(...conditions);

    // Count total
    const [countResult] = await db
      .select({ total: count() })
      .from(produtos)
      .where(whereClause);
    const total = countResult?.total ?? 0;

    // Build sort column
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortColumnMap: Record<string, any> = {
      nome: produtos.nome,
      quantidade: produtos.quantidade,
      precoCusto: produtos.precoCusto,
      precoVenda: produtos.precoVenda,
      criadoEm: produtos.criadoEm,
    };
    const sortCol = sortColumnMap[sort] || produtos.nome;
    const orderFn = order === 'desc' ? desc(sortCol) : asc(sortCol);

    // Query with join
    const rows = await db
      .select({
        id: produtos.id,
        lojaId: produtos.lojaId,
        nome: produtos.nome,
        descricao: produtos.descricao,
        categoriaId: produtos.categoriaId,
        precoCusto: produtos.precoCusto,
        precoVenda: produtos.precoVenda,
        quantidade: produtos.quantidade,
        imagemUrl: produtos.imagemUrl,
        criadoEm: produtos.criadoEm,
        atualizadoEm: produtos.atualizadoEm,
        categoriaNome: categorias.nome,
      })
      .from(produtos)
      .leftJoin(categorias, eq(produtos.categoriaId, categorias.id))
      .where(whereClause)
      .orderBy(orderFn)
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ produtos: rows, total, page, totalPages });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao listar produtos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST: admin and employee can create products
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTenant();

    const formData = await request.formData();

    const nome = formData.get('nome') as string;
    const descricao = (formData.get('descricao') as string) || null;
    const categoriaId = formData.get('categoriaId')
      ? parseInt(formData.get('categoriaId') as string, 10)
      : null;
    const precoCusto = Math.round(parseFloat(formData.get('precoCusto') as string || '0') * 100);
    const precoVenda = Math.round(parseFloat(formData.get('precoVenda') as string || '0') * 100);
    const quantidade = parseInt(formData.get('quantidade') as string || '0', 10);
    const imagem = formData.get('imagem') as File | null;

    if (!nome || nome.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    let imagemUrl: string | null = null;

    if (imagem && imagem.size > 0) {
      if (imagem.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: 'Imagem deve ter no máximo 2MB' }, { status: 400 });
      }

      if (!ALLOWED_IMAGE_TYPES.includes(imagem.type)) {
        return NextResponse.json(
          { error: 'Tipo de imagem inválido. Use JPEG, PNG ou WebP' },
          { status: 400 }
        );
      }

      const ext = imagem.type.split('/')[1] === 'jpeg' ? 'jpg' : imagem.type.split('/')[1];
      const fileName = `${uuidv4()}.${ext}`;
      imagemUrl = await uploadImage(imagem, auth.lojaId, fileName);
    }

    const [inserted] = await db
      .insert(produtos)
      .values({
        lojaId: auth.lojaId,
        nome: nome.trim(),
        descricao,
        categoriaId,
        precoCusto,
        precoVenda,
        quantidade,
        imagemUrl,
      })
      .returning();

    // Re-query with join for categoriaNome
    const [produto] = await db
      .select({
        id: produtos.id,
        lojaId: produtos.lojaId,
        nome: produtos.nome,
        descricao: produtos.descricao,
        categoriaId: produtos.categoriaId,
        precoCusto: produtos.precoCusto,
        precoVenda: produtos.precoVenda,
        quantidade: produtos.quantidade,
        imagemUrl: produtos.imagemUrl,
        criadoEm: produtos.criadoEm,
        atualizadoEm: produtos.atualizadoEm,
        categoriaNome: categorias.nome,
      })
      .from(produtos)
      .leftJoin(categorias, eq(produtos.categoriaId, categorias.id))
      .where(eq(produtos.id, inserted.id))
      .limit(1);

    return NextResponse.json({ produto }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao criar produto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
