import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { payrollInputFromDB } from '@/lib/converters';
import { withErrorHandler, errorResponse, json } from '@/lib/api';
import type { PayrollInput } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/payroll/inputs/:employeeId  (admin only)
// Upsert the working input for one employee for its year/month.
export const PUT = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ employeeId: string }> }) => {
  await requireAdmin();
  const { employeeId } = await ctx.params;
  const input = (await req.json().catch(() => ({}))) as Partial<PayrollInput>;
  if (!input.year || !input.month) {
    return errorResponse(400, '需要 year 和 month');
  }

  const row = await prisma.payrollInput.upsert({
    where: { employeeId_year_month: { employeeId, year: input.year, month: input.month } },
    create: {
      employeeId,
      year: input.year,
      month: input.month,
      attendanceDays: input.attendanceDays ?? 0,
      personalLeaveHours: input.personalLeaveHours ?? 0,
      sickLeaveDays: input.sickLeaveDays ?? 0,
      scheduledDays: input.scheduledDays ?? null,
      adjustment: input.adjustment ?? 0,
      bonus: input.bonus ?? 0,
      housingFundRatio: input.housingFundRatio ?? null,
      specialAdditionalDeduction: input.specialAdditionalDeduction ?? null,
      manualPayable: input.manualPayable ?? null,
      notes: input.notes ?? null,
      manualCumulative: (input.manualCumulative ?? null) as never,
    },
    update: {
      attendanceDays: input.attendanceDays ?? 0,
      personalLeaveHours: input.personalLeaveHours ?? 0,
      sickLeaveDays: input.sickLeaveDays ?? 0,
      scheduledDays: input.scheduledDays ?? null,
      adjustment: input.adjustment ?? 0,
      bonus: input.bonus ?? 0,
      housingFundRatio: input.housingFundRatio ?? null,
      specialAdditionalDeduction: input.specialAdditionalDeduction ?? null,
      manualPayable: input.manualPayable ?? null,
      notes: input.notes ?? null,
      manualCumulative: (input.manualCumulative ?? null) as never,
    },
  });
  return json(payrollInputFromDB(row));
});
