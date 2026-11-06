import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, integracoesCorretora, contasCorretora } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';
import { respostaErro } from '@/lib/investimentos/http';
import { contaDoUsuario } from '@/lib/investimentos/servidor';
import { encryptSecret } from '@/lib/crypto';
import { serializarIntegracao } from '@/lib/investimentos/integracoes';
import { normalizarUrlConector, ConectorError } from '@/lib/brokers/nelogica';

/**
 * GET  /api/investimentos/conexoes       → contas do usuário + integração (sem segredos)
 * POST /api/investimentos/conexoes       → cria/atualiza a integração de uma conta
 *   body: { contaCorretoraId, urlConector, token?, chaveAtivacao? }
 *   token/chave omitidos numa atualização mantêm os atuais.
 */

export async function GET() {
  if (isDemoMode) return NextResponse.json({ conexoes: [] });
  try {
    const { lojaId, userId } = await requireInvestidor();
    const contas = await db
      .select({ id: contasCorretora.id, apelido: contasCorretora.apelido, corretora: contasCorretora.corretora, ativa: contasCorretora.ativa })
      .from(contasCorretora)
      .where(and(eq(contasCorretora.lojaId, lojaId), eq(contasCorretora.usuarioId, userId)));
    const integracoes = await db
      .select()
      .from(integracoesCorretora)
      .where(and(eq(integracoesCorretora.lojaId, lojaId), eq(integracoesCorretora.usuarioId, userId)));
    const porConta = new Map(integracoes.map((i) => [i.contaCorretoraId, serializarIntegracao(i)]));
    return NextResponse.json({
      conexoes: contas.map((c) => ({ conta: c, integracao: porConta.get(c.id) ?? null })),
    });
  } catch (error) {
    return respostaErro(error, 'listar conexões');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const body = await request.json();
    const contaId = parseInt(String(body.contaCorretoraId ?? ''), 10);
    const conta = Number.isInteger(contaId) ? await contaDoUsuario({ lojaId, userId }, contaId) : null;
    if (!conta) return NextResponse.json({ error: 'Conta de corretora não encontrada' }, { status: 404 });

    let urlConector: string;
    try {
      urlConector = normalizarUrlConector(String(body.urlConector ?? ''));
    } catch (e) {
      return NextResponse.json({ error: e instanceof ConectorError ? e.message : 'URL do conector inválida' }, { status: 400 });
    }

    const [existente] = await db
      .select()
      .from(integracoesCorretora)
      .where(eq(integracoesCorretora.contaCorretoraId, conta.id))
      .limit(1);

    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!existente && token.length < 16) {
      return NextResponse.json({ error: 'Informe o token do conector (mínimo 16 caracteres)' }, { status: 400 });
    }
    if (token && token.length < 16) {
      return NextResponse.json({ error: 'Token muito curto (mínimo 16 caracteres)' }, { status: 400 });
    }
    const chave = typeof body.chaveAtivacao === 'string' ? body.chaveAtivacao.trim() : undefined;

    if (existente) {
      await db
        .update(integracoesCorretora)
        .set({
          urlConector,
          tokenCriptografado: token ? encryptSecret(token) : existente.tokenCriptografado,
          chaveAtivacaoCriptografada: chave === undefined ? existente.chaveAtivacaoCriptografada : chave ? encryptSecret(chave) : null,
          status: 'desconectado',
          ultimoErro: null,
          atualizadoEm: new Date(),
        })
        .where(eq(integracoesCorretora.id, existente.id));
      const [row] = await db.select().from(integracoesCorretora).where(eq(integracoesCorretora.id, existente.id)).limit(1);
      return NextResponse.json({ integracao: serializarIntegracao(row) });
    }

    const [row] = await db
      .insert(integracoesCorretora)
      .values({
        lojaId,
        usuarioId: userId,
        contaCorretoraId: conta.id,
        provider: 'nelogica',
        urlConector,
        tokenCriptografado: encryptSecret(token),
        chaveAtivacaoCriptografada: chave ? encryptSecret(chave) : null,
        status: 'desconectado',
      })
      .returning();
    await db.update(contasCorretora).set({ origem: 'nelogica', atualizadoEm: new Date() }).where(eq(contasCorretora.id, conta.id));
    return NextResponse.json({ integracao: serializarIntegracao(row) }, { status: 201 });
  } catch (error) {
    return respostaErro(error, 'salvar conexão');
  }
}
