import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { db, usuarios, tradingConfig } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { registrarAuditoria, origemDaRequisicao } from '@/lib/trading/servico';

/**
 * PUT { tradingHabilitado: boolean } — só a conta tech liga/desliga o
 * envio de ordens de um usuário. Desligar também volta o modo para
 * simulação. Fica registrado na auditoria do usuário.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ usuarioId: string }> }) {
  try {
    const admin = await requireSuperAdmin();
    const { usuarioId } = await params;
    const uid = parseInt(usuarioId, 10);
    const [u] = await db.select().from(usuarios).where(eq(usuarios.id, uid)).limit(1);
    if (!u || !u.lojaId) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    if (u.role === 'employee') return NextResponse.json({ error: 'Funcionário não pode operar' }, { status: 400 });

    const body = await request.json();
    const habilitar = body.tradingHabilitado === true;

    const [existente] = await db.select().from(tradingConfig).where(eq(tradingConfig.usuarioId, uid)).limit(1);
    if (existente) {
      await db.update(tradingConfig).set({
        tradingHabilitado: habilitar,
        habilitadoPor: habilitar ? admin.userId : existente.habilitadoPor,
        habilitadoEm: habilitar ? new Date() : existente.habilitadoEm,
        modo: habilitar ? existente.modo : 'simulacao',
        atualizadoEm: new Date(),
      }).where(eq(tradingConfig.id, existente.id));
    } else {
      await db.insert(tradingConfig).values({
        lojaId: u.lojaId, usuarioId: uid, tradingHabilitado: habilitar,
        habilitadoPor: habilitar ? admin.userId : null, habilitadoEm: habilitar ? new Date() : null,
      });
    }
    await registrarAuditoria({
      conta: { lojaId: u.lojaId, usuarioId: uid, contaCorretoraId: null }, ordemRef: randomUUID(),
      evento: habilitar ? 'trading_habilitado' : 'trading_desabilitado', modo: 'simulacao',
      mensagem: `${habilitar ? 'Habilitado' : 'Desabilitado'} pela conta tech (usuário ${admin.userId})`,
      origem: origemDaRequisicao(request.headers),
    });
    const [cfg] = await db.select().from(tradingConfig).where(eq(tradingConfig.usuarioId, uid)).limit(1);
    return NextResponse.json({ config: cfg });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Permissão insuficiente' || error.message === 'Não autorizado')) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Não autorizado' ? 401 : 403 });
    }
    console.error('Erro ao alterar flag de trading:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
