// Placeholder sample data — replace with your own employees.
//
// These are FICTIONAL entries for demo/testing. Delete them or replace via
// the employee manager tab once you have set up real employees.

import type { Employee } from './types';

export const SEED_EMPLOYEES: Omit<Employee, 'id'>[] = [
  // Sample-L: 豪腾灵动 / 北京 / 全职 / RMB
  {
    name: 'Sample-L',
    entity: '豪腾灵动',
    employmentType: '全职',
    currency: 'RMB',
    department: '工作室',
    workCity: '北京',
    status: '在职',
    baseSalary: 40000,
    defaultHousingFundRatio: 0.10,
    isShenzhenHukou: false,
    joinDate: '2026-01-16',
    leaveDate: undefined,
    housingFundBase: 40000,
    socialBase: 40000,
  },
  // Sample-X: 境外主体 / 香港 / 外包 / USD
  {
    name: 'Sample-X',
    entity: '境外主体',
    employmentType: '外包',
    currency: 'USD',
    department: '增长中心',
    workCity: '香港',
    status: '在职',
    baseSalary: 750,
    dailyRate: 0,
    defaultHousingFundRatio: 0,
    isShenzhenHukou: false,
    joinDate: '2024-05-01',
    leaveDate: undefined,
  },
  // Sample-Y: 豪腾灵动 / 北京 / 实习生 / RMB / 日薪
  {
    name: 'Sample-Y',
    entity: '豪腾灵动',
    employmentType: '实习生',
    currency: 'RMB',
    department: '人力资源部',
    workCity: '北京',
    status: '离职',
    baseSalary: 0,
    dailyRate: 200,
    internSalaryType: '日薪',
    defaultHousingFundRatio: 0, // 实习生无公积金
    isShenzhenHukou: false,
    joinDate: '2025-07-24',
    leaveDate: '2026-01-09',
  },
  // Sample-Z: 豪腾创想 / 北京 / 全职 / RMB (外派性质)
  {
    name: 'Sample-Z',
    entity: '豪腾创想',
    employmentType: '全职',
    currency: 'RMB',
    department: '财务部',
    workCity: '北京',
    status: '离职',
    baseSalary: 30000,
    defaultHousingFundRatio: 0.10,
    isShenzhenHukou: false,
    joinDate: '2023-11-20',
    leaveDate: '2026-04-30',
    housingFundBase: 27000,
    socialBase: 27000,
    noHousingAllowance: true, // 房补 = 0
  },
];
