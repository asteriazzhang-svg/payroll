import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { payrollRecordFromDB } from '@/lib/converters';
import { withErrorHandler, errorResponse, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/records?year=&month=&employeeId=
//   ADMIN  -> all (optional filters)
//   EMPLOYEE -> only own records (employeeId filter forced to self)
export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  let employeeId = searchParams.get('employeeId');

  const where: Record<string, unknown> = {};
  if (year) where.year = parseInt(year, 10);
  if (month) where.month = parseInt(month, 10);

  if (session.role === 'EMPLOYEE') {
    // Force-scope to self, ignoring any requested employeeId.
    where.employeeId = session.employeeId ?? '__none__';
  } else if (employeeId) {
    where.employeeId = employeeId;
  }

  const rows = await prisma.payrollRecord.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { employeeName: 'asc' }],
  });
  return json(rows.map(payrollRecordFromDB));
});

// DELETE /api/records?year=&month=   (admin only) — delete a whole month.
// DELETE /api/records?id=            (admin only) — delete a single record.
export const DELETE = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  if (id) {
    try {
      await prisma.payrollRecord.delete({ where: { id } });
    } catch {
      return errorResponse(404, '记录不存在');
    }
    return json({ ok: true, deleted: 1 });
  }
  if (year && month) {
    const result = await prisma.payrollRecord.deleteMany({
      where: { year: parseInt(year, 10), month: parseInt(month, 10) },
    });
    return json({ ok: true, deleted: result.count });
  }
  return errorResponse(400, '需要提供 id 或 year+month');
});
