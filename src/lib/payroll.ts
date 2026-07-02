// Payroll calculation engine
// Implements calculation logic for all employee types:
// - 豪腾灵动 (Hortor Lingdong) full-time employees (RMB)
// - 豪腾创想 (Hortor Chuangxiang) full-time employees (RMB)
// - 境外主体 (Overseas Entity) full-time employees (HKD)
// - 实习生 (Interns) - monthly and daily
// - 外包 (Outsourcing)

import type {
  Employee,
  PayrollInput,
  PayrollRecord,
  PayrollResult,
  PayPeriodConfig,
  CityConfig,
} from './types';
import type { Currency } from './types';

// Default pay period config
export const DEFAULT_CONFIG: PayPeriodConfig = {
  year: 2026,
  month: 6,
  szWorkingDays: 21.75,
  hkWorkingDays: 30,
  housingAllowance: 2000,
  exchangeRate: 1.07,
  // 2026 深圳社保 / 公积金缴费基数上下限（来自广东人社厅、深圳医保局官方公告）
  szPensionBaseMin: 4775,
  szPensionBaseMax: 27549,
  szMedicalBaseMin: 6727,
  szMedicalBaseMax: 33633,
  szUnemploymentBaseMin: 2520,
  szUnemploymentBaseMax: 44265,
  szHousingFundBaseMin: 4775,
  szHousingFundBaseMax: 27549,
  // Default city social configs — mirrors the sz* fields above for 深圳, adds 北京.
  citySocialConfigs: [
    {
      city: '深圳',
      pensionBaseMin: 4775, pensionBaseMax: 27549,
      medicalBaseMin: 6727, medicalBaseMax: 33633,
      unemploymentBaseMin: 2520, unemploymentBaseMax: 44265,
      housingFundBaseMin: 4775, housingFundBaseMax: 27549,
    },
    {
      city: '北京',
      // Beijing uses a unified base across pension/medical/unemployment.
      pensionBaseMin: 7162, pensionBaseMax: 35811,
      medicalBaseMin: 7162, medicalBaseMax: 35811,
      unemploymentBaseMin: 7162, unemploymentBaseMax: 35811,
      housingFundBaseMin: 2540, housingFundBaseMax: 35811,
    },
  ],
  // Local minimum wage by city. Defaults per user's spec:
  //   深圳 2520/月 (23.7/h)
  //   北京 2540/月 (27.7/h)
  minimumWageByCity: {
    '深圳': { monthly: 2520, hourly: 23.7 },
    '北京': { monthly: 2540, hourly: 27.7 },
  },
};

/**
 * 2026 China statutory standard working days by month (predefined for the year).
 * Source: 2026 国务院办公厅放假通知 + 调休安排.
 * - 1月 21天, 2月 16天, 3月 22天, 4月 21天, 5月 19天, 6月 21天
 * - 7月 23天, 8月 21天, 9月 22天, 10月 18天, 11月 21天, 12月 23天
 */
export const SCHEDULED_DAYS_2026: Record<number, number> = {
  1: 21, 2: 16, 3: 22, 4: 21, 5: 19, 6: 21,
  7: 23, 8: 21, 9: 22, 10: 18, 11: 21, 12: 23,
};

export function getScheduledDays(year: number, month: number): number {
  if (year === 2026) {
    return SCHEDULED_DAYS_2026[month] ?? 21.75;
  }
  return 21.75; // fallback for non-2026 years
}

// Individual income tax brackets (cumulative withholding method)
// Based on PRC Individual Income Tax Law
const TAX_BRACKETS = [
  { maxIncome: 36000, rate: 0.03, quickDeduction: 0 },
  { maxIncome: 144000, rate: 0.10, quickDeduction: 2520 },
  { maxIncome: 300000, rate: 0.20, quickDeduction: 16920 },
  { maxIncome: 420000, rate: 0.25, quickDeduction: 31920 },
  { maxIncome: 660000, rate: 0.30, quickDeduction: 52920 },
  { maxIncome: 960000, rate: 0.35, quickDeduction: 85920 },
  { maxIncome: Infinity, rate: 0.45, quickDeduction: 181920 },
];

// Labor service remuneration tax brackets (for interns)
const LABOR_TAX_BRACKETS = [
  { maxIncome: 20000, rate: 0.20, quickDeduction: 0 },
  { maxIncome: 50000, rate: 0.30, quickDeduction: 2000 },
  { maxIncome: Infinity, rate: 0.40, quickDeduction: 7000 },
];

// Shenzhen social insurance rates (personal portion)
export const SZ_SOCIAL_INSURANCE_RATES = {
  pension: 0.08, // 养老保险 8%
  medical: 0.02, // 医疗保险 2%
  unemployment: 0.002, // 失业保险 0.2%
};

// Shenzhen social insurance rates (company / employer portion) — 2026 policy.
// Pension differs by hukou: 深户 17%, 非深户 16%.
export const SZ_COMPANY_RATES = {
  pensionHukou: 0.17,       // 养老（深户）
  pensionNonHukou: 0.16,    // 养老（非深户）
  medical: 0.06,            // 医疗（一档）
  maternity: 0.005,         // 生育 0.5%
  unemployment: 0.008,      // 失业 0.8%
  workInjury: 0.002,        // 工伤 0.2%（基准费率）
  housingFund: 0.05,        // 公积金（公司固定 5%）
};

// MPF rate (Hong Kong)
export const MPF_RATE = 0.05;
export const MPF_CAP = 1500; // 1500 HKD cap

// Beijing social insurance rates (personal + company) — 2026 policy.
// Beijing pension: 单位16% / 个人8%.
// Beijing unemployment: 单位0.5% / 个人0.5%.
// Beijing maternity: 单位0.8% (no personal portion).
// Beijing medical: 单位9% / 个人 (2%*社保基数 + 3).
// Beijing work-injury: 公司侧比率基准（暂使用 0.2% 近似，与行业一致）。
export const BJ_PERSONAL_RATES = {
  pension: 0.08,           // 养老 8%
  medicalBase: 0.02,       // 医疗 2%（base 部分）
  medicalFixed: 3,         // 医疗 固定 3 元
  unemployment: 0.005,     // 失业 0.5%
};
export const BJ_COMPANY_RATES = {
  pension: 0.16,           // 养老 16%
  medical: 0.09,           // 医疗 9%
  unemployment: 0.005,     // 失业 0.5%
  maternity: 0.008,        // 生育 0.8%
  workInjury: 0.002,       // 工伤 0.2%
  housingFund: 0.05,       // 公积金（公司固定 5%）
};

// Beijing base caps (2026, official)
export const BJ_BASE_LIMITS = {
  min: 7162,
  max: 35811,
};
export const BJ_HOUSING_FUND_LIMITS = {
  min: 2540,
  max: 35811,
};

// Monthly deduction threshold (5000 RMB/month)
export const MONTHLY_DEDUCTION = 5000;

/**
 * Find tax bracket based on taxable income
 */
function findTaxBracket(taxableIncome: number) {
  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= bracket.maxIncome) {
      return bracket;
    }
  }
  return TAX_BRACKETS[TAX_BRACKETS.length - 1];
}

/**
 * Find labor service tax bracket
 */
function findLaborTaxBracket(taxableIncome: number) {
  for (const bracket of LABOR_TAX_BRACKETS) {
    if (taxableIncome <= bracket.maxIncome) {
      return bracket;
    }
  }
  return LABOR_TAX_BRACKETS[LABOR_TAX_BRACKETS.length - 1];
}

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compute the cumulative-tax baseline for an employee who joined mid-year and
 * has no prior saved record for the current year.
 *
 * Per PRC IIT cumulative-withholding rules, a new hire's cumulative deduction
 * (5000/month), cumulative income, and cumulative special deductions start
 * accumulating from the join month. Since we don't have historical income/
 * special-deduction data without saved records, we can only reconstruct the
 * cumulative DEDUCTION (减除费用) from the join month through last month.
 * Income / special deductions default to 0 — the user should use the
 * manualCumulative override if they need to seed those for a mid-year hire.
 *
 * Returns the baseline representing "end of last month".
 */
function computeJoinDateBaseline(
  employee: Employee,
  input: PayrollInput
): { cumIncome: number; cumDeduction: number; cumSpecial: number; cumSpecialAdditional: number; taxPaid: number } {
  // Default: fresh start (no join date, or joined before the calculation year).
  let cumDeduction = 0;

  if (employee.joinDate) {
    const join = new Date(employee.joinDate);
    if (!isNaN(join.getTime()) && join.getFullYear() === input.year) {
      // Joined this year. Count months from join month through (current month - 1).
      const joinMonth = join.getMonth() + 1; // 1-based
      const prevMonth = input.month - 1; // months before the current one
      if (prevMonth >= joinMonth) {
        cumDeduction = (prevMonth - joinMonth + 1) * MONTHLY_DEDUCTION;
      }
    }
  }

  return {
    cumIncome: 0,
    cumDeduction,
    cumSpecial: 0,
    cumSpecialAdditional: 0,
    taxPaid: 0,
  };
}

/**
 * Clamp a contribution base between min and max (Shenzhen social insurance caps).
 * If min/max are missing/0, the value is returned as-is (back-compat with old configs).
 */
function clampBase(value: number, min: number | undefined, max: number | undefined): number {
  const lo = min && min > 0 ? min : -Infinity;
  const hi = max && max > 0 ? max : Infinity;
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Resolve social insurance base caps for an employee.
 *
 * Priority:
 *  1. If the employee has a `workCity` AND `config.citySocialConfigs` contains a
 *     matching entry → use that city's caps.
 *  2. Otherwise fall back to the legacy `sz*` fields on `config` (backward compat).
 */
function resolveCityConfig(
  employee: Employee,
  config: PayPeriodConfig
): {
  pensionBaseMin: number; pensionBaseMax: number;
  medicalBaseMin: number; medicalBaseMax: number;
  unemploymentBaseMin: number; unemploymentBaseMax: number;
  housingFundBaseMin: number; housingFundBaseMax: number;
} {
  const city = employee.workCity?.trim();
  if (city && config.citySocialConfigs) {
    const found = config.citySocialConfigs.find((c) => c.city === city);
    if (found) return found;
  }
  // Fallback: use the legacy sz* fields
  return {
    pensionBaseMin: config.szPensionBaseMin,
    pensionBaseMax: config.szPensionBaseMax,
    medicalBaseMin: config.szMedicalBaseMin,
    medicalBaseMax: config.szMedicalBaseMax,
    unemploymentBaseMin: config.szUnemploymentBaseMin,
    unemploymentBaseMax: config.szUnemploymentBaseMax,
    housingFundBaseMin: config.szHousingFundBaseMin,
    housingFundBaseMax: config.szHousingFundBaseMax,
  };
}

/**
 * Convert an amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  exchangeRate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  const factor = fromCurrency === 'RMB' ? exchangeRate : 1 / exchangeRate;
  return round2(amount * factor);
}

/**
 * Get previous month for a given year/month
 */
export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/**
 * Calculate Shenzhen full-time employee payroll
 *
 * All Shenzhen employees are computed in RMB (social insurance, housing fund,
 * IIT — everything). The `employee.currency` field only affects the FINAL
 * payable amount: if the employee is paid in HKD, the RMB payable is converted
 * to HKD at the end. This keeps the tax/social-insurance base correct
 * regardless of payout currency.
 *
 * Logic:
 * 1. Accrued salary (RMB) = base / scheduledDays × attendanceDays
 *    scheduledDays: from input.scheduledDays (user-input per-month standard days)
 *    attendanceDays: actual working days (user input)
 * 2. Social insurance (RMB, personal + company) on clamped bases
 * 3. Housing fund (RMB) personal = base × ratio, company = base × 5%
 * 4. Tax (RMB, cumulative withholding)
 * 5. Housing allowance = housingAllowance (2000 for eligible employees)
 * 6. payableRMB = accrued + adjustment - personal SI - housing fund - tax + housing
 *    payableAmount = currency === 'HKD' ? payableRMB × exchangeRate : payableRMB
 */
function calculateShenzhenFullTime(
  employee: Employee,
  input: PayrollInput,
  config: PayPeriodConfig,
  prevRecord?: PayrollRecord | null
): PayrollResult {
  const base = employee.baseSalary; // ALWAYS RMB for Shenzhen employees
  const currency = employee.currency;
  const exchangeRate = config.exchangeRate;
  const payoutFactor = currency === 'RMB' ? 1 : exchangeRate;

  // 1. Accrued salary (RMB): Base ÷ 应出勤天数 × 实际出勤天数
  // Use input.scheduledDays (per-month standard days) for the denominator.
  // Fall back to config.szWorkingDays for backward compat.
  // (2) Cap at Base when attendanceDays > scheduledDays, and flag `overAttend`.
  const scheduledDays = (input.scheduledDays && input.scheduledDays > 0)
    ? input.scheduledDays
    : config.szWorkingDays;
  const overAttend = input.attendanceDays > scheduledDays;
  const effectiveAttendanceDays = overAttend ? scheduledDays : input.attendanceDays;
  const rawAccrued = (base / scheduledDays) * input.attendanceDays;
  const accruedSalaryRMB = round2(Math.min(base, rawAccrued));

  // 2. Social insurance — all in RMB (base is already RMB)
  const socialBaseRMB = employee.socialBase !== undefined ? employee.socialBase : base;
  const housingFundBaseRMB = employee.housingFundBase !== undefined ? employee.housingFundBase : base;
  const housingFundRatio = input.housingFundRatio ?? employee.defaultHousingFundRatio;

  // 1a. Apply leave deductions to accrued salary.
  //   - personalLeaveHours (事假, 小时): each hour deducts (1/8) / scheduledDays * base
  //   - sickLeaveDays (医疗期病假, 天): each day deducts
  //       (1 / scheduledDays) * base
  //     + (1 / scheduledDays) * localMinimumWageMonthly * 80%
  // Local minimum wage is looked up from config.minimumWageByCity (北京: 2540/月, default fallback 深圳: 2520/月).
  const personalLeaveDeduction = round2(
    ((input.personalLeaveHours ?? 0) / 8) / scheduledDays * base
  );
  const localMinWage = (config.minimumWageByCity?.[employee.workCity ?? '深圳']?.monthly)
    ?? 2520;
  const sickLeaveDeduction = round2(
    ((input.sickLeaveDays ?? 0) / scheduledDays) * base
    + ((input.sickLeaveDays ?? 0) / scheduledDays) * localMinWage * 0.8
  );
  const leaveDeductionTotal = personalLeaveDeduction + sickLeaveDeduction;
  const accruedSalaryAfterLeave = Math.max(0, accruedSalaryRMB - leaveDeductionTotal);

  // Resolve city-specific social insurance caps
  const cityConfig = resolveCityConfig(employee, config);
  const isBeijing = employee.workCity?.trim() === '北京';

  const pensionBaseRMB = clampBase(socialBaseRMB, cityConfig.pensionBaseMin, cityConfig.pensionBaseMax);
  const medicalBaseRMB = clampBase(socialBaseRMB, cityConfig.medicalBaseMin, cityConfig.medicalBaseMax);
  const unemploymentBaseRMB = clampBase(socialBaseRMB, cityConfig.unemploymentBaseMin, cityConfig.unemploymentBaseMax);
  const housingFundBaseRMBClamped = clampBase(housingFundBaseRMB, cityConfig.housingFundBaseMin, cityConfig.housingFundBaseMax);

  // Personal SI — Beijing uses different rates
  let pensionPersonalRMB: number;
  let medicalPersonalRMB: number;
  let unemploymentPersonalRMB: number;
  if (isBeijing) {
    pensionPersonalRMB = round2(pensionBaseRMB * BJ_PERSONAL_RATES.pension);
    medicalPersonalRMB = round2(medicalBaseRMB * BJ_PERSONAL_RATES.medicalBase + BJ_PERSONAL_RATES.medicalFixed);
    unemploymentPersonalRMB = round2(unemploymentBaseRMB * BJ_PERSONAL_RATES.unemployment);
  } else {
    pensionPersonalRMB = round2(pensionBaseRMB * SZ_SOCIAL_INSURANCE_RATES.pension);
    medicalPersonalRMB = round2(medicalBaseRMB * SZ_SOCIAL_INSURANCE_RATES.medical);
    unemploymentPersonalRMB = round2(unemploymentBaseRMB * SZ_SOCIAL_INSURANCE_RATES.unemployment);
  }
  const housingFundPersonalRMB = round2(housingFundBaseRMBClamped * housingFundRatio);

  // Personal SI is in RMB (Shenzhen policy currency). We keep it in RMB for
  // tax calculation; the final payable is converted to payout currency later.
  const pensionPersonal = pensionPersonalRMB;
  const medicalPersonal = medicalPersonalRMB;
  const unemploymentPersonal = unemploymentPersonalRMB;
  const housingFundPersonal = housingFundPersonalRMB;
  const monthlySpecialDeduction = pensionPersonal + medicalPersonal + unemploymentPersonal + housingFundPersonal;

  // 2b. Company-side social insurance + housing fund (employer portion).
  // Beijing: 养老16%, 医疗9%, 失业0.5%, 生育0.8%, 工伤0.2% (基准).
  // Shenzhen: 养老16/17 (hukou), 医疗6%, 生育0.5%, 失业0.8%, 工伤0.2%.
  // Housing fund company: 5% for both cities (carried from SZ policy).
  const pensionCompanyRate = isBeijing
    ? BJ_COMPANY_RATES.pension
    : (employee.isShenzhenHukou ? SZ_COMPANY_RATES.pensionHukou : SZ_COMPANY_RATES.pensionNonHukou);
  const medicalCompanyRate = isBeijing ? BJ_COMPANY_RATES.medical : SZ_COMPANY_RATES.medical;
  const maternityCompanyRate = isBeijing ? BJ_COMPANY_RATES.maternity : SZ_COMPANY_RATES.maternity;
  const unemploymentCompanyRate = isBeijing ? BJ_COMPANY_RATES.unemployment : SZ_COMPANY_RATES.unemployment;
  const workInjuryCompanyRate = isBeijing ? BJ_COMPANY_RATES.workInjury : SZ_COMPANY_RATES.workInjury;
  const housingFundCompanyRate = isBeijing ? BJ_COMPANY_RATES.housingFund : SZ_COMPANY_RATES.housingFund;

  const pensionCompanyRMB = round2(pensionBaseRMB * pensionCompanyRate);
  const medicalCompanyRMB = round2(medicalBaseRMB * medicalCompanyRate);
  const maternityCompanyRMB = round2(medicalBaseRMB * maternityCompanyRate); // 生育基数同医疗
  const unemploymentCompanyRMB = round2(unemploymentBaseRMB * unemploymentCompanyRate);
  const workInjuryCompanyRMB = round2(socialBaseRMB * workInjuryCompanyRate);
  const housingFundCompanyRMB = round2(housingFundBaseRMBClamped * housingFundCompanyRate);

  // Company-side SI in RMB (stays RMB — employer cost is tracked in RMB).
  const pensionCompany = pensionCompanyRMB;
  const medicalCompany = medicalCompanyRMB;
  const maternityCompany = maternityCompanyRMB;
  const unemploymentCompany = unemploymentCompanyRMB;
  const workInjuryCompany = workInjuryCompanyRMB;
  const housingFundCompany = housingFundCompanyRMB;

  // 3. Housing allowance (4.) declared FIRST so tax (3.) can include it.
  // 房补属于应税收入, 计入累计预扣应税收入额.
  // 外包员工一律不发放房补.
  const housingAllowance = (employee.noHousingAllowance || employee.employmentType === '外包')
    ? 0
    : config.housingAllowance;

  // 3. Tax calculation (cumulative withholding) — applied in employee.currency
  // Priority: manualCumulative (user override) > prevRecord (auto carry from saved record)
  //           > employee.prevCumulative (year-start baseline, if year matches)
  //           > reset to 0 (year boundary or new employee)
  const basePrevCum = input.manualCumulative
    ? {
        cumIncome: input.manualCumulative.cumIncome,
        cumDeduction: input.manualCumulative.cumDeduction,
        cumSpecial: input.manualCumulative.cumSpecial,
        cumSpecialAdditional: input.manualCumulative.cumSpecialAdditional,
        taxPaid: input.manualCumulative.taxPaid,
      }
    : prevRecord
      ? {
          cumIncome: prevRecord.cumIncome ?? 0,
          cumDeduction: prevRecord.cumDeduction ?? 0,
          cumSpecial: prevRecord.cumSpecial ?? 0,
          cumSpecialAdditional: prevRecord.cumSpecialAdditional ?? 0,
          taxPaid: prevRecord.cumTaxPayable ?? 0,
        }
      : (employee.prevCumulative &&
         (!employee.prevCumulativeYear || employee.prevCumulativeYear === input.year)
          ? employee.prevCumulative
          : computeJoinDateBaseline(employee, input));

  // 应税收入额 = 应计薪资 + 调整项 + 房补 + 奖金
  // 应税收入额 = 应计薪资(扣完事假/病假后) + 调整项 + 房补 + 奖金
  const monthlyIncome = accruedSalaryAfterLeave + input.adjustment + housingAllowance + (input.bonus ?? 0);

  const cumIncome = basePrevCum.cumIncome + monthlyIncome;
  const cumDeduction = basePrevCum.cumDeduction + MONTHLY_DEDUCTION;
  const cumSpecial = basePrevCum.cumSpecial + monthlySpecialDeduction;
  // Sum of 6 individual tax deduction categories, or legacy single field
  const breakdownSum =
    (employee.taxChildEducation ?? 0) +
    (employee.taxContinuingEducation ?? 0) +
    (employee.taxHousingLoanInterest ?? 0) +
    (employee.taxHousingRent ?? 0) +
    (employee.taxElderlySupport ?? 0) +
    (employee.taxInfantCare ?? 0);
  const monthlySpecialAdditional =
    input.specialAdditionalDeduction ??
    (breakdownSum > 0 ? breakdownSum : employee.monthlySpecialAdditionalDeduction) ??
    0;
  const cumSpecialAdditional = basePrevCum.cumSpecialAdditional + monthlySpecialAdditional;

  const taxableIncome = Math.max(
    0,
    cumIncome - cumDeduction - cumSpecial - cumSpecialAdditional
  );

  const bracket = findTaxBracket(taxableIncome);
  const cumTaxPayable = round2(
    taxableIncome * bracket.rate - bracket.quickDeduction
  );
  const taxWithheld = round2(Math.max(0, cumTaxPayable - basePrevCum.taxPaid));

  // 5. Payable in RMB first, then convert to payout currency.
  const payableRMB = round2(
    accruedSalaryAfterLeave +
      input.adjustment +
      (input.bonus ?? 0) -
      pensionPersonal -
      medicalPersonal -
      unemploymentPersonal -
      housingFundPersonal -
      taxWithheld +
      housingAllowance
  );
  // accruedSalary is the value shown in the table; we keep the post-leave value
  // (otherwise the table would show a number larger than payable + SI + tax).
  const accruedSalary = accruedSalaryAfterLeave;
  const payableAmount = round2(payableRMB * payoutFactor);

  // Employer cost = accrued salary + all company-side contributions.
  const employerCost = round2(
    accruedSalary +
      pensionCompany + medicalCompany + maternityCompany +
      unemploymentCompany + workInjuryCompany + housingFundCompany
  );

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    entity: employee.entity,
    employmentType: employee.employmentType,
    currency: currency, // use payment currency
    accruedSalary,
    pensionPersonal,
    medicalPersonal,
    unemploymentPersonal,
    housingFundPersonal,
    mpfPersonal: 0,
    // Company-side
    pensionCompany,
    medicalCompany,
    unemploymentCompany,
    maternityCompany,
    workInjuryCompany,
    housingFundCompany,
    mpfCompany: 0,
    employerCost,
    taxWithheld,
    cumIncome: round2(cumIncome),
    cumDeduction: round2(cumDeduction),
    cumSpecial: round2(cumSpecial),
    taxableIncome: round2(taxableIncome),
    taxRate: bracket.rate,
    quickDeduction: bracket.quickDeduction,
    cumTaxPayable,
    prevTaxPaid: basePrevCum.taxPaid,
    housingAllowance,
    bonus: input.bonus ?? 0,
    adjustment: input.adjustment,
    payableAmount,
    // Leave deductions + over-attendance flag (UI red text + tooltip)
    personalLeaveDeduction,
    sickLeaveDeduction,
    leaveDeductionTotal,
    overAttend,
    scheduledDays,
  };
}

/**
 * Calculate Hong Kong full-time employee payroll
 *
 * Money unit follows `employee.currency` (the actual payment currency):
 * - HKD: standard, base/MPF/meal all in HKD, MPF cap = 1500 HKD
 * - RMB: HK logic (MPF) but in RMB; MPF cap converted to RMB ≈ 1401.87 RMB
 *
 * Logic:
 * 1. Accrued salary = base / hkWorkingDays × payableDays
 *    - payableDays = hkWorkingDays - personalLeaveDays × 0.5 (personal leave = half pay)
 * 2. MPF deduction = min(base × 5%, MPF cap in employee.currency)
 * 3. Housing allowance: flat 2000 for eligible employees
 * 4. Payable = accruedSalary - MPF + housingAllowance + adjustment
 */
function calculateHongKongFullTime(
  employee: Employee,
  input: PayrollInput,
  config: PayPeriodConfig
): PayrollResult {
  const base = employee.baseSalary;
  const currency = employee.currency;
  const exchangeRate = config.exchangeRate;

  // 1. Accrued salary (in employee.currency). Personal leave is in hours:
  // 1h leave = 1/8 day of pay deducted.
  const personalLeaveDays = (input.personalLeaveHours ?? 0) / 8;
  const payableDays =
    config.hkWorkingDays - personalLeaveDays * 0.5;
  const effectiveDays = Math.min(input.attendanceDays, payableDays);
  const accruedSalary = round2((base / config.hkWorkingDays) * effectiveDays);

  // 2. MPF deduction (cap depends on currency; 1500 HKD ≈ 1401.87 RMB at 1.07)
  const mpfCap = currency === 'HKD' ? MPF_CAP : round2(MPF_CAP / exchangeRate);
  const mpfPersonal = round2(Math.min(base * MPF_RATE, mpfCap));
  // Company MPF: same 5%, same cap (双边缴纳).
  const mpfCompany = round2(Math.min(base * MPF_RATE, mpfCap));

  // 3. Housing allowance: flat 2000 for eligible employees
  // 外包员工一律不发放房补.
  const housingAllowance = (employee.noHousingAllowance || employee.employmentType === '外包')
    ? 0
    : config.housingAllowance;

  // 4. Final payable
  const payableAmount = round2(
    accruedSalary - mpfPersonal + housingAllowance + input.adjustment
  );

  // Employer cost = accrued salary + company MPF.
  const employerCost = round2(accruedSalary + mpfCompany);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    entity: employee.entity,
    employmentType: employee.employmentType,
    currency: currency, // use payment currency
    accruedSalary,
    pensionPersonal: 0,
    medicalPersonal: 0,
    unemploymentPersonal: 0,
    housingFundPersonal: 0,
    mpfPersonal,
    // Company-side (HK: only MPF)
    pensionCompany: 0,
    medicalCompany: 0,
    unemploymentCompany: 0,
    maternityCompany: 0,
    workInjuryCompany: 0,
    housingFundCompany: 0,
    mpfCompany,
    employerCost,
    taxWithheld: 0,
    housingAllowance,
    bonus: input.bonus ?? 0,
    adjustment: input.adjustment,
    payableAmount,
  };
}

/**
 * Calculate intern payroll
 *
 * Money unit follows `employee.currency`. Daily interns are exempt from IIT.
 *
 * For monthly salary interns:
 * - Accrued salary = base / szWorkingDays × attendanceDays
 * - Tax: labor service remuneration
 *   - If income ≤ 4000: deduction = 800
 *   - If income > 4000: deduction = income × 20%
 *   - taxable = (income - deduction) × rate - quickDeduction
 *
 * For daily salary interns:
 * - Accrued salary = dailyRate × attendanceDays
 * - Tax: 0 (daily interns are exempt)
 */
function calculateIntern(
  employee: Employee,
  input: PayrollInput,
  config: PayPeriodConfig
): PayrollResult {
  const isDaily = employee.internSalaryType === '日薪';
  const currency = employee.currency;

  // 1. Accrued salary (in employee.currency)
  let accruedSalary: number;
  if (isDaily) {
    // Accept negative dailyRate as abs (e.g. -200 means 200).
    accruedSalary = round2(Math.abs(employee.dailyRate ?? 0) * input.attendanceDays);
  } else {
    // Intern base — accept negative input as abs (e.g. -200 means 200).
    const base = Math.abs(employee.baseSalary);
    const scheduledDays = (input.scheduledDays && input.scheduledDays > 0)
      ? input.scheduledDays
      : config.szWorkingDays;
    accruedSalary = round2((base / scheduledDays) * input.attendanceDays);
  }

  // 2. Tax (labor service remuneration) — only for monthly interns
  let taxWithheld = 0;
  let taxableIncome = 0;
  let taxRate = 0;
  let quickDeduction = 0;
  if (!isDaily) {
    const income = accruedSalary + input.adjustment;
    let deduction: number;
    if (income <= 4000) {
      deduction = 800;
    } else {
      deduction = income * 0.2;
    }
    taxableIncome = Math.max(0, income - deduction);
    const bracket = findLaborTaxBracket(taxableIncome);
    taxRate = bracket.rate;
    quickDeduction = bracket.quickDeduction;
    taxWithheld = round2(
      taxableIncome * bracket.rate - bracket.quickDeduction
    );
  }

  // 3. Housing allowance: flat 2000 for eligible employees
  // 外包员工一律不发放房补.
  const housingAllowance = (employee.noHousingAllowance || employee.employmentType === '外包')
    ? 0
    : config.housingAllowance;

  // 4. Final payable
  const payableAmount = round2(
    accruedSalary + input.adjustment - taxWithheld + housingAllowance
  );

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    entity: employee.entity,
    employmentType: employee.employmentType,
    currency: currency, // use payment currency
    accruedSalary,
    pensionPersonal: 0,
    medicalPersonal: 0,
    unemploymentPersonal: 0,
    housingFundPersonal: 0,
    mpfPersonal: 0,
    pensionCompany: 0,
    medicalCompany: 0,
    unemploymentCompany: 0,
    maternityCompany: 0,
    workInjuryCompany: 0,
    housingFundCompany: 0,
    mpfCompany: 0,
    employerCost: accruedSalary,
    taxWithheld,
    taxableIncome: round2(taxableIncome),
    taxRate,
    quickDeduction,
    housingAllowance,
    bonus: input.bonus ?? 0,
    adjustment: input.adjustment,
    payableAmount,
  };
}

/**
 * Calculate outsourcing payroll
 * According to contract - manual input, in employee.currency
 */
function calculateOutsourcing(
  employee: Employee,
  input: PayrollInput,
  config: PayPeriodConfig
): PayrollResult {
  // Outsource: if user has not explicitly set manualPayable, fall back to
  // baseSalary (a single monthly payout, no pro-rata — that's the standard
  // outsourcing contract form). Previous behavior was always 0, which made
  // the row look broken.
  const payableAmount = input.manualPayable ?? employee.baseSalary ?? 0;

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    entity: employee.entity,
    employmentType: employee.employmentType,
    currency: employee.currency,
    accruedSalary: payableAmount,
    pensionPersonal: 0,
    medicalPersonal: 0,
    unemploymentPersonal: 0,
    housingFundPersonal: 0,
    mpfPersonal: 0,
    pensionCompany: 0,
    medicalCompany: 0,
    unemploymentCompany: 0,
    maternityCompany: 0,
    workInjuryCompany: 0,
    housingFundCompany: 0,
    mpfCompany: 0,
    employerCost: payableAmount,
    taxWithheld: 0,
    housingAllowance: 0,
    bonus: 0,
    adjustment: 0,
    payableAmount,
  };
}

/**
 * Main calculation dispatcher
 *
 * All calculation functions return amounts in `employee.currency` directly.
 * `entity` determines which deduction logic (SZ social insurance vs HK MPF) applies.
 */
export function calculatePayroll(
  employee: Employee,
  input: PayrollInput,
  config: PayPeriodConfig,
  prevRecord?: PayrollRecord | null
): PayrollResult {
  let result: PayrollResult;

  // Outsourcing
  if (employee.employmentType === '外包') {
    result = calculateOutsourcing(employee, input, config);
  }
  // Interns
  else if (employee.employmentType === '实习生') {
    result = calculateIntern(employee, input, config);
  }
  // Full-time employees — 豪腾灵动 and 豪腾创想 both use mainland SZ rules
  else if (employee.entity === '豪腾灵动' || employee.entity === '豪腾创想') {
    result = calculateShenzhenFullTime(employee, input, config, prevRecord);
  } else if (employee.entity === '境外主体') {
    result = calculateHongKongFullTime(employee, input, config);
  } else {
    // Default: treat as mainland full-time
    result = calculateShenzhenFullTime(employee, input, config, prevRecord);
  }

  // Cross-currency reference values:
  // - RMB-paid employees: show 折算港币 (payableHKD)
  // - HKD-paid mainland employees: show 折算人民币 (payableRMB)
  let payableHKD: number | undefined;
  let payableRMB: number | undefined;
  if (result.currency === 'RMB') {
    payableHKD = round2(result.payableAmount * config.exchangeRate);
  } else if (employee.entity === '豪腾灵动' || employee.entity === '豪腾创想') {
    // HKD-paid mainland employee: payableAmount is HKD; record the RMB basis.
    payableRMB = round2(result.payableAmount / config.exchangeRate);
  }

  return { ...result, payableHKD, payableRMB };
}

/**
 * Calculate payable HKD from RMB
 */
export function convertToHKD(rmbAmount: number, exchangeRate: number): number {
  return round2(rmbAmount * exchangeRate);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'RMB'): string {
  const symbol = currency === 'HKD' ? 'HK$' : '¥';
  return `${symbol}${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format number
 */
export function formatNumber(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
