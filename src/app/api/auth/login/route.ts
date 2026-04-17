import { db, usuarios, lojas } from '@/lib/db';
import { signAccessToken, signRefreshToken, type JwtPayload } from '@/lib/auth';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { isDemoMode, demoAuth } from '@/lib/demo-data';
import { ensurePlatformSuperAdmin } from '@/lib/platform-bootstrap';

export async function POST(request: NextRequest) {
  if (isDemoMode) {
    const payload: JwtPayload = { ...demoAuth };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();

    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({
      success: true,
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
    await ensurePlatformSuperAdmin();

    const body = await request.json();
    const { email, senha } = body;

    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        senhaHash: usuarios.senhaHash,
        lojaId: usuarios.lojaId,
        role: usuarios.role,
        ativo: usuarios.ativo,
        nomeLoja: lojas.nome,
        lojaAtiva: lojas.ativo,
      })
      .from(usuarios)
      .leftJoin(lojas, eq(lojas.id, usuarios.lojaId))
      .where(eq(usuarios.email, email))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    if (!user.ativo) {
      return NextResponse.json(
        { error: 'Conta desativada. Entre em contato com o administrador.' },
        { status: 403 }
      );
    }

    // Check if tenant is active (skip for super_admin without a loja)
    if (user.lojaId && user.lojaAtiva === false) {
      return NextResponse.json(
        { error: 'Loja suspensa. Entre em contato com o suporte.' },
        { status: 403 }
      );
    }

    const senhaValida = await bcrypt.compare(senha, user.senhaHash);
    if (!senhaValida) {
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    const payload: JwtPayload = {
      userId: user.id,
      lojaId: user.lojaId,
      nomeLoja: user.nomeLoja,
      email: user.email,
      role: user.role,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();

    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({
      success: true,
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
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
