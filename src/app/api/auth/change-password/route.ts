import { type NextRequest } from 'next/server';
import { requireAuth, verifyPassword, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validatePassword } from '@/lib/password-policy';
import { withErrorHandler, errorResponse, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  const { oldPassword, newPassword } = await req.json().catch(() => ({}));
  if (!oldPassword || !newPassword) {
    return errorResponse(400, '请提供旧密码和新密码');
  }
  const pwdError = validatePassword(String(newPassword));
  if (pwdError) return errorResponse(400, pwdError);

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return errorResponse(404, '用户不存在');
  const ok = await verifyPassword(String(oldPassword), user.passwordHash);
  if (!ok) return errorResponse(401, '旧密码错误');

  const passwordHash = await hashPassword(String(newPassword));
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePwd: false },
  });
  return json({ ok: true });
});
