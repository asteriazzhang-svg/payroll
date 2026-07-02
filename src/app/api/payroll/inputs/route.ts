import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { payrollInputFromDB } from '@/lib/converters';
import { withErrorHandler, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/payroll/inputs?year=&month=
// Returns all payroll inputs for the given month (admin only).
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? '0', 10);
  const month = parseInt(searchParams.get('month') ?? '0', 10);
  if (!year || !month) return json([]);

  const rows = await prisma.payrollInput.findMany({
    where: { year, month },
  });
  // Return as a map keyed by employeeId for easy client consumption.
  const map: Record<string, unknown> = {};
  for (const r of rows) {
    map[r.employeeId] = payrollInputFromDB(r);
  }
  return json(map);
});
