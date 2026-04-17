import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { db, lojas, usuarios } from '@/lib/db';
import { eq, count, desc, sql } from 'drizzle-orm';

export async function GET() {
  try {
    await requireSuperAdmin();

    const [totalLojasResult] = await db.select({ c: count() }).from(lojas);
    const totalLojas = totalLojasResult.c;

    const [lojasAtivasResult] = await db.select({ c: count() }).from(lojas).where(eq(lojas.ativo, true));
    const lojasAtivas = lojasAtivasResult.c;
    const lojasSuspensas = totalLojas - lojasAtivas;

    const [totalUsuariosResult] = await db.select({ c: count() }).from(usuarios);
    const totalUsuarios = totalUsuariosResult.c;

    const [usuariosAtivosResult] = await db.select({ c: count() }).from(usuarios).where(eq(usuarios.ativo, true));
    const usuariosAtivos = usuariosAtivosResult.c;

    const [totalAdminsResult] = await db.select({ c: count() }).from(usuarios).where(eq(usuarios.role, 'owner'));
    const totalAdmins = totalAdminsResult.c;

    const [totalEmployeesResult] = await db.select({ c: count() }).from(usuarios).where(eq(usuarios.role, 'employee'));
    const totalEmployees = totalEmployeesResult.c;

    // Recent lojas (last 10)
    const lojasRecentes = await db
      .select({
        id: lojas.id,
        nome: lojas.nome,
        segmento: lojas.segmento,
        ativo: lojas.ativo,
        criadoEm: lojas.criadoEm,
        totalUsuarios: sql<number>`(SELECT COUNT(*) FROM usuarios u WHERE u.loja_id = ${lojas.id})`,
      })
      .from(lojas)
      .orderBy(desc(lojas.criadoEm))
      .limit(10);

    return NextResponse.json({
      totalLojas,
      lojasAtivas,
      lojasSuspensas,
      totalUsuarios,
      usuariosAtivos,
      totalAdmins,
      totalEmployees,
      lojasRecentes: lojasRecentes.map(l => ({ ...l, totalUsuarios: Number(l.totalUsuarios) })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
