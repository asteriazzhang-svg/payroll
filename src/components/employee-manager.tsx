'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePayrollStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import type { Employee, Entity, EmploymentType, Currency, InternSalaryType, CityConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Users, Search, Download, Edit3, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '@/lib/payroll';

const ENTITIES: Entity[] = ['豪腾灵动', '豪腾创想', '境外主体'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['全职', '实习生', '外包'];
const CURRENCIES: Currency[] = ['RMB', 'HKD', 'USD'];
const INTERN_TYPES: InternSalaryType[] = ['月薪', '日薪'];
const HOUSING_FUND_RATIOS = [0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.12];

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

export function EmployeeManager() {
  const { employees, addEmployee, updateEmployee, deleteEmployee, config } = usePayrollStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // 个税扣除 - month picker
  const [viewYear, setViewYear] = useState(config.year);
  const [viewMonth, setViewMonth] = useState(config.month);
  const [taxRows, setTaxRows] = useState<Record<string, TaxDeductionRow>>({});
  const [editingTax, setEditingTax] = useState<Employee | null>(null);

  const filteredEmployees = employees.filter((emp) => {
    const matchSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.department ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchEntity = filterEntity === 'all' || emp.entity === filterEntity;
    const matchType = filterType === 'all' || emp.employmentType === filterType;
    return matchSearch && matchEntity && matchType;
  });

  const loadTaxRows = async () => {
    try {
      const data = await api<TaxDeductionRow[]>(
        `/api/tax-deductions?year=${viewYear}&month=${viewMonth}`
      );
      const map: Record<string, TaxDeductionRow> = {};
      for (const r of data) map[r.employeeId] = r;
      setTaxRows(map);
    } catch {
      setTaxRows({});
    }
  };

  useEffect(() => {
    loadTaxRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, employees.length]);

  const goPrev = () => {
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
    else { setViewMonth(viewMonth - 1); }
  };
  const goNext = () => {
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
    else { setViewMonth(viewMonth + 1); }
  };

  const updateTaxRow = (employeeId: string, patch: Partial<TaxDeductionRow>) => {
    setTaxRows((prev) => {
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

  const handleTaxSave = async (employee: Employee) => {
    const row = taxRows[employee.id];
    if (!row) { setEditingTax(null); return; }
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
    await loadTaxRows();
    setEditingTax(null);
  };

  const handleAdd = () => {
    setEditingEmployee(null);
    setDialogOpen(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除该员工吗？相关薪资记录也会一并删除。')) {
      try {
        await deleteEmployee(id);
      } catch (e) {
        alert('删除失败：' + (e instanceof Error ? e.message : String(e)));
      }
    }
  };

  // Export all employees + tax deductions to a CSV file.
  const handleExportEmployees = () => {
    const headers = [
      '姓名', '部门', '签约主体', '工作城市', '任职性质', '币种',
      '月薪', '日薪', '入职日期', '离职日期',
      '公积金比例', '房补', '社保基数', '公积金基数',
      '子女教育', '继续教育', '住房贷款利息', '住房租金', '赡养老人', '婴幼儿照护',
      '专项附加扣除调整项', '专项附加扣除月合计',
    ];
    const rows = filteredEmployees.map((emp) => {
      const t = taxRows[emp.id];
      const child = t?.taxChildEducation ?? 0;
      const cont = t?.taxContinuingEducation ?? 0;
      const loan = t?.taxHousingLoanInterest ?? 0;
      const rent = t?.taxHousingRent ?? 0;
      const elderly = t?.taxElderlySupport ?? 0;
      const infant = t?.taxInfantCare ?? 0;
      const total = child + cont + loan + rent + elderly + infant;
      return [
        emp.name,
        emp.department ?? '',
        emp.entity,
        emp.workCity ?? '深圳',
        emp.employmentType,
        emp.currency,
        emp.baseSalary,
        emp.dailyRate ?? '',
        emp.joinDate ?? '',
        emp.leaveDate ?? '至今',
        `${(emp.defaultHousingFundRatio * 100).toFixed(0)}%`,
        emp.noHousingAllowance ? '不发放' : '发放',
        emp.socialBase ?? '',
        emp.housingFundBase ?? '',
        child, cont, loan, rent, elderly, infant,
        '', // 专项附加扣除调整项 (currently unused, kept for column alignment)
        total,
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.download = `员工信息_${viewYear}${String(viewMonth).padStart(2, '0')}_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              员工管理 ({employees.length})
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Month picker — controls 个税专项附加扣除 column */}
              <Button variant="outline" size="sm" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[110px] text-center">
                {viewYear} 年 {viewMonth} 月
              </div>
              <Button variant="outline" size="sm" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Select
                value={`${viewYear}-${viewMonth}`}
                onValueChange={(v) => {
                  const [y, m] = v.split('-').map(Number);
                  setViewYear(y); setViewMonth(m);
                }}
              >
                <SelectTrigger className="w-[130px] h-8">
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
              <Button variant="outline" onClick={handleExportEmployees}>
                <Download className="h-4 w-4 mr-1" />
                下载员工信息
              </Button>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-1" />
                添加员工
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索姓名或部门..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="签约主体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部主体</SelectItem>
                {ENTITIES.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="任职性质" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部性质</SelectItem>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Table (with monthly tax deductions merged in) */}
          <div className="rounded-md border max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-20 min-w-[100px]">姓名</TableHead>
                  <TableHead className="min-w-[100px]">部门</TableHead>
                  <TableHead className="min-w-[110px]">签约主体</TableHead>
                  <TableHead className="min-w-[90px]">工作城市</TableHead>
                  <TableHead className="min-w-[80px]">任职性质</TableHead>
                  <TableHead className="min-w-[70px]">币种</TableHead>
                  <TableHead className="text-right min-w-[100px]">月薪</TableHead>
                  <TableHead className="text-right min-w-[90px]">日薪</TableHead>
                  <TableHead className="min-w-[100px]">入职日期</TableHead>
                  <TableHead className="min-w-[100px]">离职日期</TableHead>
                  <TableHead className="text-center min-w-[90px]">公积金比例</TableHead>
                  <TableHead className="text-center min-w-[80px]">房补</TableHead>
                  <TableHead className="text-right min-w-[100px]">社保基数</TableHead>
                  <TableHead className="text-right min-w-[100px]">公积金基数</TableHead>
                  <TableHead className="text-right min-w-[90px]">子女教育</TableHead>
                  <TableHead className="text-right min-w-[90px]">继续教育</TableHead>
                  <TableHead className="text-right min-w-[110px]">住房贷款利息</TableHead>
                  <TableHead className="text-right min-w-[90px]">住房租金</TableHead>
                  <TableHead className="text-right min-w-[90px]">赡养老人</TableHead>
                  <TableHead className="text-right min-w-[90px]">婴幼儿照护</TableHead>
                  <TableHead className="text-right min-w-[110px]">专项附加扣除调整项</TableHead>
                  <TableHead className="text-right min-w-[110px]">专项附加扣除月合计</TableHead>
                  <TableHead className="text-center min-w-[140px]"><div>操作</div><div className="text-[10px] font-normal text-muted-foreground leading-tight">编辑员工 / 编辑专项附加扣除 / 删除</div></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => {
                  const isMainland = emp.entity === '豪腾灵动' || emp.entity === '豪腾创想';
                  const t = taxRows[emp.id];
                  const child = t?.taxChildEducation ?? 0;
                  const cont = t?.taxContinuingEducation ?? 0;
                  const loan = t?.taxHousingLoanInterest ?? 0;
                  const rent = t?.taxHousingRent ?? 0;
                  const elderly = t?.taxElderlySupport ?? 0;
                  const infant = t?.taxInfantCare ?? 0;
                  const total = child + cont + loan + rent + elderly + infant;
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">{emp.name}</TableCell>
                      <TableCell>{emp.department ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant={emp.entity === '境外主体' ? 'secondary' : 'default'}>
                          {emp.entity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {emp.workCity ? (
                          <Badge variant="outline" className="text-xs">{emp.workCity}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">深圳</span>
                        )}
                      </TableCell>
                      <TableCell>{emp.employmentType}</TableCell>
                      <TableCell>{emp.currency}</TableCell>
                      <TableCell className="text-right">
                        {emp.baseSalary > 0 ? emp.baseSalary.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {emp.dailyRate ? `${emp.dailyRate}/天` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{emp.joinDate ?? '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{emp.leaveDate ?? '至今'}</TableCell>
                      <TableCell className="text-center">
                        {emp.employmentType === '实习生'
                          ? <Badge variant="outline" className="text-muted-foreground">无</Badge>
                          : `${(emp.defaultHousingFundRatio * 100).toFixed(0)}%`}
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.noHousingAllowance || emp.employmentType === '外包'
                          ? <Badge variant="outline" className="text-muted-foreground">不发放</Badge>
                          : <Badge variant="secondary">发放</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isMainland ? <span className="text-muted-foreground text-xs">-</span>
                          : emp.socialBase !== undefined ? emp.socialBase.toLocaleString()
                          : emp.baseSalary > 0 ? <span className="text-muted-foreground">= 月薪</span>
                          : <span className="text-muted-foreground text-xs">-</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isMainland ? <span className="text-muted-foreground text-xs">-</span>
                          : emp.housingFundBase !== undefined ? emp.housingFundBase.toLocaleString()
                          : emp.baseSalary > 0 ? <span className="text-muted-foreground">= 月薪</span>
                          : <span className="text-muted-foreground text-xs">-</span>}
                      </TableCell>
                      <TableCell className="text-right">{isMainland && child > 0 ? formatNumber(child) : '-'}</TableCell>
                      <TableCell className="text-right">{isMainland && cont > 0 ? formatNumber(cont) : '-'}</TableCell>
                      <TableCell className="text-right">{isMainland && loan > 0 ? formatNumber(loan) : '-'}</TableCell>
                      <TableCell className="text-right">{isMainland && rent > 0 ? formatNumber(rent) : '-'}</TableCell>
                      <TableCell className="text-right">{isMainland && elderly > 0 ? formatNumber(elderly) : '-'}</TableCell>
                      <TableCell className="text-right">{isMainland && infant > 0 ? formatNumber(infant) : '-'}</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right font-medium">{isMainland && total > 0 ? formatNumber(total) : '-'}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(emp)} title="编辑员工">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isMainland && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (!t) {
                                  try {
                                    const prevMonth = viewMonth === 1
                                      ? { y: viewYear - 1, m: 12 }
                                      : { y: viewYear, m: viewMonth - 1 };
                                    const prevData = await api<TaxDeductionRow[]>(
                                      `/api/tax-deductions?year=${prevMonth.y}&month=${prevMonth.m}&employeeId=${emp.id}`
                                    );
                                    const prev = prevData[0];
                                    updateTaxRow(emp.id, prev ? {
                                      taxChildEducation: prev.taxChildEducation,
                                      taxContinuingEducation: prev.taxContinuingEducation,
                                      taxHousingLoanInterest: prev.taxHousingLoanInterest,
                                      taxHousingRent: prev.taxHousingRent,
                                      taxElderlySupport: prev.taxElderlySupport,
                                      taxInfantCare: prev.taxInfantCare,
                                    } : {});
                                  } catch { /* ignore */ }
                                }
                                setEditingTax(emp);
                              }}
                              title="编辑个税专项附加扣除"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)} title="删除员工">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filteredEmployees.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">暂无员工数据</div>
          )}
        </CardContent>
      </Card>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editingEmployee}
        onSave={async (data) => {
          try {
            if (editingEmployee) {
              await updateEmployee(editingEmployee.id, data);
            } else {
              await addEmployee(data);
            }
            setDialogOpen(false);
          } catch (e) {
            alert('保存失败：' + (e instanceof Error ? e.message : String(e)));
          }
        }}
      />

      <TaxDeductionEditDialog
        employee={editingTax}
        value={editingTax ? (taxRows[editingTax.id] ?? {
          id: '',
          employeeId: editingTax.id,
          year: viewYear,
          month: viewMonth,
          taxChildEducation: 0,
          taxContinuingEducation: 0,
          taxHousingLoanInterest: 0,
          taxHousingRent: 0,
          taxElderlySupport: 0,
          taxInfantCare: 0,
        }) : null}
        onChange={(patch) => editingTax && updateTaxRow(editingTax.id, patch)}
        onClose={() => setEditingTax(null)}
        onSave={() => editingTax && handleTaxSave(editingTax)}
      />
    </div>
  );
}

/** Sub-component: dialog for editing one employee's monthly tax additional deductions. */
function TaxDeductionEditDialog({
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
    try { await onSave(); } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            编辑专项附加扣除 — {employee.name}
            （{employee.department ?? '-'}，{value.year}年{value.month}月）
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-muted-foreground p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
            💡 以下6项为月度扣除额。系统会自动汇总并用于个税累计预扣计算。
          </div>

          <div className="space-y-1.5">
            <Label>子女教育</Label>
            <Select value={String(value.taxChildEducation)} onValueChange={(v) => onChange({ taxChildEducation: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
          <div className="space-y-1.5">
            <Label>继续教育（自由输入）</Label>
            <Input type="number" step="1" min="0" value={value.taxContinuingEducation}
              onChange={(e) => onChange({ taxContinuingEducation: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label>住房贷款利息</Label>
            <Select value={String(value.taxHousingLoanInterest)} onValueChange={(v) => onChange({ taxHousingLoanInterest: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>住房租金</Label>
            <Select value={String(value.taxHousingRent)} onValueChange={(v) => onChange({ taxHousingRent: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1500">1500</SelectItem>
                <SelectItem value="1100">1100</SelectItem>
                <SelectItem value="800">800</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>赡养老人（自由输入）</Label>
            <Input type="number" step="1" min="0" max="3000" value={value.taxElderlySupport}
              onChange={(e) => onChange({ taxElderlySupport: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label>婴幼儿照护</Label>
            <Select value={String(value.taxInfantCare)} onValueChange={(v) => onChange({ taxInfantCare: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          {/* 专项附加扣除调整项 */}
          <div className="space-y-1.5">
            <Label>专项附加扣除调整项（自由输入，可正可负）</Label>
            <Input
              type="number"
              step="0.01"
              value={(value as any).adjustment ?? 0}
              onChange={(e) => onChange({ adjustment: parseFloat(e.target.value) || 0 } as any)}
            />
            <p className="text-xs text-muted-foreground">用于手工调整本月专项附加扣除总额（直接加在月合计上）</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
            <span className="font-medium">月合计（含调整项）</span>
            <span className="text-lg font-bold">{formatNumber(total + ((value as any).adjustment ?? 0))} 元</span>
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

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSave: (data: Omit<Employee, 'id'>) => void;
}

function EmployeeDialog({ open, onOpenChange, employee, onSave }: EmployeeDialogProps) {
  // Load entity + department lists from settings (configurable in 基础设置).
  const [entities, setEntities] = useState<string[]>(['豪腾灵动', '豪腾创想', '境外主体']);
  const [departments, setDepartments] = useState<string[]>(['财务部','人力资源部','平台中心','用户运营中心','增长中心','工作室']);
  const [availableCities, setAvailableCities] = useState<string[]>(['深圳']);
  useEffect(() => {
    api<{ entities: { name: string }[]; departments: { name: string }[] }>('/api/settings')
      .then((s) => {
        if (s.entities?.length) setEntities(s.entities.map((e) => e.name));
        if (s.departments?.length) setDepartments(s.departments.map((d) => d.name));
      })
      .catch(() => {});
    // Load city list from config
    api<{ citySocialConfigs?: { city: string }[] }>('/api/config')
      .then((c) => {
        if (c.citySocialConfigs?.length) {
          setAvailableCities(c.citySocialConfigs.map((x) => x.city));
        }
      })
      .catch(() => {});
  }, []);
  const emptyFormData: Omit<Employee, 'id'> = {
    name: '',
    entity: '豪腾灵动',
    employmentType: '全职',
    currency: 'RMB',
    department: '',
    workCity: '深圳',
    status: '在职',
    baseSalary: 0,
    dailyRate: 0,
    internSalaryType: '月薪',
    defaultHousingFundRatio: 0.05,
    isShenzhenHukou: false,
    joinDate: '',
    leaveDate: undefined,
    noHousingAllowance: false,
    prevCumulative: { cumIncome: 0, cumDeduction: 0, cumSpecial: 0, cumSpecialAdditional: 0, taxPaid: 0 },
  };

  const [formData, setFormData] = useState<Omit<Employee, 'id'>>(emptyFormData);

  // Reset form whenever the dialog opens OR the employee prop changes.
  // This is the actual fix: previously handleOpenChange only fired on close
  // (Radix onOpenChange is called when the dialog wants to change state, but
  // when the parent flips `open` from false to true the child doesn't get a
  // callback), so editing an existing employee always showed a blank form.
  useEffect(() => {
    if (open) {
      setFormData(employee ? { ...employee } : { ...emptyFormData });
    }
  }, [open, employee]);

  // Update form when employee changes
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setFormData(employee ? { ...employee } : { ...emptyFormData });
    }
    onOpenChange(open);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Sync status field: 离职日期有值→离职；留空→在职
    const finalStatus: '在职' | '离职' = formData.leaveDate ? '离职' : '在职';
    onSave({ ...formData, status: finalStatus });
  };

  const isIntern = formData.employmentType === '实习生';
  const isMainland = formData.entity === '豪腾灵动' || formData.entity === '豪腾创想';
  const isShenzhen = isMainland; // alias for backward compat within this component
  const isBeijing = formData.workCity === '北京';
  const isOutsource = formData.employmentType === '外包';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? '编辑员工' : '添加员工'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="department">部门</Label>
              <Select
                value={formData.department ?? ''}
                onValueChange={(v) => setFormData({ ...formData, department: v })}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="选择部门..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>签约主体</Label>
              <Select
                value={formData.entity}
                onValueChange={(v) => setFormData({ ...formData, entity: v as Entity })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>任职性质</Label>
              <Select
                value={formData.employmentType}
                onValueChange={(v) => setFormData({ ...formData, employmentType: v as EmploymentType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>发放币种</Label>
              <Select
                value={formData.currency}
                onValueChange={(v) => setFormData({ ...formData, currency: v as Currency })}
              >                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.entity === '境外主体'
                  ? '默认 USD，可改为 RMB 发放'
                  : '默认 RMB，可改为 USD 发放'}
              </p>
            </div>
          </div>

          {/* 工作城市：仅大陆全职/实习生显示 */}
          {!isOutsource && formData.entity !== '境外主体' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>工作城市</Label>
                <Select
                  value={formData.workCity ?? '深圳'}
                  onValueChange={(v) => setFormData({ ...formData, workCity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  决定社保/公积金适用的缴费基数上下限，可在「设置 → 城市社保基数」中配置各城市的参数
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {(isShenzhen || isBeijing) && !isOutsource && !isIntern && (
              <div>
                <Label>公积金比例</Label>
                <Select
                  value={String(formData.defaultHousingFundRatio)}
                  onValueChange={(v) => setFormData({ ...formData, defaultHousingFundRatio: parseFloat(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUSING_FUND_RATIOS.map((r) => (
                      <SelectItem key={r} value={String(r)}>{(r * 100).toFixed(0)}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isIntern && (
              <div>
                <Label>公积金比例</Label>
                <Input value="无（实习生）" disabled />
                <p className="text-xs text-muted-foreground mt-1">实习生默认无公积金</p>
              </div>
            )}
            <div>
              <Label>入职日期</Label>
              <Input
                type="date"
                value={formData.joinDate ?? ''}
                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value || undefined })}
              />
              <p className="text-xs text-muted-foreground mt-1">当年入职员工，累计减除费用从入职月起算</p>
            </div>
            <div>
              <Label>离职日期（至今=仍在职）</Label>
              <Input
                type="date"
                value={formData.leaveDate ?? ''}
                onChange={(e) => setFormData({ ...formData, leaveDate: e.target.value || undefined })}
              />
              <p className="text-xs text-muted-foreground mt-1">留空 = 至今（仍在职）。设置后表示已离职。</p>
            </div>
          </div>
          {!isOutsource && (
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="font-medium text-sm">是否发放房补</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.noHousingAllowance
                    ? '不发放房补，应发金额中不计算房补'
                    : '正常发放房补'}
                </p>
              </div>
              <Button
                type="button"
                variant={formData.noHousingAllowance ? 'destructive' : 'outline'}
                onClick={() => setFormData({ ...formData, noHousingAllowance: !formData.noHousingAllowance })}
                className="min-w-[100px]"
              >
                {formData.noHousingAllowance ? '不发放' : '发放'}
              </Button>
            </div>
          )}

          {/* Salary inputs based on type */}
          {isOutsource ? (
            <div className="space-y-2 p-3 bg-muted/30 rounded-md">
              <p className="text-sm text-muted-foreground">
                外包员工按合同约定计算薪资，在薪资计算页面直接输入应付金额。
              </p>
            </div>
          ) : isIntern ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>实习生薪资类型</Label>
                <Select
                  value={formData.internSalaryType ?? '月薪'}
                  onValueChange={(v) => setFormData({ ...formData, internSalaryType: v as InternSalaryType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERN_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.internSalaryType === '日薪' ? (
                <div>
                  <Label htmlFor="dailyRate">日薪 ({formData.entity === '境外主体' ? 'USD' : 'RMB'})</Label>
                  <Input
                    id="dailyRate"
                    type="number"
                    value={formData.dailyRate ?? 0}
                    onChange={(e) => setFormData({ ...formData, dailyRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="baseSalary">月薪 Base ({formData.entity === '境外主体' ? 'USD' : 'RMB'})</Label>
                  <Input
                    id="baseSalary"
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="baseSalary">
                  月薪 Base ({formData.entity === '境外主体' ? 'USD' : 'RMB'})
                </Label>
                <Input
                  id="baseSalary"
                  type="number"
                  value={formData.baseSalary}
                  onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })}
                />
              </div>
              {isShenzhen && (
                <>
                  <SocialBaseInput
                    base={formData.baseSalary}
                    value={formData.socialBase}
                    workCity={formData.workCity}
                    onChange={(v) => setFormData({ ...formData, socialBase: v })}
                  />
                  <HousingFundBaseInput
                    base={formData.baseSalary}
                    value={formData.housingFundBase}
                    workCity={formData.workCity}
                    onChange={(v) => setFormData({ ...formData, housingFundBase: v })}
                  />
                </>
              )}
            </div>
          )}

          {/* Cumulative tax data for Shenzhen full-time */}
          {isShenzhen && formData.employmentType === '全职' && (
            <div className="space-y-3 p-3 border rounded-md">
              <div className="text-sm font-medium">累计税务数据（截至上月）</div>
              <p className="text-xs text-muted-foreground">
                用于累计预扣个税计算。新员工默认为0，已有员工可参照上月数据填入。
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">累计收入额</Label>
                  <Input
                    type="number"
                    value={formData.prevCumulative?.cumIncome ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      prevCumulative: {
                        ...formData.prevCumulative!,
                        cumIncome: parseFloat(e.target.value) || 0,
                      },
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs">累计减除费用</Label>
                  <Input
                    type="number"
                    value={formData.prevCumulative?.cumDeduction ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      prevCumulative: {
                        ...formData.prevCumulative!,
                        cumDeduction: parseFloat(e.target.value) || 0,
                      },
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs">累计专项扣除</Label>
                  <Input
                    type="number"
                    value={formData.prevCumulative?.cumSpecial ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      prevCumulative: {
                        ...formData.prevCumulative!,
                        cumSpecial: parseFloat(e.target.value) || 0,
                      },
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs">已缴税额</Label>
                  <Input
                    type="number"
                    value={formData.prevCumulative?.taxPaid ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      prevCumulative: {
                        ...formData.prevCumulative!,
                        taxPaid: parseFloat(e.target.value) || 0,
                      },
                    })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sub-component for editing social insurance contribution base.
 * Shows the range hint for the employee's work city and lets the user override
 * the per-employee base (otherwise it defaults to Base salary).
 */
function SocialBaseInput({
  base,
  value,
  workCity,
  onChange,
}: {
  base: number;
  value: number | undefined;
  workCity?: string;
  onChange: (v: number | undefined) => void;
}) {
  const { config } = usePayrollStore();
  // Resolve city config: look up workCity in citySocialConfigs, else use sz* fields
  const cityConf = workCity && config.citySocialConfigs
    ? config.citySocialConfigs.find((c: CityConfig) => c.city === workCity)
    : null;
  const ranges = cityConf
    ? [
        { label: '养老', min: cityConf.pensionBaseMin, max: cityConf.pensionBaseMax },
        { label: '医疗', min: cityConf.medicalBaseMin, max: cityConf.medicalBaseMax },
        { label: '失业', min: cityConf.unemploymentBaseMin, max: cityConf.unemploymentBaseMax },
      ]
    : [
        { label: '养老', min: config.szPensionBaseMin, max: config.szPensionBaseMax },
        { label: '医疗', min: config.szMedicalBaseMin, max: config.szMedicalBaseMax },
        { label: '失业', min: config.szUnemploymentBaseMin, max: config.szUnemploymentBaseMax },
      ];
  const raw = value ?? base;
  const wasClamped = ranges.some(r => raw < r.min || raw > r.max);

  return (
    <div className="p-3 border rounded-md space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="socialBase" className="text-sm font-medium">
            社保缴费基数 (RMB){workCity ? ` — ${workCity}` : ''}
          </Label>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {ranges.map(r => (
              <span key={r.label}>{r.label}: {r.min.toLocaleString()} ~ {r.max.toLocaleString()}</span>
            ))}
          </div>
        </div>
      </div>
      <Input
        id="socialBase"
        type="number"
        placeholder={`默认使用 Base (${base.toLocaleString()})`}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : parseFloat(v) || 0);
        }}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {value === undefined
            ? `当前使用 Base = ${base.toLocaleString()}`
            : `自定义基数 = ${value.toLocaleString()}`}
        </span>
        {wasClamped && (
          <span className="text-orange-600">
            ⚠️ 部分险种超出范围，会自动 clamp
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Sub-component for editing housing fund contribution base.
 * Shows the cap range for the employee's work city and a quick "use Base" reset.
 */
function HousingFundBaseInput({
  base,
  value,
  workCity,
  onChange,
}: {
  base: number;
  value: number | undefined;
  workCity?: string;
  onChange: (v: number | undefined) => void;
}) {
  const { config } = usePayrollStore();
  const cityConf = workCity && config.citySocialConfigs
    ? config.citySocialConfigs.find((c: CityConfig) => c.city === workCity)
    : null;
  const min = cityConf ? cityConf.housingFundBaseMin : config.szHousingFundBaseMin;
  const max = cityConf ? cityConf.housingFundBaseMax : config.szHousingFundBaseMax;
  const raw = value ?? base;
  const effective = Math.min(max, Math.max(min, raw));
  const wasClamped = raw !== effective;

  return (
    <div className="p-3 border rounded-md space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="housingFundBase" className="text-sm font-medium">
            公积金缴费基数 (RMB){workCity ? ` — ${workCity}` : ''}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            范围：{min.toLocaleString()} ~ {max.toLocaleString()} 元
            （{workCity ?? '深圳'}官方上限）
          </p>
        </div>
      </div>
      <Input
        id="housingFundBase"
        type="number"
        placeholder={`默认使用 Base (${base.toLocaleString()})`}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : parseFloat(v) || 0);
        }}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {value === undefined
            ? `当前使用 Base = ${base.toLocaleString()}`
            : `自定义基数 = ${value.toLocaleString()}`}
        </span>
        {wasClamped && (
          <span className="text-orange-600">
            ⚠️ 超出范围，实际按 {effective.toLocaleString()} 计算
          </span>
        )}
      </div>
    </div>
  );
}
