import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { withErrorHandler, errorResponse, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return errorResponse(400, '用户名和密码不能为空');
  }

  const user = await prisma.user.findUnique({ where: { username: String(username) } });
  // Always run a compare to keep timing roughly constant whether or not the
  // user exists (mitigates username enumeration via timing).
  const ok = user ? await verifyPassword(String(password), user.passwordHash) : await verifyPassword(String(password), '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvali');
  if (!user || !ok || !user.active) {
    return errorResponse(401, '用户名或密码错误，或账号已停用');
  }

  const token = createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role as 'ADMIN' | 'EMPLOYEE',
    employeeId: user.employeeId,
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employeeId,
      mustChangePwd: user.mustChangePwd,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
