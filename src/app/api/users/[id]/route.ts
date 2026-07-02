import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { withErrorHandler, errorResponse, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/users/:id  (admin only)
// Body (any subset): { active?, mustChangePwd?, employeeId?(string|null), role? }
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    active?: boolean;
    mustChangePwd?: boolean;
    employeeId?: string | null;
    role?: string;
  };

  const exists = await prisma.user.findUnique({ where: { id } });
  if (!exists) return errorResponse(404, '用户不存在');

  const data: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') data.active = body.active;
  if (typeof body.mustChangePwd === 'boolean') data.mustChangePwd = body.mustChangePwd;
  if (body.role === 'ADMIN' || body.role === 'EMPLOYEE') data.role = body.role;
  if (body.employeeId !== undefined) {
    if (body.employeeId !== null) {
      const emp = await prisma.employee.findUnique({ where: { id: body.employeeId } });
      if (!emp) return errorResponse(404, '员工不存在');
      const bound = await prisma.user.findUnique({ where: { employeeId: body.employeeId } });
      if (bound && bound.id !== id) return errorResponse(409, '该员工已绑定其他账号');
    }
    data.employeeId = body.employeeId;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    include: { employee: { select: { name: true } } },
  });
  return json({
    id: user.id,
    username: user.username,
    role: user.role,
    employeeId: user.employeeId,
    employeeName: user.employee?.name ?? null,
    active: user.active,
    mustChangePwd: user.mustChangePwd,
  });
});

// DELETE /api/users/:id  (admin only)
// Prevents deleting the last admin account.
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return errorResponse(404, '用户不存在');
  if (target.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
    if (adminCount <= 1) return errorResponse(400, '不能删除最后一个管理员账号');
  }
  await prisma.user.delete({ where: { id } });
  return json({ ok: true });
});
