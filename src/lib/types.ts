// Type definitions for the payroll calculation app

export type Entity = '豪腾灵动' | '豪腾创想' | '境外主体';
export type EmploymentType = '全职' | '实习生' | '外包';
export type Currency = 'RMB' | 'HKD' | 'USD';
export type InternSalaryType = '月薪' | '日薪';
export type EmployeeStatus = '在职' | '离职';

/**
 * Per-city social insurance contribution base configuration.
 * Each city that uses mainland China social insurance rules (五险一金)
 * has its own min/max caps for each insurance type.
 */
export interface CityConfig {
  city: string;            // 城市名称，如 "深圳"、"上海"、"北京"
  pensionBaseMin: number;
  pensionBaseMax: number;
  medicalBaseMin: number;
  medicalBaseMax: number;
  unemploymentBaseMin: number;
  unemploymentBaseMax: number;
  housingFundBaseMin: number;
  housingFundBaseMax: number;
}

export interface Employee {
  id: string;
  name: string;
  idNumber?: string;
  entity: Entity;
  employmentType: EmploymentType;
  currency: Currency;
  department?: string;
  // Work city for social insurance base lookup (e.g. "深圳", "上海").
  // Only applies to mainland China full-time employees (entity !== '外包').
  // Defaults to "深圳" if omitted.
  workCity?: string;
  status: EmployeeStatus;
  baseSalary: number;
  dailyRate?: number; // for daily interns
  internSalaryType?: InternSalaryType; // for interns
  housingFundBase?: number; // override for housing fund base (defaults to baseSalary)
  socialBase?: number; // override for social insurance base (defaults to baseSalary); used for pension/medical/unemployment
  // Monthly individual income tax special additional deduction total.
  // This is the sum of the 6 categories below. Set automatically from breakdown.
  monthlySpecialAdditionalDeduction?: number;
  // Individual income tax special additional deductions (breakdown):
  taxChildEducation?: number;       // 子女教育: 0/1000/2000/3000/4000/6000
  taxContinuingEducation?: number;  // 继续教育: free input
  taxHousingLoanInterest?: number;  // 住房贷款利息: 0/1000
  taxHousingRent?: number;          // 住房租金: 1500/1100/800/0
  taxElderlySupport?: number;       // 赡养老人: free input
  taxInfantCare?: number;           // 婴幼儿照护: 0/1000/2000/3000/4000/6000
  defaultHousingFundRatio: number; // 0.05 - 0.12 (personal portion)
  // Whether the employee holds a Shenzhen hukou — affects the company-side
  // pension rate (深户 17% vs 非深户 16%).
  isShenzhenHukou?: boolean;
  joinDate?: string;
  leaveDate?: string;
  notes?: string;
  // When true, this employee is not eligible for the housing allowance (housingAllowance = 0)
  noHousingAllowance?: boolean;
  // Cumulative tax data as of end of previous period (for Shenzhen full-time employees)
  prevCumulative?: {
    cumIncome: number;
    cumDeduction: number;
    cumSpecial: number;
    cumSpecialAdditional: number;
    taxPaid: number;
  };
  // The year that `prevCumulative` represents. If set and does not match the
  // current calculation year, the cumulative is reset to 0 (year boundary).
  prevCumulativeYear?: number;
}

export interface PayrollInput {
  employeeId: string;
  year: number;
  month: number;
  scheduledDays: number; // 应出勤天数（该月标准工作日数）
  attendanceDays: number; // 计薪出勤天数
  personalLeaveHours: number; // 事假小时数（每 1 小时事假扣减 1/8/应出勤天数*Base）
  sickLeaveDays: number; // 医疗期病假天数（每 1 天扣减 1/应出勤天数*Base + 1/应出勤天数*当地最低工资*80%）
  adjustment: number; // 调整项
  bonus?: number; // 奖金（本月额外收入，影响个税应税收入额）
  housingFundRatio?: number; // override for this month (0.05 - 0.12)
  specialAdditionalDeduction?: number; // 专项附加扣除 (children education, etc.)
  // For outsourcing - manual input
  manualPayable?: number;
  notes?: string;
  // Manual override for cumulative tax values (SZ full-time only).
  // When set, this takes precedence over both prevRecord and employee.prevCumulative.
  // Useful for new joiners mid-year or correcting calculation errors.
  manualCumulative?: CumulativeTax;
}

export interface CumulativeTax {
  cumIncome: number;          // 累计收入额
  cumDeduction: number;        // 累计减除费用
  cumSpecial: number;          // 累计专项扣除
  cumSpecialAdditional: number; // 累计专项附加扣除
  taxPaid: number;             // 累计已缴税额
}

export interface PayrollResult {
  employeeId: string;
  employeeName: string;
  entity: Entity;
  employmentType: EmploymentType;
  currency: Currency;
  // Accrued salary
  accruedSalary: number;
  // Deductions (Shenzhen)
  pensionPersonal: number;
  medicalPersonal: number;
  unemploymentPersonal: number;
  housingFundPersonal: number;
  // MPF (Hong Kong)
  mpfPersonal: number;
  // --- Company-side social insurance / MPF (employer portion) ---
  pensionCompany: number;       // 养老（公司）深户17%/非深户16%
  medicalCompany: number;       // 医疗（公司）一档6%
  unemploymentCompany: number;  // 失业（公司）0.8%
  maternityCompany: number;     // 生育（公司）0.5%
  workInjuryCompany: number;    // 工伤（公司）0.2%
  housingFundCompany: number;   // 公积金（公司）固定5%
  mpfCompany: number;           // MPF（公司，香港）5% 1500封顶
  // Total employer cost = accruedSalary + all company-side contributions.
  employerCost: number;
  // Tax
  taxWithheld: number;
  // Cumulative tax details (Shenzhen full-time)
  cumIncome?: number;
  cumDeduction?: number;
  cumSpecial?: number;
  taxableIncome?: number;
  taxRate?: number;
  quickDeduction?: number;
  cumTaxPayable?: number;
  prevTaxPaid?: number;
  // Housing allowance
  housingAllowance: number;
  // Bonus (本月奖金) — affects taxable income
  bonus?: number;
  // Adjustment
  adjustment: number;
  // Final
  payableAmount: number;
  payableHKD?: number;
  // For HKD-paid Shenzhen employees: the RMB equivalent of payableAmount,
  // so the payslip can show both the HKD payout and its RMB basis.
  payableRMB?: number;
  // Leave deductions (RMB)
  personalLeaveDeduction?: number;
  sickLeaveDeduction?: number;
  leaveDeductionTotal?: number;
  // UI: attendance > scheduled, display a red warning
  overAttend?: boolean;
  // Echo of scheduledDays used in this calc (UI tooltip)
  scheduledDays?: number;
}

export interface PayPeriodConfig {
  year: number;
  month: number;
  szWorkingDays: number; // Shenzhen standard working days (default 21.75)
  hkWorkingDays: number; // Hong Kong standard days (default 30)
  housingAllowance: number; // Housing allowance (default 2000)
  exchangeRate: number; // RMB to HKD exchange rate
  // Shenzhen social insurance / housing fund contribution base caps (kept for backward compat).
  // Employee base salary is clamped between [min, max] before applying rates.
  // Defaults are the official 2026 Shenzhen numbers.
  szPensionBaseMin: number;       // 养老保险缴费基数下限
  szPensionBaseMax: number;       // 养老保险缴费基数上限
  szMedicalBaseMin: number;       // 医疗保险缴费基数下限
  szMedicalBaseMax: number;       // 医疗保险缴费基数上限
  szUnemploymentBaseMin: number;  // 失业保险缴费基数下限
  szUnemploymentBaseMax: number;  // 失业保险缴费基数上限
  szHousingFundBaseMin: number;   // 住房公积金缴费基数下限
  szHousingFundBaseMax: number;   // 住房公积金缴费基数上限
  // Multi-city social insurance base configuration.
  // When an employee has a workCity, the matching entry is used instead of the
  // legacy sz* fields. The "深圳" entry mirrors the sz* fields above.
  citySocialConfigs?: CityConfig[];
  // Local minimum wage by city (RMB). Used for sick-leave pay calculation.
  // Defaults: 深圳 2520/月 (23.7/h), 北京 2540/月 (27.7/h).
  minimumWageByCity?: Record<string, { monthly: number; hourly: number }>;
}

export interface PayrollRecord extends PayrollInput, PayrollResult {
  id: string;
  createdAt: string;
  updatedAt: string;
}
