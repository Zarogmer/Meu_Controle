import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithTenant } from '@/lib/auth';
import { db, produtos, categorias, vendas } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { uploadImage, deleteImage } from '@/lib/blob';
import { v4 as uuidv4 } from 'uuid';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// PUT: admin only (employees cannot edit products)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminWithTenant();
    const { id } = await params;
    const produtoId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(produtos)
      .where(and(eq(produtos.id, produtoId), eq(produtos.lojaId, auth.lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

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

    let imagemUrl: string | null = existing.imagemUrl;

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

      // Delete old image from blob storage if it exists
      if (existing.imagemUrl) {
        await deleteImage(existing.imagemUrl);
      }

      const ext = imagem.type.split('/')[1] === 'jpeg' ? 'jpg' : imagem.type.split('/')[1];
      const fileName = `${uuidv4()}.${ext}`;
      imagemUrl = await uploadImage(imagem, auth.lojaId, fileName);
    }

    await db
      .update(produtos)
      .set({
        nome: nome.trim(),
        descricao,
        categoriaId,
        precoCusto,
        precoVenda,
        quantidade,
        imagemUrl,
        atualizadoEm: new Date(),
      })
      .where(and(eq(produtos.id, produtoId), eq(produtos.lojaId, auth.lojaId)));

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
      .where(eq(produtos.id, produtoId))
      .limit(1);

    return NextResponse.json({ produto });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    console.error('Erro ao atualizar produto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE: admin only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminWithTenant();
    const { id } = await params;
    const produtoId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(produtos)
      .where(and(eq(produtos.id, produtoId), eq(produtos.lojaId, auth.lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    // Delete old image from blob storage if it exists
    if (existing.imagemUrl) {
      await deleteImage(existing.imagemUrl);
    }

    await db.delete(vendas).where(and(eq(vendas.produtoId, produtoId), eq(vendas.lojaId, auth.lojaId)));
    await db.delete(produtos).where(and(eq(produtos.id, produtoId), eq(produtos.lojaId, auth.lojaId)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    console.error('Erro ao deletar produto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
