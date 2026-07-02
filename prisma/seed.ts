// Prisma seed script.
// Run with: `npx prisma db seed` (configured in package.json).
//
// Idempotent: safe to run multiple times. Seeds:
//   - one admin account (admin / admin)
//   - all SEED_EMPLOYEES (only those not already present, matched by name+entity)
//   - a singleton Config row

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SEED_EMPLOYEES } from '../src/lib/seed-data';
import { DEFAULT_CONFIG } from '../src/lib/payroll';

const prisma = new PrismaClient();

async function main() {
  // 1. Config singleton
  await prisma.config.upsert({
    where: { id: 'singleton' },
    update: {
      citySocialConfigs: JSON.stringify(DEFAULT_CONFIG.citySocialConfigs ?? []),
      minimumWageByCity: JSON.stringify(DEFAULT_CONFIG.minimumWageByCity ?? {}),
    },
    create: {
      id: 'singleton',
      year: DEFAULT_CONFIG.year,
      month: DEFAULT_CONFIG.month,
      szWorkingDays: DEFAULT_CONFIG.szWorkingDays,
      hkWorkingDays: DEFAULT_CONFIG.hkWorkingDays,
      housingAllowance: DEFAULT_CONFIG.housingAllowance,
      exchangeRate: DEFAULT_CONFIG.exchangeRate,
      szPensionBaseMin: DEFAULT_CONFIG.szPensionBaseMin,
      szPensionBaseMax: DEFAULT_CONFIG.szPensionBaseMax,
      szMedicalBaseMin: DEFAULT_CONFIG.szMedicalBaseMin,
      szMedicalBaseMax: DEFAULT_CONFIG.szMedicalBaseMax,
      szUnemploymentBaseMin: DEFAULT_CONFIG.szUnemploymentBaseMin,
      szUnemploymentBaseMax: DEFAULT_CONFIG.szUnemploymentBaseMax,
      szHousingFundBaseMin: DEFAULT_CONFIG.szHousingFundBaseMin,
      szHousingFundBaseMax: DEFAULT_CONFIG.szHousingFundBaseMax,
      citySocialConfigs: JSON.stringify(DEFAULT_CONFIG.citySocialConfigs ?? []),
      minimumWageByCity: JSON.stringify(DEFAULT_CONFIG.minimumWageByCity ?? {}),
    },
  });
  console.log('✓ Config singleton');

  // 2. Admin account (idempotent: only create if missing)
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        role: 'ADMIN',
        active: true,
        mustChangePwd: false,
      },
    });
    console.log('✓ Admin account created (admin / admin)');
  } else {
    console.log('✓ Admin account already exists, skipped');
  }

  // 3. Employees (idempotent by name+entity)
  let created = 0;
  let skipped = 0;
  const employeeNameIdMap = new Map<string, string>();
  for (const emp of SEED_EMPLOYEES) {
    const exists = await prisma.employee.findFirst({
      where: { name: emp.name, entity: emp.entity },
    });
    if (exists) {
      employeeNameIdMap.set(`${emp.name}|${emp.entity}`, exists.id);
      skipped++;
      continue;
    }
    const created_emp = await prisma.employee.create({
      data: {
        name: emp.name,
        idNumber: emp.idNumber ?? null,
        entity: emp.entity,
        employmentType: emp.employmentType,
        currency: emp.currency,
        department: emp.department ?? null,
        workCity: emp.workCity ?? null,
        status: emp.status,
        baseSalary: emp.baseSalary,
        dailyRate: emp.dailyRate ?? null,
        internSalaryType: emp.internSalaryType ?? null,
        housingFundBase: emp.housingFundBase ?? null,
        socialBase: emp.socialBase ?? null,
        monthlySpecialAdditionalDeduction: emp.monthlySpecialAdditionalDeduction ?? null,
        defaultHousingFundRatio: emp.defaultHousingFundRatio,
        isShenzhenHukou: emp.isShenzhenHukou ?? false,
        joinDate: emp.joinDate ?? null,
        leaveDate: emp.leaveDate ?? null,
        notes: emp.notes ?? null,
        noHousingAllowance: emp.noHousingAllowance ?? null,
        prevCumulative: (emp.prevCumulative ?? null) as any,
        prevCumulativeYear: emp.prevCumulativeYear ?? null,
      },
    });
    employeeNameIdMap.set(`${emp.name}|${emp.entity}`, created_emp.id);
    created++;
  }
  console.log(`✓ Employees: ${created} created, ${skipped} already present`);

  // 4. Per-month tax additional deductions (idempotent upsert by (employeeId, year, month))
  // Sample-L: 2026/1,2,3,4,5 all the same: 2000, 0, 0, 0, 3000, 0
  // Sample-Z: 2026/3,4,5: 2000, 0, 0, 1500, 0, 0
  const TAX_DEDUCTION_SEEDS: Array<{
    name: string;
    entity: string;
    year: number;
    month: number;
    vals: [number, number, number, number, number, number];
  }> = [
    { name: 'Sample-L', entity: '豪腾灵动', year: 2026, month: 1, vals: [2000, 0, 0, 0, 3000, 0] },
    { name: 'Sample-L', entity: '豪腾灵动', year: 2026, month: 2, vals: [2000, 0, 0, 0, 3000, 0] },
    { name: 'Sample-L', entity: '豪腾灵动', year: 2026, month: 3, vals: [2000, 0, 0, 0, 3000, 0] },
    { name: 'Sample-L', entity: '豪腾灵动', year: 2026, month: 4, vals: [2000, 0, 0, 0, 3000, 0] },
    { name: 'Sample-L', entity: '豪腾灵动', year: 2026, month: 5, vals: [2000, 0, 0, 0, 3000, 0] },
    { name: 'Sample-Z', entity: '豪腾创想', year: 2026, month: 3, vals: [2000, 0, 0, 1500, 0, 0] },
    { name: 'Sample-Z', entity: '豪腾创想', year: 2026, month: 4, vals: [2000, 0, 0, 1500, 0, 0] },
    { name: 'Sample-Z', entity: '豪腾创想', year: 2026, month: 5, vals: [2000, 0, 0, 1500, 0, 0] },
  ];
  let taxCreated = 0;
  let taxSkipped = 0;
  for (const seed of TAX_DEDUCTION_SEEDS) {
    const empId = employeeNameIdMap.get(`${seed.name}|${seed.entity}`);
    if (!empId) continue;
    const existing = await prisma.taxDeduction.findUnique({
      where: { employeeId_year_month: { employeeId: empId, year: seed.year, month: seed.month } },
    });
    if (existing) { taxSkipped++; continue; }
    await prisma.taxDeduction.create({
      data: {
        employeeId: empId,
        year: seed.year,
        month: seed.month,
        taxChildEducation: seed.vals[0],
        taxContinuingEducation: seed.vals[1],
        taxHousingLoanInterest: seed.vals[2],
        taxHousingRent: seed.vals[3],
        taxElderlySupport: seed.vals[4],
        taxInfantCare: seed.vals[5],
      },
    });
    taxCreated++;
  }
  console.log(`✓ Tax deductions: ${taxCreated} created, ${taxSkipped} already present`);

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
