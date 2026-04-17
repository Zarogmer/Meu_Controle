import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Cadastro publico desativado. O acesso e criado apenas pelo administrador da plataforma.',
    },
    { status: 403 }
  );
}
