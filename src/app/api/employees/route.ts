import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { employeeFromDB } from '@/lib/converters';
import { validatePassword } from '@/lib/password-policy';
import { withErrorHandler, errorResponse, json } from '@/lib/api';
import type { Employee } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/employees
//   ADMIN  -> all employees
//   EMPLOYEE -> only the one bound to this account
export const GET = withErrorHandler(async () => {
  const session = await requireAuth();
  if (session.role === 'ADMIN') {
    const rows = await prisma.employee.findMany({ orderBy: { createdAt: 'asc' } });
    return json(rows.map(employeeFromDB));
  }
  // Employee: only self.
  if (!session.employeeId) return json([]);
  const row = await prisma.employee.findUnique({ where: { id: session.employeeId } });
  return json(row ? [employeeFromDB(row)] : []);
});

// POST /api/employees  (admin only) — create a new employee profile.
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Partial<Employee> & {
    // Optional: simultaneously create a login account bound to this employee.
    createAccount?: boolean;
    accountUsername?: string;
    accountPassword?: string;
  };

  if (!body.name || !body.entity || !body.employmentType || !body.currency) {
    return errorResponse(400, '缺少必填字段: name, entity, employmentType, currency');
  }

  const created = await prisma.employee.create({
    data: {
      name: body.name,
      idNumber: body.idNumber ?? null,
      entity: body.entity,
      employmentType: body.employmentType,
      currency: body.currency,
      department: body.department ?? null,
      status: body.status ?? '在职',
      baseSalary: body.baseSalary ?? 0,
      dailyRate: body.dailyRate ?? null,
      internSalaryType: body.internSalaryType ?? null,
      housingFundBase: body.housingFundBase ?? null,
      socialBase: body.socialBase ?? null,
      monthlySpecialAdditionalDeduction: body.monthlySpecialAdditionalDeduction ?? null,
      taxChildEducation: body.taxChildEducation ?? null,
      taxContinuingEducation: body.taxContinuingEducation ?? null,
      taxHousingLoanInterest: body.taxHousingLoanInterest ?? null,
      taxHousingRent: body.taxHousingRent ?? null,
      taxElderlySupport: body.taxElderlySupport ?? null,
      taxInfantCare: body.taxInfantCare ?? null,
      defaultHousingFundRatio: body.defaultHousingFundRatio ?? 0.05,
      isShenzhenHukou: body.isShenzhenHukou ?? false,
      joinDate: body.joinDate ?? null,
      leaveDate: body.leaveDate ?? null,
      notes: body.notes ?? null,
      noHousingAllowance: body.noHousingAllowance ?? null,
      prevCumulative: (body.prevCumulative ?? null) as any,
      prevCumulativeYear: body.prevCumulativeYear ?? null,
      workCity: body.workCity ?? null,
    },
  });

  // Optional: create the login account at the same time.
  let account: { username: string } | null = null;
  if (body.createAccount) {
    const username = body.accountUsername?.trim();
    const password = body.accountPassword;
    if (!username) {
      return errorResponse(400, '创建账号需要用户名');
    }
    const pwdError = validatePassword(password);
    if (pwdError) return errorResponse(400, pwdError);
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return errorResponse(409, '用户名已存在');
    const { hashPassword } = await import('@/lib/auth');
    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'EMPLOYEE',
        employeeId: created.id,
        mustChangePwd: false,
      },
    });
    account = { username };
  }

  return json({ employee: employeeFromDB(created), account }, 201);
});
