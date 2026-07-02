import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { payrollRecordFromDB } from '@/lib/converters';
import { withErrorHandler, errorResponse, json } from '@/lib/api';
import { calculatePayroll, getPreviousMonth } from '@/lib/payroll';
import type { Employee, PayrollInput, PayrollRecord, PayPeriodConfig } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SaveOne {
  employeeId: string;
  input: PayrollInput;
}

// POST /api/payroll/save  (admin only)
// Body: { records: { employeeId, input }[], config: PayPeriodConfig }
// Saves (upserts) one PayrollRecord per entry for the input's year/month.
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as {
    records: SaveOne[];
    config: PayPeriodConfig;
  };
  if (!Array.isArray(body.records) || !body.config) {
    return errorResponse(400, '需要 records 数组和 config');
  }

  const saved: PayrollRecord[] = [];

  // Resolve all at once to avoid N+1 queries inside the loop.
  const employeeIds = body.records.map((r) => r.employeeId);
  const sampleInput = body.records[0]?.input;
  const prevMonth = sampleInput ? getPreviousMonth(sampleInput.year, sampleInput.month) : null;

  const [empMap, prevMap] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: employeeIds } } }).then((rows) => {
      const m = new Map<string, (typeof rows)[number]>();
      for (const e of rows) m.set(e.id, e);
      return m;
    }),
    // Previous-month records (same-year only) for cumulative carry-forward.
    prevMonth && prevMonth.year === sampleInput!.year
      ? prisma.payrollRecord.findMany({
          where: { year: prevMonth.year, month: prevMonth.month, employeeId: { in: employeeIds } },
        }).then((rows) => {
          const m = new Map<string, (typeof rows)[number]>();
          for (const r of rows) m.set(r.employeeId, r);
          return m;
        })
      : Promise.resolve(new Map<string, never>()),
  ]);

  // Persist all records in a single transaction.
  await prisma.$transaction(async (tx) => {
    for (const { employeeId, input } of body.records) {
      const emp = empMap.get(employeeId);
      if (!emp) continue;

      let prevRecord: PayrollRecord | null = null;
      const prevRow = prevMap.get(employeeId);
      if (prevRow) prevRecord = payrollRecordFromDB(prevRow);

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
        isShenzhenHukou: emp.isShenzhenHukou ?? undefined,
        workCity: emp.workCity ?? undefined,
        noHousingAllowance: emp.noHousingAllowance ?? undefined,
        prevCumulative: (emp.prevCumulative as Employee['prevCumulative']) ?? undefined,
        prevCumulativeYear: emp.prevCumulativeYear ?? undefined,
      };

      const result = calculatePayroll(employee, input, body.config, prevRecord);

      // Upsert the snapshot record (unique on employeeId+year+month).
      const row = await tx.payrollRecord.upsert({
        where: { employeeId_year_month: { employeeId, year: input.year, month: input.month } },
        create: {
          employeeId,
          year: input.year,
          month: input.month,
          employeeName: emp.name,
          entity: emp.entity,
          employmentType: emp.employmentType,
          currency: emp.currency,
          department: emp.department,
          attendanceDays: input.attendanceDays,
          personalLeaveHours: input.personalLeaveHours ?? 0,
          sickLeaveDays: input.sickLeaveDays ?? 0,
          scheduledDays: input.scheduledDays ?? null,
          adjustment: input.adjustment,
          bonus: input.bonus ?? 0,
          housingFundRatio: input.housingFundRatio ?? null,
          specialAdditionalDeduction: input.specialAdditionalDeduction ?? null,
          manualPayable: input.manualPayable ?? null,
          notes: input.notes ?? null,
          manualCumulative: (input.manualCumulative ?? null) as any,
          accruedSalary: result.accruedSalary,
          pensionPersonal: result.pensionPersonal,
          medicalPersonal: result.medicalPersonal,
          unemploymentPersonal: result.unemploymentPersonal,
          housingFundPersonal: result.housingFundPersonal,
          mpfPersonal: result.mpfPersonal,
          pensionCompany: result.pensionCompany,
          medicalCompany: result.medicalCompany,
          unemploymentCompany: result.unemploymentCompany,
          maternityCompany: result.maternityCompany,
          workInjuryCompany: result.workInjuryCompany,
          housingFundCompany: result.housingFundCompany,
          mpfCompany: result.mpfCompany,
          employerCost: result.employerCost,
          taxWithheld: result.taxWithheld,
          cumIncome: result.cumIncome ?? null,
          cumDeduction: result.cumDeduction ?? null,
          cumSpecial: result.cumSpecial ?? null,
          taxableIncome: result.taxableIncome ?? null,
          taxRate: result.taxRate ?? null,
          quickDeduction: result.quickDeduction ?? null,
          cumTaxPayable: result.cumTaxPayable ?? null,
          prevTaxPaid: result.prevTaxPaid ?? null,
          housingAllowance: result.housingAllowance,
          bonus: result.bonus ?? 0,
          payableAmount: result.payableAmount,
          payableHKD: result.payableHKD ?? null,
          payableRMB: result.payableRMB ?? null,
        },
        update: {
          employeeName: emp.name,
          entity: emp.entity,
          employmentType: emp.employmentType,
          currency: emp.currency,
          department: emp.department,
          attendanceDays: input.attendanceDays,
          personalLeaveHours: input.personalLeaveHours ?? 0,
          sickLeaveDays: input.sickLeaveDays ?? 0,
          scheduledDays: input.scheduledDays ?? null,
          adjustment: input.adjustment,
          bonus: input.bonus ?? 0,
          housingFundRatio: input.housingFundRatio ?? null,
          specialAdditionalDeduction: input.specialAdditionalDeduction ?? null,
          manualPayable: input.manualPayable ?? null,
          notes: input.notes ?? null,
          manualCumulative: (input.manualCumulative ?? null) as any,
          accruedSalary: result.accruedSalary,
          pensionPersonal: result.pensionPersonal,
          medicalPersonal: result.medicalPersonal,
          unemploymentPersonal: result.unemploymentPersonal,
          housingFundPersonal: result.housingFundPersonal,
          mpfPersonal: result.mpfPersonal,
          pensionCompany: result.pensionCompany,
          medicalCompany: result.medicalCompany,
          unemploymentCompany: result.unemploymentCompany,
          maternityCompany: result.maternityCompany,
          workInjuryCompany: result.workInjuryCompany,
          housingFundCompany: result.housingFundCompany,
          mpfCompany: result.mpfCompany,
          employerCost: result.employerCost,
          taxWithheld: result.taxWithheld,
          cumIncome: result.cumIncome ?? null,
          cumDeduction: result.cumDeduction ?? null,
          cumSpecial: result.cumSpecial ?? null,
          taxableIncome: result.taxableIncome ?? null,
          taxRate: result.taxRate ?? null,
          quickDeduction: result.quickDeduction ?? null,
          cumTaxPayable: result.cumTaxPayable ?? null,
          prevTaxPaid: result.prevTaxPaid ?? null,
          housingAllowance: result.housingAllowance,
          bonus: result.bonus ?? 0,
          payableAmount: result.payableAmount,
          payableHKD: result.payableHKD ?? null,
          payableRMB: result.payableRMB ?? null,
        },
      });
      saved.push(payrollRecordFromDB(row));
    }
  });

  return json({ saved: saved.length, records: saved });
});
