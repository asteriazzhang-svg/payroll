// Converters between Prisma rows and the frontend TypeScript types.
// The frontend expects the shapes from src/lib/types.ts (optional fields use
// `undefined`, never `null`). Prisma returns `null` for empty columns, so we
// normalize here at the API boundary.

import type { Employee, PayrollInput, PayrollRecord, PayPeriodConfig, CityConfig } from './types';
import type {
  Employee as PrismaEmployee,
  PayrollInput as PrismaPayrollInput,
  PayrollRecord as PrismaPayrollRecord,
  Config as PrismaConfig,
} from '@prisma/client';

/** Drop null -> undefined for optional fields. */
function n<T>(v: T | null): T | undefined {
  return v === null ? undefined : v;
}

export function employeeFromDB(e: PrismaEmployee): Employee {
  return {
    id: e.id,
    name: e.name,
    idNumber: n(e.idNumber),
    entity: e.entity as Employee['entity'],
    employmentType: e.employmentType as Employee['employmentType'],
    currency: e.currency as Employee['currency'],
    department: n(e.department),
    status: e.status as Employee['status'],
    baseSalary: e.baseSalary,
    dailyRate: n(e.dailyRate),
    internSalaryType: n(e.internSalaryType) as Employee['internSalaryType'],
    housingFundBase: n(e.housingFundBase),
    socialBase: n(e.socialBase),
    monthlySpecialAdditionalDeduction: n(e.monthlySpecialAdditionalDeduction),
    taxChildEducation: n(e.taxChildEducation) ?? undefined,
    taxContinuingEducation: n(e.taxContinuingEducation) ?? undefined,
    taxHousingLoanInterest: n(e.taxHousingLoanInterest) ?? undefined,
    taxHousingRent: n(e.taxHousingRent) ?? undefined,
    taxElderlySupport: n(e.taxElderlySupport) ?? undefined,
    taxInfantCare: n(e.taxInfantCare) ?? undefined,
    defaultHousingFundRatio: e.defaultHousingFundRatio,
    isShenzhenHukou: e.isShenzhenHukou ?? undefined,
    joinDate: n(e.joinDate),
    leaveDate: n(e.leaveDate),
    notes: n(e.notes),
    noHousingAllowance: n(e.noHousingAllowance) ?? undefined,
    prevCumulative: n(e.prevCumulative as Employee['prevCumulative'] | null) ?? undefined,
    prevCumulativeYear: n(e.prevCumulativeYear) ?? undefined,
    workCity: n(e.workCity) ?? undefined,
  };
}

export function payrollInputFromDB(p: PrismaPayrollInput): PayrollInput {
  return {
    employeeId: p.employeeId,
    year: p.year,
    month: p.month,
    scheduledDays: p.scheduledDays ?? 21.75,
    attendanceDays: p.attendanceDays,
    personalLeaveHours: p.personalLeaveHours ?? 0,
    sickLeaveDays: p.sickLeaveDays ?? 0,
    adjustment: p.adjustment,
    bonus: p.bonus ?? 0,
    housingFundRatio: n(p.housingFundRatio) ?? undefined,
    specialAdditionalDeduction: n(p.specialAdditionalDeduction) ?? undefined,
    manualPayable: n(p.manualPayable) ?? undefined,
    notes: n(p.notes) ?? undefined,
    manualCumulative: n(p.manualCumulative as PayrollInput['manualCumulative'] | null) ?? undefined,
  };
}

export function payrollRecordFromDB(r: PrismaPayrollRecord): PayrollRecord {
  return {
    id: r.id,
    employeeId: r.employeeId,
    year: r.year,
    month: r.month,
    employeeName: r.employeeName,
    entity: r.entity as PayrollRecord['entity'],
    employmentType: r.employmentType as PayrollRecord['employmentType'],
    currency: r.currency as PayrollRecord['currency'],
    department: n(r.department) ?? undefined,
    // PayrollInput fields
    scheduledDays: r.scheduledDays ?? 21.75,
    attendanceDays: r.attendanceDays,
    personalLeaveHours: r.personalLeaveHours ?? 0,
    sickLeaveDays: r.sickLeaveDays ?? 0,
    adjustment: r.adjustment,
    bonus: r.bonus ?? 0,
    housingFundRatio: n(r.housingFundRatio) ?? undefined,
    specialAdditionalDeduction: n(r.specialAdditionalDeduction) ?? undefined,
    manualPayable: n(r.manualPayable) ?? undefined,
    notes: n(r.notes) ?? undefined,
    manualCumulative: n(r.manualCumulative as PayrollRecord['manualCumulative'] | null) ?? undefined,
    // PayrollResult fields
    accruedSalary: r.accruedSalary,
    pensionPersonal: r.pensionPersonal,
    medicalPersonal: r.medicalPersonal,
    unemploymentPersonal: r.unemploymentPersonal,
    housingFundPersonal: r.housingFundPersonal,
    mpfPersonal: r.mpfPersonal,
    // Company-side
    pensionCompany: r.pensionCompany,
    medicalCompany: r.medicalCompany,
    unemploymentCompany: r.unemploymentCompany,
    maternityCompany: r.maternityCompany,
    workInjuryCompany: r.workInjuryCompany,
    housingFundCompany: r.housingFundCompany,
    mpfCompany: r.mpfCompany,
    employerCost: r.employerCost,
    taxWithheld: r.taxWithheld,
    cumIncome: n(r.cumIncome) ?? undefined,
    cumDeduction: n(r.cumDeduction) ?? undefined,
    cumSpecial: n(r.cumSpecial) ?? undefined,
    taxableIncome: n(r.taxableIncome) ?? undefined,
    taxRate: n(r.taxRate) ?? undefined,
    quickDeduction: n(r.quickDeduction) ?? undefined,
    cumTaxPayable: n(r.cumTaxPayable) ?? undefined,
    prevTaxPaid: n(r.prevTaxPaid) ?? undefined,
    housingAllowance: r.housingAllowance,
    bonus: r.bonus ?? 0,
    adjustment: r.adjustment,
    payableAmount: r.payableAmount,
    payableHKD: n(r.payableHKD) ?? undefined,
    payableRMB: n(r.payableRMB) ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function configFromDB(c: PrismaConfig): PayPeriodConfig {
  let citySocialConfigs: CityConfig[] | undefined;
  try {
    const raw = c.citySocialConfigs;
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) citySocialConfigs = arr as CityConfig[];
  } catch {
    // malformed JSON — leave undefined, engine will fall back to sz* fields
  }
  return {
    year: c.year,
    month: c.month,
    szWorkingDays: c.szWorkingDays,
    hkWorkingDays: c.hkWorkingDays,
    housingAllowance: c.housingAllowance,
    exchangeRate: c.exchangeRate,
    szPensionBaseMin: c.szPensionBaseMin,
    szPensionBaseMax: c.szPensionBaseMax,
    szMedicalBaseMin: c.szMedicalBaseMin,
    szMedicalBaseMax: c.szMedicalBaseMax,
    szUnemploymentBaseMin: c.szUnemploymentBaseMin,
    szUnemploymentBaseMax: c.szUnemploymentBaseMax,
    szHousingFundBaseMin: c.szHousingFundBaseMin,
    szHousingFundBaseMax: c.szHousingFundBaseMax,
    citySocialConfigs,
    // minimumWageByCity lives in the same JSON column (parsed below).
    minimumWageByCity: (() => {
      try {
        const raw = (c as any).minimumWageByCity;
        if (raw == null) return undefined;
        const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return v && typeof v === 'object' ? v : undefined;
      } catch {
        return undefined;
      }
    })(),
  };
}
