import { NextResponse } from 'next/server';

const BLOCKED_MESSAGE =
  'As categorias são padronizadas pela plataforma e não podem ser alteradas manualmente.';

export async function PUT() {
  return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 });
}

export async function DELETE() {
  return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 });
}
