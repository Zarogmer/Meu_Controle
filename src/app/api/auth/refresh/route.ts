import { signAccessToken, signRefreshToken, verifyToken, type JwtPayload } from '@/lib/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isDemoMode, demoAuth } from '@/lib/demo-data';

export async function POST() {
  if (isDemoMode) {
    const payload: JwtPayload = { ...demoAuth };
    const newAccessToken = signAccessToken(payload);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();

    cookieStore.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    return NextResponse.json({ success: true });
  }

  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token não encontrado' },
        { status: 401 }
      );
    }

    let payload: JwtPayload;
    try {
      payload = verifyToken(refreshToken);
    } catch {
      return NextResponse.json(
        { error: 'Refresh token inválido ou expirado' },
        { status: 401 }
      );
    }

    const newAccessToken = signAccessToken({
      userId: payload.userId,
      lojaId: payload.lojaId,
      nomeLoja: payload.nomeLoja,
      email: payload.email,
      role: payload.role,
    });

    const isProduction = process.env.NODE_ENV === 'production';
    cookieStore.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
