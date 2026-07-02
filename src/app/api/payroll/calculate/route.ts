import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { payrollRecordFromDB } from '@/lib/converters';
import { withErrorHandler, errorResponse, json } from '@/lib/api';
import { calculatePayroll, getPreviousMonth } from '@/lib/payroll';
import type { Employee, PayrollInput, PayrollRecord, PayPeriodConfig } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/payroll/calculate  (admin only)
// Body: { employeeId, input: PayrollInput, config: PayPeriodConfig }
// Returns the computed PayrollResult (without saving). Reuses the pure engine.
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as {
    employeeId: string;
    input: PayrollInput;
    config: PayPeriodConfig;
  };
  if (!body.employeeId || !body.input || !body.config) {
    return errorResponse(400, '需要 employeeId, input, config');
  }

  const emp = await prisma.employee.findUnique({ where: { id: body.employeeId } });
  if (!emp) return errorResponse(404, '员工不存在');

  // Previous month's saved record for cumulative carry-forward.
  const prev = getPreviousMonth(body.input.year, body.input.month);
  let prevRecord: PayrollRecord | null = null;
  if (prev.year === body.input.year) {
    const prevRow = await prisma.payrollRecord.findUnique({
      where: { employeeId_year_month: { employeeId: emp.id, year: prev.year, month: prev.month } },
    });
    if (prevRow) prevRecord = payrollRecordFromDB(prevRow);
  }

  const employee: Employee = {
    id: emp.id,
    name: emp.name,
    entity: emp.entity as Employee['entity'],
    employmentType: emp.employmentType as Employee['employmentType'],
    currency: emp.currency as Employee['currency'],
    department: emp.department ?? undefined,
    status: emp.status as Employee['status'],
    baseSalary: emp.baseSalary,
    dailyRate: emp.dailyRate ?? undefined,
    internSalaryType: emp.internSalaryType as Employee['internSalaryType'],
    housingFundBase: emp.housingFundBase ?? undefined,
    socialBase: emp.socialBase ?? undefined,
    monthlySpecialAdditionalDeduction: emp.monthlySpecialAdditionalDeduction ?? undefined,
    taxChildEducation: emp.taxChildEducation ?? undefined,
    taxContinuingEducation: emp.taxContinuingEducation ?? undefined,
    taxHousingLoanInterest: emp.taxHousingLoanInterest ?? undefined,
    taxHousingRent: emp.taxHousingRent ?? undefined,
    taxElderlySupport: emp.taxElderlySupport ?? undefined,
    taxInfantCare: emp.taxInfantCare ?? undefined,
    defaultHousingFundRatio: emp.defaultHousingFundRatio,
    noHousingAllowance: emp.noHousingAllowance ?? undefined,
    isShenzhenHukou: emp.isShenzhenHukou ?? undefined,
    workCity: emp.workCity ?? undefined,
    prevCumulative: (emp.prevCumulative as Employee['prevCumulative']) ?? undefined,
    prevCumulativeYear: emp.prevCumulativeYear ?? undefined,
  };

  const result = calculatePayroll(employee, body.input, body.config, prevRecord);
  return json({ result });
});
