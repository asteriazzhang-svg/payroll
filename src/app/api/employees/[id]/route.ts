import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { employeeFromDB } from '@/lib/converters';
import { withErrorHandler, errorResponse, json } from '@/lib/api';
import type { Employee } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/employees/:id
//   ADMIN -> any. EMPLOYEE -> only own profile.
export const GET = withErrorHandler(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireAuth();
  const { id } = await ctx.params;
  if (session.role !== 'ADMIN' && session.employeeId !== id) {
    return errorResponse(403, '无权访问该员工档案');
  }
  const row = await prisma.employee.findUnique({ where: { id } });
  if (!row) return errorResponse(404, '员工不存在');
  return json(employeeFromDB(row));
});

// PUT /api/employees/:id  (admin only)
export const PUT = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<Employee>;
  const exists = await prisma.employee.findUnique({ where: { id } });
  if (!exists) return errorResponse(404, '员工不存在');

  const data: Record<string, unknown> = {};
  const direct: (keyof Employee)[] = [
    'name', 'idNumber', 'entity', 'employmentType', 'currency', 'department',
    'status', 'baseSalary', 'dailyRate', 'internSalaryType', 'housingFundBase',
    'socialBase', 'monthlySpecialAdditionalDeduction',
    'taxChildEducation', 'taxContinuingEducation', 'taxHousingLoanInterest',
    'taxHousingRent', 'taxElderlySupport', 'taxInfantCare',
    'defaultHousingFundRatio',
    'isShenzhenHukou', 'joinDate', 'leaveDate', 'notes', 'noHousingAllowance',
    'prevCumulativeYear', 'workCity',
  ];
  for (const k of direct) {
    if (body[k] !== undefined) data[k] = body[k] ?? null;
  }
  if (body.prevCumulative !== undefined) {
    data.prevCumulative = body.prevCumulative ?? null;
  }

  const row = await prisma.employee.update({ where: { id }, data });
  return json(employeeFromDB(row));
});

// DELETE /api/employees/:id  (admin only)
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  // Cascade deletes payroll inputs/records (per schema). The bound User is
  // SetNull, so the login account remains but is unbound.
  try {
    await prisma.employee.delete({ where: { id } });
  } catch {
    return errorResponse(404, '员工不存在');
  }
  return json({ ok: true });
});
