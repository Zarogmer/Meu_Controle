import { and, eq } from 'drizzle-orm';
import { db, integracoesCorretora } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import type { BrokerProvider, ContaRef } from './types';
import { ManualProvider } from './manual';
import { NelogicaProvider } from './nelogica';

export * from './types';
export { ManualProvider } from './manual';
export { NelogicaProvider, ConectorError, normalizarUrlConector } from './nelogica';

export type IntegracaoRow = typeof integracoesCorretora.$inferSelect;

/** Integração da conta (só do usuário dono), ou null. */
export async function integracaoDaConta(conta: ContaRef): Promise<IntegracaoRow | null> {
  const [row] = await db
    .select()
    .from(integracoesCorretora)
    .where(
      and(
        eq(integracoesCorretora.contaCorretoraId, conta.contaCorretoraId),
        eq(integracoesCorretora.lojaId, conta.lojaId),
        eq(integracoesCorretora.usuarioId, conta.usuarioId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function providerDaIntegracao(integracao: IntegracaoRow): BrokerProvider {
  if (integracao.provider === 'nelogica') {
    return new NelogicaProvider({ urlConector: integracao.urlConector, token: decryptSecret(integracao.tokenCriptografado) });
  }
  return new ManualProvider();
}

/** Resolve o provedor da conta: Nelogica se houver integração, senão manual. */
export async function getProvider(conta: ContaRef): Promise<{ provider: BrokerProvider; integracao: IntegracaoRow | null }> {
  const integracao = await integracaoDaConta(conta);
  if (!integracao) return { provider: new ManualProvider(), integracao: null };
  return { provider: providerDaIntegracao(integracao), integracao };
}
