import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/tax-deductions
// Body: { employeeId, year, month, taxChildEducation, ... }
export const PUT = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { employeeId, year, month, ...fields } = body ?? {};
  if (!employeeId || !year || !month) {
    return json({ error: 'employeeId, year, month 必填' }, { status: 400 });
  }
  const row = await prisma.taxDeduction.upsert({
    where: { employeeId_year_month: { employeeId, year, month } },
    create: { employeeId, year, month, ...fields },
    update: fields,
  });
  return json(row);
});
