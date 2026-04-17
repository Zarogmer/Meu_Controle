import { requireAuth } from '@/lib/auth';
import { db, usuarios, lojas } from '@/lib/db';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { isDemoMode, demoAuth } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({
      user: {
        id: demoAuth.userId,
        nome: 'Kaic',
        email: demoAuth.email,
        lojaId: demoAuth.lojaId,
        nomeLoja: demoAuth.nomeLoja,
        role: demoAuth.role,
      },
    });
  }

  try {
    const auth = await requireAuth();

    const [user] = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        lojaId: usuarios.lojaId,
        role: usuarios.role,
        nomeLoja: lojas.nome,
      })
      .from(usuarios)
      .leftJoin(lojas, eq(lojas.id, usuarios.lojaId))
      .where(and(eq(usuarios.id, auth.userId), eq(usuarios.ativo, true)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        lojaId: user.lojaId,
        nomeLoja: user.nomeLoja,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
