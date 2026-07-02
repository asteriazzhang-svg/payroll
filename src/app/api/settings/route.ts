import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { withErrorHandler, errorResponse, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EntityConfig { name: string; calcType: 'shenzhen' | 'hongkong' | 'outsourcing'; }
interface DeptConfig { name: string; isRnD: boolean; }
interface AppSettings {
  companyName: string;
  entities: EntityConfig[];
  departments: DeptConfig[];
}

const DEFAULT_ENTITIES: EntityConfig[] = [
  { name: '豪腾灵动', calcType: 'shenzhen' },
  { name: '豪腾创想', calcType: 'shenzhen' },
  { name: '境外主体', calcType: 'hongkong' },
];
const DEFAULT_DEPARTMENTS: DeptConfig[] = [
  { name: '财务部', isRnD: false },
  { name: '人力资源部', isRnD: false },
  { name: '平台中心', isRnD: false },
  { name: '用户运营中心', isRnD: false },
  { name: '增长中心', isRnD: false },
  { name: '工作室', isRnD: true },
];

/** Normalize stored JSON to the current shape (backward-compat with old formats). */
function normalize(raw: { companyName: string; entities: unknown; departments: unknown }): AppSettings {
  // entities: could be old format (string[]) or new ({name, calcType}[])
  let entities: EntityConfig[] = DEFAULT_ENTITIES;
  if (Array.isArray(raw.entities)) {
    entities = (raw.entities as unknown[]).map((e) => {
      if (typeof e === 'string') {
        // old format — guess calcType from known names
        const ct = e === '境外主体' ? 'hongkong' : 'shenzhen';
        return { name: e, calcType: ct as EntityConfig['calcType'] };
      }
      return e as EntityConfig;
    });
  }
  // departments: could be old format (string[]) or new ({name, isRnD}[])
  let departments: DeptConfig[] = DEFAULT_DEPARTMENTS;
  if (Array.isArray(raw.departments)) {
    departments = (raw.departments as unknown[]).map((d) => {
      if (typeof d === 'string') {
        const nonRnD = ['财务部', '人力资源部', '平台中心', '用户运营中心', '增长中心'];
        return { name: d, isRnD: !nonRnD.includes(d) };
      }
      return d as DeptConfig;
    });
  }
  return { companyName: raw.companyName || 'Hortor Payroll System', entities, departments };
}

// GET /api/settings — any authenticated user.
export const GET = withErrorHandler(async () => {
  await requireAuth();
  let row = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  if (!row) {
    row = await prisma.settings.create({ data: { id: 'singleton' } });
  }
  return json(normalize({ companyName: row.companyName, entities: row.entities, departments: row.departments }));
});

// PUT /api/settings — admin only. Accepts partial updates.
export const PUT = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Partial<AppSettings>;
  const data: Record<string, unknown> = {};
  if (typeof body.companyName === 'string' && body.companyName.trim()) {
    data.companyName = body.companyName.trim();
  }
  if (Array.isArray(body.entities)) {
    data.entities = (body.entities as EntityConfig[]).filter((e) => e.name?.trim()).map((e) => ({
      name: String(e.name).trim(),
      calcType: ['shenzhen', 'hongkong', 'outsourcing'].includes(e.calcType) ? e.calcType : 'shenzhen',
    }));
  }
  if (Array.isArray(body.departments)) {
    data.departments = (body.departments as DeptConfig[]).filter((d) => d.name?.trim()).map((d, _i, _arr) => ({
      name: String(d.name).trim(),
      isRnD: !!d.isRnD,
    }));
  }
  const row = await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
  return json(normalize({ companyName: row.companyName, entities: row.entities, departments: row.departments }));
});
