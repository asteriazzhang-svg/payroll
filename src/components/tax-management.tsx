'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePayrollStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import type { Employee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Receipt, Edit3, Save, Calculator, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '@/lib/payroll';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** A per-month row in the additional-deductions table. */
interface TaxDeductionRow {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  taxChildEducation: number;
  taxContinuingEducation: number;
  taxHousingLoanInterest: number;
  taxHousingRent: number;
  taxElderlySupport: number;
  taxInfantCare: number;
}

export function TaxManagement() {
  const { employees, config } = usePayrollStore();
  // The view shows deductions for `viewYear/viewMonth`, independent of
  // config.year/config.month which is the calculation period.
  const [viewYear, setViewYear] = useState(config.year);
  const [viewMonth, setViewMonth] = useState(config.month);
  const [search, setSearch] = useState('');

  // All non-境外主体 employees (i.e. mainland China: 豪腾灵动 / 豪腾创想)
  const mainlandEmployees = useMemo(
    () => employees.filter((e) => e.entity !== '境外主体'),
    [employees]
  );

  // Filtered by search (name or department)
  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mainlandEmployees;
    return mainlandEmployees.filter(
      (e) => e.name.toLowerCase().includes(q) || (e.department ?? '').toLowerCase().includes(q)
    );
  }, [mainlandEmployees, search]);

  // Per-month deductions fetched from the API, keyed by employeeId.
  const [rows, setRows] = useState<Record<string, TaxDeductionRow>>({});
  const [editing, setEditing] = useState<Employee | null>(null);

  const loadRows = async () => {
    try {
      const data = await api<TaxDeductionRow[]>(
        `/api/tax-deductions?year=${viewYear}&month=${viewMonth}`
      );
      const map: Record<string, TaxDeductionRow> = {};
      for (const r of data) map[r.employeeId] = r;
      setRows(map);
    } catch {
      setRows({});
    }
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, employees.length]);

  const goPrev = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNext = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const updateRow = (employeeId: string, patch: Partial<TaxDeductionRow>) => {
    setRows((prev) => {
      const existing = prev[employeeId];
      const merged: TaxDeductionRow = existing
        ? { ...existing, ...patch }
        : {
            id: `local-${employeeId}`,
            employeeId,
            year: viewYear,
            month: viewMonth,
            taxChildEducation: 0,
            taxContinuingEducation: 0,
            taxHousingLoanInterest: 0,
            taxHousingRent: 0,
            taxElderlySupport: 0,
            taxInfantCare: 0,
            ...patch,
          };
      return { ...prev, [employeeId]: merged };
    });
  };

  const handleSave = async (employee: Employee) => {
    const row = rows[employee.id];
    if (!row) {
      setEditing(null);
      return;
    }
    await api(`/api/tax-deductions/${employee.id}`, {
      method: 'PUT',
      body: {
        employeeId: employee.id,
        year: viewYear,
        month: viewMonth,
        taxChildEducation: row.taxChildEducation,
        taxContinuingEducation: row.taxContinuingEducation,
        taxHousingLoanInterest: row.taxHousingLoanInterest,
        taxHousingRent: row.taxHousingRent,
        taxElderlySupport: row.taxElderlySupport,
        taxInfantCare: row.taxInfantCare,
      },
    });
    await loadRows();
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              个税专项附加扣除
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-base font-medium min-w-[120px] text-center">
                {viewYear} 年 {viewMonth} 月
              </div>
              <Button variant="outline" size="sm" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Select
                value={`${viewYear}-${viewMonth}`}
                onValueChange={(v) => {
                  const [y, m] = v.split('-').map(Number);
                  setViewYear(y);
                  setViewMonth(m);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="快速跳转" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={`${viewYear}-${m}`} value={`${viewYear}-${m}`}>
                      {viewYear} 年 {m} 月
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/30 rounded-md flex items-start gap-2">
            <Calculator className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              个税专项附加扣除仅适用于大陆主体（豪腾灵动、豪腾创想）的员工。境外主体员工的薪资按香港MPF规则，不参与中国大陆个税累计预扣。
              <br />
              <strong>默认继承上月：</strong>在建立员工后所有6项默认为0；打开下一个月时，若该月无记录，会自动以上一月的金额预填（修改后保存即覆盖）。
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索姓名或部门..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="text-sm text-muted-foreground self-center">
              {filteredEmployees.length} / {mainlandEmployees.length} 名员工
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">姓名</TableHead>
                  <TableHead className="min-w-[100px]">部门</TableHead>
                  <TableHead className="text-right min-w-[100px]">子女教育</TableHead>
                  <TableHead className="text-right min-w-[100px]">继续教育</TableHead>
                  <TableHead className="text-right min-w-[110px]">住房贷款利息</TableHead>
                  <TableHead className="text-right min-w-[100px]">住房租金</TableHead>
                  <TableHead className="text-right min-w-[100px]">赡养老人</TableHead>
                  <TableHead className="text-right min-w-[100px]">婴幼儿照护</TableHead>
                  <TableHead className="text-right min-w-[100px]">月合计</TableHead>
                  <TableHead className="text-center min-w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => {
                  const row = rows[emp.id];
                  const child = row?.taxChildEducation ?? 0;
                  const continuing = row?.taxContinuingEducation ?? 0;
                  const loan = row?.taxHousingLoanInterest ?? 0;
                  const rent = row?.taxHousingRent ?? 0;
                  const elderly = row?.taxElderlySupport ?? 0;
                  const infant = row?.taxInfantCare ?? 0;
                  const total = child + continuing + loan + rent + elderly + infant;
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.department ?? '-'}</TableCell>
                      <TableCell className="text-right">{child > 0 ? formatNumber(child) : '-'}</TableCell>
                      <TableCell className="text-right">{continuing > 0 ? formatNumber(continuing) : '-'}</TableCell>
                      <TableCell className="text-right">{loan > 0 ? formatNumber(loan) : '-'}</TableCell>
                      <TableCell className="text-right">{rent > 0 ? formatNumber(rent) : '-'}</TableCell>
                      <TableCell className="text-right">{elderly > 0 ? formatNumber(elderly) : '-'}</TableCell>
                      <TableCell className="text-right">{infant > 0 ? formatNumber(infant) : '-'}</TableCell>
                      <TableCell className="text-right font-medium">{total > 0 ? formatNumber(total) : '-'}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Auto-prefill from previous month if current month is empty.
                            if (!row) {
                              void (async () => {
                                try {
                                  const prevMonth = viewMonth === 1 ? { y: viewYear - 1, m: 12 } : { y: viewYear, m: viewMonth - 1 };
                                  const prevData = await api<TaxDeductionRow[]>(
                                    `/api/tax-deductions?year=${prevMonth.y}&month=${prevMonth.m}&employeeId=${emp.id}`
                                  );
                                  const prev = prevData[0];
                                  updateRow(emp.id, prev ? {
                                    taxChildEducation: prev.taxChildEducation,
                                    taxContinuingEducation: prev.taxContinuingEducation,
                                    taxHousingLoanInterest: prev.taxHousingLoanInterest,
                                    taxHousingRent: prev.taxHousingRent,
                                    taxElderlySupport: prev.taxElderlySupport,
                                    taxInfantCare: prev.taxInfantCare,
                                  } : {});
                                } catch { /* ignore */ }
                                setEditing(emp);
                              })();
                            } else {
                              setEditing(emp);
                            }
                          }}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          编辑
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filteredEmployees.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {mainlandEmployees.length === 0
                ? '没有大陆主体员工，无需设置个税专项扣除'
                : '没有匹配的员工'}
            </div>
          )}
        </CardContent>
      </Card>

      <DeductionEditDialog
        employee={editing}
        value={editing ? (rows[editing.id] ?? {
          id: '',
          employeeId: editing.id,
          year: viewYear,
          month: viewMonth,
          taxChildEducation: 0,
          taxContinuingEducation: 0,
          taxHousingLoanInterest: 0,
          taxHousingRent: 0,
          taxElderlySupport: 0,
          taxInfantCare: 0,
        }) : null}
        onChange={(patch) => editing && updateRow(editing.id, patch)}
        onClose={() => setEditing(null)}
        onSave={() => editing && handleSave(editing)}
      />
    </div>
  );
}

function DeductionEditDialog({
  employee,
  value,
  onChange,
  onClose,
  onSave,
}: {
  employee: Employee | null;
  value: TaxDeductionRow | null;
  onChange: (patch: Partial<TaxDeductionRow>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  if (!employee || !value) return null;

  const total =
    value.taxChildEducation +
    value.taxContinuingEducation +
    value.taxHousingLoanInterest +
    value.taxHousingRent +
    value.taxElderlySupport +
    value.taxInfantCare;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            编辑 {employee.name} 的个税专项附加扣除
            （{employee.department ?? '-'}，{value.year}年{value.month}月）
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-muted-foreground p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
            💡 以下6项为月度扣除额。系统会自动汇总并用于个税累计预扣计算。
          </div>

          {/* 子女教育 */}
          <div className="space-y-1.5">
            <Label>子女教育</Label>
            <Select
              value={String(value.taxChildEducation)}
              onValueChange={(v) => onChange({ taxChildEducation: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
                <SelectItem value="2000">2000</SelectItem>
                <SelectItem value="3000">3000</SelectItem>
                <SelectItem value="4000">4000</SelectItem>
                <SelectItem value="6000">6000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 继续教育 */}
          <div className="space-y-1.5">
            <Label>继续教育（自由输入）</Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={value.taxContinuingEducation}
              onChange={(e) => onChange({ taxContinuingEducation: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* 住房贷款利息 */}
          <div className="space-y-1.5">
            <Label>住房贷款利息</Label>
            <Select
              value={String(value.taxHousingLoanInterest)}
              onValueChange={(v) => onChange({ taxHousingLoanInterest: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 住房租金 */}
          <div className="space-y-1.5">
            <Label>住房租金</Label>
            <Select
              value={String(value.taxHousingRent)}
              onValueChange={(v) => onChange({ taxHousingRent: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1500">1500</SelectItem>
                <SelectItem value="1100">1100</SelectItem>
                <SelectItem value="800">800</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 赡养老人 */}
          <div className="space-y-1.5">
            <Label>赡养老人（自由输入）</Label>
            <Input
              type="number"
              step="1"
              min="0"
              max="3000"
              value={value.taxElderlySupport}
              onChange={(e) => onChange({ taxElderlySupport: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* 婴幼儿照护 */}
          <div className="space-y-1.5">
            <Label>婴幼儿照护</Label>
            <Select
              value={String(value.taxInfantCare)}
              onValueChange={(v) => onChange({ taxInfantCare: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
                <SelectItem value="2000">2000</SelectItem>
                <SelectItem value="3000">3000</SelectItem>
                <SelectItem value="4000">4000</SelectItem>
                <SelectItem value="6000">6000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
            <span className="font-medium">月合计</span>
            <span className="text-lg font-bold">{formatNumber(total)} 元</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
