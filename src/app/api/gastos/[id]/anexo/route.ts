import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, gastos } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { uploadFile, deleteImage } from '@/lib/blob';

/**
 * Anexo (fatura/boleto) de um gasto.
 *   POST   multipart/form-data { arquivo }  → sobe e grava anexoUrl
 *   DELETE                                  → remove o anexo
 */

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

async function carregarGasto(id: number, lojaId: number) {
  const [gasto] = await db
    .select()
    .from(gastos)
    .where(and(eq(gastos.id, id), eq(gastos.lojaId, lojaId)))
    .limit(1);
  return gasto ?? null;
}

function semPermissao(
  gasto: { tipo: 'pessoal' | 'empresa'; usuarioId: number | null },
  userId: number,
  role: string,
): boolean {
  return gasto.tipo === 'pessoal' && gasto.usuarioId !== userId && role !== 'super_admin';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();
    const { id } = await params;
    const gastoId = parseInt(id, 10);

    const existing = await carregarGasto(gastoId, lojaId);
    if (!existing) {
      return NextResponse.json({ error: 'Gasto não encontrado' }, { status: 404 });
    }
    if (semPermissao(existing, userId, role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const formData = await request.formData();
    const arquivo = formData.get('arquivo');
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return NextResponse.json({ error: 'Envie um arquivo' }, { status: 400 });
    }
    if (arquivo.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx. 8 MB)' }, { status: 400 });
    }
    const ext = ALLOWED_TYPES[arquivo.type];
    if (!ext) {
      return NextResponse.json({ error: 'Formato inválido. Use PDF, JPG, PNG ou WebP' }, { status: 400 });
    }

    const url = await uploadFile(arquivo, lojaId, `gasto-${gastoId}.${ext}`, 'faturas');

    // Substitui anexo anterior, se houver.
    if (existing.anexoUrl && existing.anexoUrl !== url) {
      await deleteImage(existing.anexoUrl);
    }

    await db
      .update(gastos)
      .set({ anexoUrl: url, atualizadoEm: new Date() })
      .where(and(eq(gastos.id, gastoId), eq(gastos.lojaId, lojaId)));

    return NextResponse.json({ anexoUrl: url });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao anexar fatura:', error);
    return NextResponse.json({ error: 'Erro ao enviar o arquivo' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();
    const { id } = await params;
    const gastoId = parseInt(id, 10);

    const existing = await carregarGasto(gastoId, lojaId);
    if (!existing) {
      return NextResponse.json({ error: 'Gasto não encontrado' }, { status: 404 });
    }
    if (semPermissao(existing, userId, role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    if (existing.anexoUrl) {
      await deleteImage(existing.anexoUrl);
      await db
        .update(gastos)
        .set({ anexoUrl: null, atualizadoEm: new Date() })
        .where(and(eq(gastos.id, gastoId), eq(gastos.lojaId, lojaId)));
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao remover anexo:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
