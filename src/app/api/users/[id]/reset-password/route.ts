import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { validatePassword } from '@/lib/password-policy';
import { withErrorHandler, errorResponse, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/users/:id/reset-password  (admin only)
// Body: { newPassword }
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const { newPassword } = (await req.json().catch(() => ({}))) as { newPassword?: string };
  if (!newPassword) {
    return errorResponse(400, '请提供新密码');
  }
  const pwdError = validatePassword(String(newPassword));
  if (pwdError) return errorResponse(400, pwdError);
  const exists = await prisma.user.findUnique({ where: { id } });
  if (!exists) return errorResponse(404, '用户不存在');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePwd: false },
  });
  return json({ ok: true });
});
