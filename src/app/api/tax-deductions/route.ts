import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { withErrorHandler, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/tax-deductions?year=2026&month=6[&employeeId=xxx]
// Returns all tax deductions for the year+month. Admins and employees can read.
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') ?? '0');
  const month = parseInt(url.searchParams.get('month') ?? '0');
  if (!year || !month) {
    return json({ error: 'year 和 month 必填' }, { status: 400 });
  }
  const employeeId = url.searchParams.get('employeeId') ?? undefined;
  const rows = await prisma.taxDeduction.findMany({
    where: { year, month, ...(employeeId ? { employeeId } : {}) },
  });
  return json(rows);
});
