import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { configFromDB } from '@/lib/converters';
import { withErrorHandler, errorResponse, json } from '@/lib/api';
import type { PayPeriodConfig, CityConfig } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: any authenticated user (employees need the exchange rate for display).
export const GET = withErrorHandler(async () => {
  await requireAuth();
  const row = await prisma.config.findUnique({ where: { id: 'singleton' } });
  if (!row) return errorResponse(404, '配置不存在');
  return json(configFromDB(row));
});

// PUT: admin only.
export const PUT = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Partial<PayPeriodConfig>;
  const allowed: (keyof PayPeriodConfig)[] = [
    'year', 'month', 'szWorkingDays', 'hkWorkingDays', 'housingAllowance', 'exchangeRate',
    'szPensionBaseMin', 'szPensionBaseMax', 'szMedicalBaseMin', 'szMedicalBaseMax',
    'szUnemploymentBaseMin', 'szUnemploymentBaseMax',
    'szHousingFundBaseMin', 'szHousingFundBaseMax',
  ];
  const data: Record<string, number | string> = {};
  for (const k of allowed) {
    if (typeof body[k] === 'number' && Number.isFinite(body[k])) {
      data[k] = body[k] as number;
    }
  }
  // citySocialConfigs: accept array of CityConfig objects
  if (Array.isArray(body.citySocialConfigs)) {
    data['citySocialConfigs'] = JSON.stringify(body.citySocialConfigs);
  }
  // minimumWageByCity: object keyed by city name
  if (body.minimumWageByCity && typeof body.minimumWageByCity === 'object') {
    data['minimumWageByCity'] = JSON.stringify(body.minimumWageByCity);
  }
  const row = await prisma.config.update({
    where: { id: 'singleton' },
    data,
  });
  return json(configFromDB(row));
});
