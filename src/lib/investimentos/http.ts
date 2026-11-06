import { NextResponse } from 'next/server';

/** Mapeia os erros dos guards de auth para status HTTP. */
export function respostaErro(error: unknown, contexto: string) {
  if (error instanceof Error) {
    if (error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Investimentos disponíveis só para o dono da loja' }, { status: 403 });
    }
    if (error.message === 'Operação requer contexto de loja') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
  console.error(`Erro em ${contexto}:`, error);
  return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
}

export const CORRETORAS = ['agora', 'xp', 'clear', 'rico', 'btg', 'nuinvest', 'inter', 'genial', 'outra'] as const;
export const CORRETORA_LABEL: Record<(typeof CORRETORAS)[number], string> = {
  agora: 'Ágora',
  xp: 'XP',
  clear: 'Clear',
  rico: 'Rico',
  btg: 'BTG Pactual',
  nuinvest: 'NuInvest',
  inter: 'Inter',
  genial: 'Genial',
  outra: 'Outra',
};
