import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { validatePassword } from '@/lib/password-policy';
import { withErrorHandler, errorResponse, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicUser(u: {
  id: string; username: string; role: string; employeeId: string | null;
  active: boolean; mustChangePwd: boolean; createdAt: Date; employee?: { name: string } | null;
}) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    employeeId: u.employeeId,
    employeeName: u.employee?.name ?? null,
    active: u.active,
    mustChangePwd: u.mustChangePwd,
    createdAt: u.createdAt.toISOString(),
  };
}

// GET /api/users  (admin only) — list all accounts.
export const GET = withErrorHandler(async () => {
  await requireAdmin();
  const users = await prisma.user.findMany({
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return json(users.map(publicUser));
});

// POST /api/users  (admin only) — create a login account for an employee.
// Body: { username, password, employeeId, role?: 'EMPLOYEE' }
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as {
    username: string;
    password: string;
    employeeId?: string;
    role?: string;
  };
  const username = body.username?.trim();
  const password = body.password;
  if (!username) {
    return errorResponse(400, '用户名必填');
  }
  const pwdError = validatePassword(password);
  if (pwdError) return errorResponse(400, pwdError);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return errorResponse(409, '用户名已存在');

  // Validate employee binding if provided.
  if (body.employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: body.employeeId } });
    if (!emp) return errorResponse(404, '员工不存在');
    const bound = await prisma.user.findUnique({ where: { employeeId: body.employeeId } });
    if (bound) return errorResponse(409, '该员工已绑定账号');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: body.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
      employeeId: body.employeeId ?? null,
      mustChangePwd: false,
    },
    include: { employee: { select: { name: true } } },
  });
  return json(publicUser(user), 201);
});
