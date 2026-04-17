import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, lancamentos } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { isDemoMode, demoLancamentosRecentes } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({ lancamentos: demoLancamentosRecentes.lancamentos.slice(0, 5) });
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const rows = await db
      .select()
      .from(lancamentos)
      .where(eq(lancamentos.lojaId, lojaId))
      .orderBy(desc(lancamentos.criadoEm))
      .limit(5);

    return NextResponse.json({ lancamentos: rows });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
