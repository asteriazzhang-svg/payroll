// Client-side store backed by the backend API.
//
// Keeps a similar action surface to the old localStorage version so existing
// components change minimally, but every read/write now goes through fetch.
// Key differences from the old store:
//   - actions are async (await them)
//   - saveRecord (singular) -> saveRecords (plural, batch save)
//   - calculateEmployeePayroll is async (calls the API)
//   - resetToSeed / clearAll removed (data now lives server-side)

'use client';

import { create } from 'zustand';
import type { Employee, PayrollInput, PayPeriodConfig, PayrollRecord } from './types';
import { DEFAULT_CONFIG, calculatePayroll } from './payroll';
import { api } from './api-client';

interface PayrollStore {
  employees: Employee[];
  config: PayPeriodConfig;
  payrollInputs: Record<string, PayrollInput>;
  savedRecords: Record<string, PayrollRecord>;
  loaded: boolean;
  loading: boolean;

  loadAll: () => Promise<void>;

  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<Employee>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  updateConfig: (updates: Partial<PayPeriodConfig>) => Promise<void>;

  updatePayrollInput: (employeeId: string, updates: Partial<PayrollInput>) => void;
  initPayrollInput: (employeeId: string) => void;

  saveRecords: (records: { employeeId: string; input: PayrollInput }[]) => Promise<void>;
  deleteRecord: (key: string) => Promise<void>;
  deleteRecordsByMonth: (year: number, month: number) => Promise<number>;
}

function recordKey(year: number, month: number, employeeId: string): string {
  return `${year}-${month}-${employeeId}`;
}

// Debounced persistence of payroll inputs (per employee). Saves to the backend
// 800ms after the last edit so rapid keystrokes don't spam the API.
const inputSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function scheduleInputSave(employeeId: string, input: PayrollInput) {
  if (inputSaveTimers[employeeId]) clearTimeout(inputSaveTimers[employeeId]);
  inputSaveTimers[employeeId] = setTimeout(() => {
    api(`/api/payroll/inputs/${employeeId}`, { method: 'PUT', body: input }).catch(() => {
      // best-effort; UI state is already updated locally
    });
  }, 800);
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  employees: [],
  config: DEFAULT_CONFIG,
  payrollInputs: {},
  savedRecords: {},
  loaded: false,
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const [employees, config, records] = await Promise.all([
        api<Employee[]>('/api/employees'),
        api<PayPeriodConfig>('/api/config'),
        api<PayrollRecord[]>('/api/records'),
      ]);
      const savedRecords: Record<string, PayrollRecord> = {};
      for (const r of records) {
        savedRecords[recordKey(r.year, r.month, r.employeeId)] = r;
      }
      // Also load working inputs for the current config month (so a page
      // refresh doesn't lose half-filled attendance data).
      let payrollInputs: Record<string, PayrollInput> = {};
      try {
        const inputsMap = await api<Record<string, PayrollInput>>(
          `/api/payroll/inputs?year=${config.year}&month=${config.month}`
        );
        payrollInputs = inputsMap ?? {};
      } catch {
        // inputs are best-effort; don't block app load if this fails.
      }
      set({ employees, config, savedRecords, payrollInputs, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  addEmployee: async (employee) => {
    const { employee: created } = await api<{ employee: Employee }>(
      '/api/employees',
      { method: 'POST', body: employee }
    );
    set((state) => ({ employees: [...state.employees, created] }));
    return created;
  },

  updateEmployee: async (id, updates) => {
    const updated = await api<Employee>(`/api/employees/${id}`, {
      method: 'PUT',
      body: updates,
    });
    set((state) => ({
      employees: state.employees.map((e) => (e.id === id ? updated : e)),
    }));
  },

  deleteEmployee: async (id) => {
    await api(`/api/employees/${id}`, { method: 'DELETE' });
    set((state) => ({
      employees: state.employees.filter((e) => e.id !== id),
      payrollInputs: Object.fromEntries(
        Object.entries(state.payrollInputs).filter(([eid]) => eid !== id)
      ),
    }));
  },

  updateConfig: async (updates) => {
    const updated = await api<PayPeriodConfig>('/api/config', {
      method: 'PUT',
      body: updates,
    });
    set({ config: updated });
  },

  updatePayrollInput: (employeeId, updates) =>
    set((state) => {
      const existing = state.payrollInputs[employeeId];
      let merged: PayrollInput;
      if (existing) {
        merged = { ...existing, ...updates };
      } else {
        const employee = state.employees.find((e) => e.id === employeeId);
        const defaultAttendance =
          employee?.entity === '境外主体'
            ? state.config.hkWorkingDays
            : state.config.szWorkingDays;
        const defaults: PayrollInput = {
          employeeId,
          year: state.config.year,
          month: state.config.month,
          scheduledDays: defaultAttendance,
          attendanceDays: defaultAttendance,
          personalLeaveHours: 0,
          sickLeaveDays: 0,
          adjustment: 0,
          bonus: 0,
          housingFundRatio: employee?.defaultHousingFundRatio,
        };
        merged = { ...defaults, ...updates };
      }
      // Schedule a debounced save to the backend (non-blocking).
      scheduleInputSave(employeeId, merged);
      return {
        payrollInputs: {
          ...state.payrollInputs,
          [employeeId]: merged,
        },
      };
    }),

  initPayrollInput: (employeeId) =>
    set((state) => {
      if (state.payrollInputs[employeeId]) return state;
      const employee = state.employees.find((e) => e.id === employeeId);
      const defaultAttendance =
        employee?.entity === '境外主体'
          ? state.config.hkWorkingDays
          : state.config.szWorkingDays;
      return {
        payrollInputs: {
          ...state.payrollInputs,
          [employeeId]: {
            employeeId,
            year: state.config.year,
            month: state.config.month,
            scheduledDays: defaultAttendance,
            attendanceDays: defaultAttendance,
            personalLeaveHours: 0,
            sickLeaveDays: 0,
            adjustment: 0,
            bonus: 0,
            housingFundRatio: employee?.defaultHousingFundRatio,
          },
        },
      };
    }),

  saveRecords: async (records) => {
    const { records: saved } = await api<{ records: PayrollRecord[] }>(
      '/api/payroll/save',
      { method: 'POST', body: { records, config: get().config } }
    );
    set((state) => {
      const newSaved = { ...state.savedRecords };
      for (const r of saved) {
        newSaved[recordKey(r.year, r.month, r.employeeId)] = r;
      }
      return { savedRecords: newSaved };
    });
  },

  deleteRecord: async (key) => {
    const rec = get().savedRecords[key];
    if (!rec) return;
    await api('/api/records', { method: 'DELETE', query: { id: rec.id } });
    set((state) => {
      const next = { ...state.savedRecords };
      delete next[key];
      return { savedRecords: next };
    });
  },

  deleteRecordsByMonth: async (year, month) => {
    const { deleted } = await api<{ deleted: number }>('/api/records', {
      method: 'DELETE',
      query: { year, month },
    });
    set((state) => {
      const prefix = `${year}-${month}-`;
      const next: Record<string, PayrollRecord> = {};
      for (const [k, v] of Object.entries(state.savedRecords)) {
        if (!k.startsWith(prefix)) next[k] = v;
      }
      return { savedRecords: next };
    });
    return deleted;
  },
}));

/**
 * Look up the previous month's saved record for an employee (auto carry-forward).
 * Only returns records from the SAME year as the calculation.
 */
export function getPrevMonthRecord(
  employeeId: string,
  year: number,
  month: number,
  savedRecords: Record<string, PayrollRecord>
): PayrollRecord | null {
  const prev = getPreviousMonthLocal(year, month);
  if (prev.year !== year) return null;
  return savedRecords[recordKey(prev.year, prev.month, employeeId)] ?? null;
}

function getPreviousMonthLocal(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/**
 * Calculate payroll for an employee. Runs the pure engine in the browser
 * (fast, no API round-trip), using the loaded savedRecords for cumulative-tax
 * carry-forward. The API's /payroll/calculate exists for server-side use; the
 * client uses this synchronous version for live preview in the calculator.
 */
export function calculateEmployeePayroll(
  employee: Employee,
  input: PayrollInput,
  config: PayPeriodConfig,
  savedRecords?: Record<string, PayrollRecord>
): PayrollRecord {
  const prevRecord = savedRecords
    ? getPrevMonthRecord(employee.id, input.year, input.month, savedRecords)
    : null;
  const result = calculatePayroll(employee, input, config, prevRecord);
  return {
    ...input,
    ...result,
    id: `${input.year}-${input.month}-${employee.id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
