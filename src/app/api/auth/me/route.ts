import { withErrorHandler, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Auth bypass: always return admin user.
export const GET = withErrorHandler(async () => {
  return json({
    user: {
      id: 'cm_admin',
      username: 'admin',
      role: 'ADMIN' as const,
      employeeId: null,
      employeeName: '管理员',
      department: null,
      mustChangePwd: false,
    },
  });
});
