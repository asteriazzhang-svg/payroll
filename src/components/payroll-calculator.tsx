'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePayrollStore, calculateEmployeePayroll } from '@/lib/store';
import { api } from '@/lib/api-client';
import type { Employee, PayrollInput } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calculator, Settings, Download, ChevronDown, ChevronRight, Save, Printer } from 'lucide-react';
import { formatCurrency, formatNumber, getScheduledDays } from '@/lib/payroll';
import { printPayslip } from '@/lib/payslip-print';

const HOUSING_FUND_RATIOS = [0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.12];

export function PayrollCalculator() {
  const {
    employees,
    config,
    updateConfig,
    payrollInputs,
    updatePayrollInput,
    initPayrollInput,
    savedRecords,
    saveRecords,
  } = usePayrollStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterEmploymentType, setFilterEmploymentType] = useState<string>('all');

  // Initialize payroll inputs for all active employees
  const activeEmployees = useMemo(() => {
    const year = config.year;
    const month = config.month;
    // Period start = first day of the month, period end = last day of the month
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0); // last day of month

    return employees.filter((e) => {
      // Show all employees regardless of status — the user wants to see
      // payroll snapshots for everyone (在职 or 离职).
      if (filterEntity !== 'all' && e.entity !== filterEntity) return false;
      if (filterEmploymentType !== 'all' && e.employmentType !== filterEmploymentType) return false;
      // Join date: must have joined by the last day of the period
      if (e.joinDate) {
        const joinD = new Date(e.joinDate);
        if (!isNaN(joinD.getTime()) && joinD > periodEnd) return false;
      }
      // Leave date: must not have left before the first day of the period
      if (e.leaveDate) {
        const leaveD = new Date(e.leaveDate);
        if (!isNaN(leaveD.getTime()) && leaveD < periodStart) return false;
      }
      return true;
    });
  }, [employees, filterEntity, filterEmploymentType, config.year, config.month]);

  // Fetch per-month tax deductions for the current year+month (for 6 个专项附加扣除).
  const [taxDeductions, setTaxDeductions] = useState<Record<string, {
    taxChildEducation: number;
    taxContinuingEducation: number;
    taxHousingLoanInterest: number;
    taxHousingRent: number;
    taxElderlySupport: number;
    taxInfantCare: number;
  }>>({});
  useEffect(() => {
    let mounted = true;
    api<any[]>(`/api/tax-deductions?year=${config.year}&month=${config.month}`)
      .then((data) => {
        if (!mounted) return;
        const map: typeof taxDeductions = {};
        for (const r of data) {
          map[r.employeeId] = {
            taxChildEducation: r.taxChildEducation,
            taxContinuingEducation: r.taxContinuingEducation,
            taxHousingLoanInterest: r.taxHousingLoanInterest,
            taxHousingRent: r.taxHousingRent,
            taxElderlySupport: r.taxElderlySupport,
            taxInfantCare: r.taxInfantCare,
          };
        }
        setTaxDeductions(map);
      })
      .catch(() => { if (mounted) setTaxDeductions({}); });
    return () => { mounted = false; };
  }, [config.year, config.month]);

  // Calculate payroll for all active employees
  const results = useMemo(() => {
    return activeEmployees.map((employee) => {
      // Apply per-month tax deductions to the in-memory employee copy so the
      // engine picks them up. Falls back to employee.taxXxx for legacy data.
      const dedup = taxDeductions[employee.id];
      const effectiveEmployee: Employee = dedup
        ? {
            ...employee,
            taxChildEducation: dedup.taxChildEducation,
            taxContinuingEducation: dedup.taxContinuingEducation,
            taxHousingLoanInterest: dedup.taxHousingLoanInterest,
            taxHousingRent: dedup.taxHousingRent,
            taxElderlySupport: dedup.taxElderlySupport,
            taxInfantCare: dedup.taxInfantCare,
          }
        : employee;
      let input = payrollInputs[employee.id];
      if (!input) {
        // Auto-initialize with default values; use 2026 statutory scheduled days if applicable.
        const defaultScheduled = employee.entity === '境外主体'
          ? config.hkWorkingDays
          : getScheduledDays(config.year, config.month);
        const defaultAttendance = employee.entity === '境外主体' ? config.hkWorkingDays : defaultScheduled;
        input = {
          employeeId: employee.id,
          year: config.year,
          month: config.month,
          scheduledDays: defaultScheduled,
          attendanceDays: defaultAttendance,
          personalLeaveHours: 0,
          sickLeaveDays: 0,
          adjustment: 0,
          bonus: 0,
          housingFundRatio: employee.defaultHousingFundRatio,
        };
      }
      const record = calculateEmployeePayroll(effectiveEmployee, input, config, savedRecords);
      return { employee, input, record };
    });
  }, [activeEmployees, payrollInputs, config, savedRecords, taxDeductions]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalAccrued = 0;
    let totalDeductions = 0;
    let totalTax = 0;
    let totalMeal = 0;
    let totalPayableRMB = 0;
    let totalPayableHKD = 0;
    let totalEmployerCostRMB = 0;
    let totalEmployerCostHKD = 0;
    for (const { record } of results) {
      totalAccrued += record.accruedSalary;
      totalDeductions += record.pensionPersonal + record.medicalPersonal +
        record.unemploymentPersonal + record.housingFundPersonal + record.mpfPersonal;
      totalTax += record.taxWithheld;
      totalMeal += record.housingAllowance;
      if (record.currency === 'RMB') {
        totalPayableRMB += record.payableAmount;
        totalEmployerCostRMB += record.employerCost;
      } else {
        totalPayableHKD += record.payableAmount;
        totalEmployerCostHKD += record.employerCost;
      }
    }
    return { totalAccrued, totalDeductions, totalTax, totalMeal, totalPayableRMB, totalPayableHKD, totalEmployerCostRMB, totalEmployerCostHKD };
  }, [results]);

  const [saving, setSaving] = useState(false);
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const payload = activeEmployees.map((employee) => {
      const input = payrollInputs[employee.id] ?? {
          employeeId: employee.id,
          year: config.year,
          month: config.month,
          scheduledDays: employee.entity === '境外主体' ? config.hkWorkingDays : getScheduledDays(config.year, config.month),
          attendanceDays: employee.entity === '境外主体' ? config.hkWorkingDays : getScheduledDays(config.year, config.month),
          personalLeaveHours: 0,
          sickLeaveDays: 0,
          adjustment: 0,
          bonus: 0,
          housingFundRatio: employee.defaultHousingFundRatio,
        };
        return { employeeId: employee.id, input };
      });
      await saveRecords(payload);
      alert(`已保存 ${payload.length} 条薪资记录`);
    } catch (e) {
      alert('保存失败：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    // Export to CSV
    const headers = [
      '姓名', '部门', '签约主体', '任职性质', '币种',
      'Base', '应出勤天数', '计薪出勤天数', '事假(小时)', '医疗期病假(天)',
      '应计薪资', '养老个人', '医疗个人', '失业个人', '公积金个人', 'MPF个人',
      '个税代扣', '房补', '奖金', '调整项', '应发金额', '应发港币',
    ];
    const rows = results.map(({ employee, input, record }) => [
      employee.name,
      employee.department ?? '',
      employee.entity,
      employee.employmentType,
      employee.currency,
      employee.baseSalary,
      input.scheduledDays ?? (employee.entity === '境外主体' ? config.hkWorkingDays : getScheduledDays(config.year, config.month)),
      input.attendanceDays,
      input.personalLeaveHours ?? 0,
      input.sickLeaveDays ?? 0,
      record.accruedSalary.toFixed(2),
      record.pensionPersonal.toFixed(2),
      record.medicalPersonal.toFixed(2),
      record.unemploymentPersonal.toFixed(2),
      record.housingFundPersonal.toFixed(2),
      record.mpfPersonal.toFixed(2),
      record.taxWithheld.toFixed(2),
      record.housingAllowance.toFixed(2),
      record.adjustment.toFixed(2),
      record.payableAmount.toFixed(2),
      record.payableHKD?.toFixed(2) ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    // Add BOM for Excel
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `薪资计算_${config.year}年${config.month}月.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Period Settings Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>计薪年月：</Label>
              <Input
                type="number"
                value={config.year}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) updateConfig({ year: v });
                }}
                className="w-24"
              />
              <span>年</span>
              <Input
                type="number"
                value={config.month}
                min={1}
                max={12}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) updateConfig({ month: Math.max(1, Math.min(12, v)) });
                }}
                className="w-24"
              />
              <span>月</span>
            </div>
            <div className="flex items-center gap-2">
              <Label>主体筛选：</Label>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部主体</SelectItem>
                  <SelectItem value="豪腾灵动">豪腾灵动</SelectItem>
                  <SelectItem value="豪腾创想">豪腾创想</SelectItem>
                  <SelectItem value="境外主体">境外主体</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>性质筛选：</Label>
              <Select value={filterEmploymentType} onValueChange={setFilterEmploymentType}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部性质</SelectItem>
                  <SelectItem value="全职">全职</SelectItem>
                  <SelectItem value="实习生">实习生</SelectItem>
                  <SelectItem value="外包">外包</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-1" />
              计薪参数
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              导出CSV
            </Button>
            <Button onClick={handleSaveAll} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? '保存中...' : '保存记录'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">应计薪资合计</div>
            <div className="text-2xl font-bold">{formatNumber(totals.totalAccrued)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">五险一金/MPF合计</div>
            <div className="text-2xl font-bold">{formatNumber(totals.totalDeductions)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">个税代扣合计</div>
            <div className="text-2xl font-bold">{formatNumber(totals.totalTax)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">应发金额</div>
            <div className="text-2xl font-bold space-y-1">
              {totals.totalPayableRMB > 0 && (
                <div className="text-blue-600">¥{formatNumber(totals.totalPayableRMB)}</div>
              )}
              {totals.totalPayableHKD > 0 && (
                <div className="text-green-600">HK${formatNumber(totals.totalPayableHKD)}</div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-300 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">总用工成本</div>
            <div className="text-2xl font-bold space-y-1">
              {totals.totalEmployerCostRMB > 0 && (
                <div className="text-blue-700 dark:text-blue-300">¥{formatNumber(totals.totalEmployerCostRMB)}</div>
              )}
              {totals.totalEmployerCostHKD > 0 && (
                <div className="text-blue-700 dark:text-blue-300">HK${formatNumber(totals.totalEmployerCostHKD)}</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">应计+公司侧五险一金</div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            薪资计算明细 ({results.length} 人)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">姓名</TableHead>
                  <TableHead className="min-w-[110px]">主体</TableHead>
                  <TableHead className="min-w-[90px]">性质</TableHead>
                  <TableHead className="text-right min-w-[120px]">Base</TableHead>
                  <TableHead className="text-center min-w-[110px]">应出勤天数</TableHead>
                  <TableHead className="text-center min-w-[110px]">计薪出勤天数</TableHead>
                  <TableHead className="text-center min-w-[110px]">事假 (小时)</TableHead>
                  <TableHead className="text-center min-w-[110px]">医疗期病假 (天)</TableHead>
                  <TableHead className="text-center min-w-[110px]">公积金</TableHead>
                  <TableHead className="text-center min-w-[130px]">调整项</TableHead>
                  <TableHead className="text-right min-w-[130px]">应计薪资</TableHead>
                  <TableHead className="text-right min-w-[120px]">房补</TableHead>
                  <TableHead className="text-right min-w-[120px]">奖金</TableHead>
                  <TableHead className="text-right min-w-[130px]">五险一金</TableHead>
                  <TableHead className="text-right min-w-[120px]">个税</TableHead>
                  <TableHead className="text-right min-w-[140px]">应发金额</TableHead>
                  <TableHead className="text-center min-w-[90px]">详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(({ employee, input, record }) => (
                  <PayrollRow
                    key={employee.id}
                    employee={employee}
                    input={input}
                    record={record}
                    config={config}
                    onInputChange={(updates) => updatePayrollInput(employee.id, updates)}
                    onInitInput={() => initPayrollInput(employee.id)}
                    onShowDetail={() => setDetailEmployeeId(employee.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          {results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              暂无在职员工，请先在员工管理中添加
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Detail Dialog */}
      <DetailDialog
        employeeId={detailEmployeeId}
        onClose={() => setDetailEmployeeId(null)}
      />
    </div>
  );
}

interface PayrollRowProps {
  employee: Employee;
  input: PayrollInput;
  record: ReturnType<typeof calculateEmployeePayroll>;
  config: ReturnType<typeof usePayrollStore.getState>['config'];
  onInputChange: (updates: Partial<PayrollInput>) => void;
  onInitInput: () => void;
  onShowDetail: () => void;
}

function PayrollRow({
  employee,
  input,
  record,
  config,
  onInputChange,
  onInitInput,
  onShowDetail,
}: PayrollRowProps) {
  const isMainland = employee.entity === '豪腾灵动' || employee.entity === '豪腾创想';
  const isHK = employee.entity === '境外主体';
  const isOutsource = employee.employmentType === '外包';
  const isIntern = employee.employmentType === '实习生';
  const isDailyIntern = isIntern && employee.internSalaryType === '日薪';

  const totalDeductions =
    record.pensionPersonal + record.medicalPersonal +
    record.unemploymentPersonal + record.housingFundPersonal + record.mpfPersonal;

  // 主体 badge 颜色
  const entityVariant =
    employee.entity === '豪腾灵动' ? 'default' :
    employee.entity === '豪腾创想' ? 'default' :
    employee.entity === '境外主体' ? 'secondary' : 'outline';

  return (
    <TableRow>
      <TableCell className="sticky left-0 bg-background z-10 font-medium min-w-[120px]">
        {employee.name}
      </TableCell>
      {/* 主体列 */}
      <TableCell className="min-w-[110px]">
        <Badge variant={entityVariant} className="w-fit text-xs">
          {employee.entity}
        </Badge>
      </TableCell>
      {/* 性质列 */}
      <TableCell className="min-w-[90px]">
        <span className="text-xs text-muted-foreground">{employee.employmentType}</span>
      </TableCell>
      <TableCell className="text-right min-w-[120px]">
        {employee.baseSalary > 0 ? formatNumber(employee.baseSalary) : '-'}
        {employee.dailyRate ? `${formatNumber(employee.dailyRate)}/天` : ''}
      </TableCell>
      {/* 应出勤天数 */}
      <TableCell className="min-w-[110px]">
        <Input
          type="number"
          step="0.5"
          value={input?.scheduledDays ?? (isHK ? config.hkWorkingDays : config.szWorkingDays)}
          onChange={(e) => onInputChange({ scheduledDays: parseFloat(e.target.value) || 0 })}
          className="w-24 h-8 text-center"
          title="应出勤天数（该月标准工作日数）"
        />
      </TableCell>
      {/* 计薪出勤天数 — 实际出勤 > 应出勤 时红字提示 */}
      <TableCell className="min-w-[110px]">
        <Input
          type="number"
          step="0.5"
          value={input?.attendanceDays ?? 0}
          onChange={(e) => onInputChange({ attendanceDays: parseFloat(e.target.value) || 0 })}
          className={`w-24 h-8 text-center ${record.overAttend ? 'text-red-600 border-red-500' : ''}`}
          title={record.overAttend
            ? `⚠️ 计薪出勤(${input?.attendanceDays}) 大于应出勤(${record.scheduledDays ?? '-'})，应计薪资已封顶到 Base。实际出勤天数可能有误。`
            : '计薪出勤天数'}
        />
      </TableCell>
      {/* 事假 (小时) */}
      <TableCell className="min-w-[110px]">
        <Input
          type="number"
          step="0.5"
          value={input?.personalLeaveHours ?? 0}
          onChange={(e) => onInputChange({ personalLeaveHours: parseFloat(e.target.value) || 0 })}
          className="w-24 h-8 text-center"
          title="事假(小时) — 每 1 小时扣减 1/8/应出勤天数*Base"
        />
      </TableCell>
      {/* 医疗期病假 (天) */}
      <TableCell className="min-w-[110px]">
        <Input
          type="number"
          step="0.5"
          value={input?.sickLeaveDays ?? 0}
          onChange={(e) => onInputChange({ sickLeaveDays: parseFloat(e.target.value) || 0 })}
          className="w-24 h-8 text-center"
          title="医疗期病假(天) — 每 1 天扣减 1/应出勤天数*Base + 1/应出勤天数*当地最低工资*80%"
        />
      </TableCell>
      <TableCell className="min-w-[110px]">
        {isMainland && !isIntern && !isOutsource ? (
          <Select
            value={String(input?.housingFundRatio ?? employee.defaultHousingFundRatio)}
            onValueChange={(v) => onInputChange({ housingFundRatio: parseFloat(v) })}
          >
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOUSING_FUND_RATIOS.map((r) => (
                <SelectItem key={r} value={String(r)}>{(r * 100).toFixed(0)}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="min-w-[130px]">
        <Input
          type="number"
          step="0.01"
          value={input?.adjustment ?? 0}
          onChange={(e) => onInputChange({ adjustment: parseFloat(e.target.value) || 0 })}
          className="w-24 h-8 text-right"
          title="调整项（直接加到应发金额，可正可负）"
        />
      </TableCell>
      <TableCell className="text-right font-medium min-w-[130px]">{formatNumber(record.accruedSalary)}</TableCell>
      <TableCell className="text-right text-green-600 min-w-[120px]">
        {record.housingAllowance > 0 ? `+${formatNumber(record.housingAllowance)}` : '-'}
      </TableCell>
      <TableCell className="min-w-[120px]">
        <Input
          type="number"
          step="0.01"
          value={input?.bonus ?? 0}
          onChange={(e) => onInputChange({ bonus: parseFloat(e.target.value) || 0 })}
          className="w-24 h-8 text-right"
          title="本月奖金（影响应税收入额和个税）"
        />
      </TableCell>
      <TableCell className="text-right text-red-600 min-w-[130px]">
        {totalDeductions > 0 ? `-${formatNumber(totalDeductions)}` : '-'}
      </TableCell>
      <TableCell className="text-right text-red-600 min-w-[120px]">
        {record.taxWithheld > 0 ? `-${formatNumber(record.taxWithheld)}` : '-'}
      </TableCell>
      <TableCell className="text-right font-bold min-w-[140px]">
        {employee.currency === 'HKD' ? 'HK$' : '¥'}
        {formatNumber(record.payableAmount)}
      </TableCell>
      <TableCell className="text-center min-w-[90px]">
        <Button variant="ghost" size="icon" onClick={onShowDetail} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { config, updateConfig } = usePayrollStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>计薪参数设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Section 1: Basic */}
          <div>
            <div className="font-medium text-sm mb-2">基础参数</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>深圳应计薪天数</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={config.szWorkingDays}
                  onChange={(e) => updateConfig({ szWorkingDays: parseFloat(e.target.value) || 21.75 })}
                />
                <p className="text-xs text-muted-foreground mt-1">标准为21.75天</p>
              </div>
              <div>
                <Label>香港应计薪天数</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={config.hkWorkingDays}
                  onChange={(e) => updateConfig({ hkWorkingDays: parseFloat(e.target.value) || 30 })}
                />
                <p className="text-xs text-muted-foreground mt-1">标准为30天</p>
              </div>
              <div>
                <Label>房补 (RMB)</Label>
                <Input
                  type="number"
                  value={config.housingAllowance}
                  onChange={(e) => updateConfig({ housingAllowance: parseFloat(e.target.value) || 2000 })}
                />
              </div>
              <div>
                <Label>汇率 (RMB→HKD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.exchangeRate}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    // Keep the parsed value when valid; otherwise retain the
                    // current rate rather than silently resetting to a hardcoded
                    // magic number (the old behavior lost user input on empty).
                    updateConfig({ exchangeRate: Number.isFinite(v) && v > 0 ? v : config.exchangeRate });
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Shenzhen social insurance / housing fund base caps */}
          <div>
            <div className="font-medium text-sm mb-1">深圳社保 / 公积金 缴费基数上下限</div>
            <p className="text-xs text-muted-foreground mb-3">
              员工 Base 超过上限按上限算，低于下限按下限算。默认是 2026 年深圳官方公布值，会随政策调整。
            </p>
            <div className="space-y-3">
              <BaseRangeRow
                label="养老保险"
                rateNote="个人 8%"
                min={config.szPensionBaseMin}
                max={config.szPensionBaseMax}
                onMinChange={(v) => updateConfig({ szPensionBaseMin: v })}
                onMaxChange={(v) => updateConfig({ szPensionBaseMax: v })}
              />
              <BaseRangeRow
                label="医疗保险"
                rateNote="个人 2%（一档）"
                min={config.szMedicalBaseMin}
                max={config.szMedicalBaseMax}
                onMinChange={(v) => updateConfig({ szMedicalBaseMin: v })}
                onMaxChange={(v) => updateConfig({ szMedicalBaseMax: v })}
              />
              <BaseRangeRow
                label="失业保险"
                rateNote="个人 0.2%"
                min={config.szUnemploymentBaseMin}
                max={config.szUnemploymentBaseMax}
                onMinChange={(v) => updateConfig({ szUnemploymentBaseMin: v })}
                onMaxChange={(v) => updateConfig({ szUnemploymentBaseMax: v })}
              />
              <BaseRangeRow
                label="住房公积金"
                rateNote="个人 5%-12%"
                min={config.szHousingFundBaseMin}
                max={config.szHousingFundBaseMax}
                onMinChange={(v) => updateConfig({ szHousingFundBaseMin: v })}
                onMaxChange={(v) => updateConfig({ szHousingFundBaseMax: v })}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BaseRangeRow({
  label,
  rateNote,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  rateNote: string;
  min: number;
  max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{rateNote}</div>
      </div>
      <div>
        <Label className="text-xs">下限</Label>
        <Input
          type="number"
          value={min ?? 0}
          onChange={(e) => onMinChange(parseFloat(e.target.value) || 0)}
        />
      </div>
      <div>
        <Label className="text-xs">上限</Label>
        <Input
          type="number"
          value={max ?? 0}
          onChange={(e) => onMaxChange(parseFloat(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

function DetailDialog({ employeeId, onClose }: { employeeId: string | null; onClose: () => void }) {
  const { employees, payrollInputs, config, savedRecords } = usePayrollStore();
  const employee = employees.find((e) => e.id === employeeId);

  // Auto-fabricate a default PayrollInput if none exists yet, so the dialog
  // always opens with the same defaults the calculator table uses.
  const input = useMemo(() => {
    if (!employeeId || !employee) return null;
    const existing = payrollInputs[employeeId];
    if (existing) return existing;
    const defaultScheduled = employee.entity === '境外主体'
      ? config.hkWorkingDays
      : getScheduledDays(config.year, config.month);
    return {
      employeeId,
      year: config.year,
      month: config.month,
      scheduledDays: defaultScheduled,
      attendanceDays: defaultScheduled,
      personalLeaveHours: 0,
      sickLeaveDays: 0,
      adjustment: 0,
      bonus: 0,
      housingFundRatio: employee.defaultHousingFundRatio,
    };
  }, [employeeId, employee, payrollInputs, config]);

  if (!employee || !input) return null;

  const record = calculateEmployeePayroll(employee, input, config, savedRecords);

  // Compute clamp status for each SZ insurance (so the UI can show a ⚠️ hint)
  // when an insurance base was clamped to min or max.
  const isMainlandFullTime = (employee.entity === '豪腾灵动' || employee.entity === '豪腾创想') && employee.employmentType === '全职';
  const exchangeRate = config.exchangeRate;
  const baseInCalcCurrency =
    employee.currency === 'RMB'
      ? (employee.socialBase ?? employee.baseSalary)
      : ((employee.socialBase ?? employee.baseSalary) / exchangeRate);
  const pensionWasClamped =
    isMainlandFullTime &&
    (baseInCalcCurrency < config.szPensionBaseMin || baseInCalcCurrency > config.szPensionBaseMax);
  const medicalWasClamped =
    isMainlandFullTime &&
    (baseInCalcCurrency < config.szMedicalBaseMin || baseInCalcCurrency > config.szMedicalBaseMax);
  const unemploymentWasClamped =
    isMainlandFullTime &&
    (baseInCalcCurrency < config.szUnemploymentBaseMin || baseInCalcCurrency > config.szUnemploymentBaseMax);
  const housingFundBaseInCalc = employee.housingFundBase ?? baseInCalcCurrency;
  const housingFundWasClamped =
    isMainlandFullTime &&
    (housingFundBaseInCalc < config.szHousingFundBaseMin || housingFundBaseInCalc > config.szHousingFundBaseMax);

  return (
    <Dialog open={!!employeeId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>{employee.name} - 薪资计算详情</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => printPayslip(record, { baseSalary: employee.baseSalary })}
            >
              <Printer className="h-4 w-4 mr-1" />
              打印 / 导出 PDF
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          {/* Employee Info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>部门：{employee.department ?? '-'}</div>
            <div>签约主体：{employee.entity}</div>
            <div>任职性质：{employee.employmentType}</div>
            <div>币种：{employee.currency}</div>
            <div>Base：{employee.baseSalary > 0 ? formatCurrency(employee.baseSalary, employee.currency) : '-'}</div>
            {employee.dailyRate && <div>日薪：{formatCurrency(employee.dailyRate, employee.currency)}</div>}
          </div>

          {/* Calculation Breakdown */}
          <div className="space-y-2">
            <div className="font-medium border-b pb-2">计算明细</div>
            <CalcRow label="应计薪资" value={record.accruedSalary} currency={employee.currency} />
            {record.pensionPersonal > 0 && (
              <CalcRowWithClampHint
                label="养老保险（个人）"
                value={-record.pensionPersonal}
                currency={employee.currency}
                wasClamped={pensionWasClamped}
              />
            )}
            {record.medicalPersonal > 0 && (
              <CalcRowWithClampHint
                label="医疗保险（个人）"
                value={-record.medicalPersonal}
                currency={employee.currency}
                wasClamped={medicalWasClamped}
              />
            )}
            {record.unemploymentPersonal > 0 && (
              <CalcRowWithClampHint
                label="失业保险（个人）"
                value={-record.unemploymentPersonal}
                currency={employee.currency}
                wasClamped={unemploymentWasClamped}
              />
            )}
            {record.housingFundPersonal > 0 && (
              <CalcRowWithClampHint
                label="住房公积金（个人）"
                value={-record.housingFundPersonal}
                currency={employee.currency}
                wasClamped={housingFundWasClamped}
              />
            )}
            {record.mpfPersonal > 0 && (
              <CalcRow label="MPF强积金（个人）" value={-record.mpfPersonal} currency={employee.currency} />
            )}
            {record.taxWithheld > 0 && (
              <CalcRow label="个人所得税代扣" value={-record.taxWithheld} currency={employee.currency} />
            )}
            {record.housingAllowance > 0 && (
              <CalcRow label="房补" value={record.housingAllowance} currency={employee.currency} />
            )}
            {record.adjustment !== 0 && (
              <CalcRow label="调整项" value={record.adjustment} currency={employee.currency} />
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>应发金额</span>
              <span className={employee.currency === 'HKD' ? 'text-green-600' : 'text-blue-600'}>
                {formatCurrency(record.payableAmount, employee.currency)}
              </span>
            </div>
            {record.payableHKD && employee.currency === 'RMB' && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>折算港币</span>
                <span>HK${formatNumber(record.payableHKD)}</span>
              </div>
            )}
          </div>

          {/* Tax Details for mainland full-time */}
          {(employee.entity === '豪腾灵动' || employee.entity === '豪腾创想') && employee.employmentType === '全职' && record.cumIncome !== undefined && (
            <div className="space-y-2">
              <div className="font-medium border-b pb-2">个税累计预扣详情</div>
              <CalcRow label="累计收入额" value={record.cumIncome!} />
              <CalcRow label="累计减除费用" value={record.cumDeduction!} />
              <CalcRow label="累计专项扣除" value={record.cumSpecial!} />
              <CalcRow label="累计应纳税所得额" value={record.taxableIncome!} />
              <div className="flex justify-between text-sm">
                <span>适用税率</span>
                <span>{((record.taxRate ?? 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>速算扣除数</span>
                <span>{formatNumber(record.quickDeduction ?? 0)}</span>
              </div>
              <CalcRow label="累计应纳税额" value={record.cumTaxPayable!} />
              <CalcRow label="已缴税额" value={record.prevTaxPaid!} />
              <CalcRow label="本月应扣税额" value={record.taxWithheld} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CalcRow({ label, value, currency = 'RMB' }: { label: string; value: number; currency?: string }) {
  const isNegative = value < 0;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={isNegative ? 'text-red-600' : ''}>
        {value < 0 ? '-' : ''}{currency === 'HKD' ? 'HK$' : '¥'}{formatNumber(Math.abs(value))}
      </span>
    </div>
  );
}

function CalcRowWithClampHint({
  label,
  value,
  currency = 'RMB',
  wasClamped,
}: {
  label: string;
  value: number;
  currency?: string;
  wasClamped: boolean;
}) {
  const isNegative = value < 0;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">
        {label}
        {wasClamped && (
          <span className="ml-1.5 text-orange-600 text-xs" title="该险种基数被上下限 clamp">
            ⚠️ 已 clamp
          </span>
        )}
      </span>
      <span className={isNegative ? 'text-red-600' : ''}>
        {value < 0 ? '-' : ''}{currency === 'HKD' ? 'HK$' : '¥'}{formatNumber(Math.abs(value))}
      </span>
    </div>
  );
}
