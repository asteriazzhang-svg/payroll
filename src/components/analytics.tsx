'use client';

import { useState, useMemo } from 'react';
import { usePayrollStore } from '@/lib/store';
import type { PayrollRecord } from '@/lib/types';
import {
  payableInCNY, payableInHKD, cnyFactor, safeNum, effectiveRate,
} from '@/lib/exchange';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Wallet, Users, Building2, Briefcase, Layers, Trophy, AlertTriangle, CalendarRange } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { formatNumber, formatCurrency } from '@/lib/payroll';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function Analytics() {
  const store = usePayrollStore();
  // Guard: savedRecords may briefly be a non-object during store init/hydration.
  const savedRecords: Record<string, PayrollRecord> =
    store.savedRecords && typeof store.savedRecords === 'object' ? store.savedRecords : {};
  const config = store.config;

  // Live exchange rate (1 RMB = rate HKD), falls back to config value.
  const fx = useExchangeRate(config.exchangeRate);
  const rate = fx.rate;

  // Default selector: current config year/month, but if there's a saved month use that
  const initialMonth = useMemo(() => {
    const all = Object.values(savedRecords);
    if (all.length === 0) return { year: config.year, month: config.month };
    const latest = all.reduce((a, b) => {
      if (b.year > a.year) return b;
      if (b.year === a.year && b.month > a.month) return b;
      return a;
    });
    return { year: latest.year, month: latest.month };
  }, [savedRecords, config.year, config.month]);

  const [selectedYear, setSelectedYear] = useState<number>(initialMonth.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth.month);

  // All available year-months (sorted desc)
  const availableMonths = useMemo(() => {
    const set = new Map<string, { year: number; month: number }>();
    Object.values(savedRecords).forEach((r) => {
      set.set(`${r.year}-${r.month}`, { year: r.year, month: r.month });
    });
    return Array.from(set.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [savedRecords]);

  const years = useMemo(() => {
    const ys = new Set<number>([selectedYear]);
    availableMonths.forEach((m) => ys.add(m.year));
    return Array.from(ys).sort((a, b) => b - a);
  }, [availableMonths, selectedYear]);

  // Records for the selected month
  const records = useMemo(() => {
    return Object.entries(savedRecords)
      .map(([key, record]) => ({ key, record }))
      .filter((item) => item.record && item.record.year === selectedYear && item.record.month === selectedMonth);
  }, [savedRecords, selectedYear, selectedMonth]);

  const hasData = records.length > 0;

  return (
    <div className="space-y-4">
      {/* Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">年</Label>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">月</Label>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} 月</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (availableMonths.length > 0) {
                  setSelectedYear(availableMonths[0].year);
                  setSelectedMonth(availableMonths[0].month);
                }
              }}
              disabled={availableMonths.length === 0}
            >
              跳到最新月份
            </Button>
            <div className="flex-1" />
            <div className="text-sm text-muted-foreground text-right">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4" />
                汇率 1 RMB = <strong className="text-foreground">{rate.toFixed(4)}</strong> HKD
                <Badge variant={fx.source === 'live' ? 'default' : 'secondary'} className="text-[10px]">
                  {fx.source === 'live' ? '实时' : '配置回退'}
                </Badge>
              </div>
              {fx.fetchedAt && (
                <div className="text-[10px] mt-0.5">数据更新: {fx.fetchedAt}</div>
              )}
              {fx.error && (
                <div className="text-[10px] mt-0.5 text-orange-600">实时获取失败，已用配置值 ({fx.error})</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasData && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>该月份还没有保存的薪资记录</p>
            <p className="text-xs mt-1">先到「薪资计算」页算完后点「保存记录」</p>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* === 1. Overview === */}
          <OverviewSection records={records} rate={rate} />

          {/* === 2. Trend (last 6 months) === */}
          <TrendSection savedRecords={savedRecords} rate={rate} />

          {/* === 3. By Department === */}
          <DepartmentSection records={records} rate={rate} />

          {/* === 4. By Entity === */}
          <EntitySection records={records} rate={rate} />

          {/* === 5. By Employment Type === */}
          <EmploymentTypeSection records={records} rate={rate} />

          {/* === 6. By Currency === */}
          <CurrencySection records={records} rate={rate} />

          {/* === 7. Cost Composition === */}
          <CostCompositionSection records={records} rate={rate} />

          {/* === 8. Top Earners === */}
          <TopEarnersSection records={records} rate={rate} />

          {/* === 9. Anomalies === */}
          <AnomalySection records={records} />
        </>
      )}
    </div>
  );
}

// ============================================================
// 1. Overview
// ============================================================
function OverviewSection({ records, rate }: { records: { record: PayrollRecord }[]; rate: number }) {
  const summary = useMemo(() => computeOverall(records, rate), [records, rate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          整体概览
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Metric label="总用工成本 (RMB等值)" value={`¥${formatNumber(summary.employerCostTotalCNY)}`} sub={`折算汇率 ${summary.exchangeRate}`} highlight />
          <Metric label="应计薪资合计" value={`¥${formatNumber(summary.accruedTotalCNY)}`} />
          <Metric label="公司侧五险一金/MPF" value={`¥${formatNumber(summary.companySITotalCNY)}`} sub="单位部分" />
          <Metric label="个人五险一金/MPF" value={`¥${formatNumber(summary.deductionsTotalCNY)}`} sub="个人部分" />
          <Metric label="个税代扣合计" value={`¥${formatNumber(summary.taxTotalCNY)}`} />
          <Metric label="房补合计" value={`¥${formatNumber(summary.mealTotalCNY)}`} />
          <Metric label="人数" value={String(summary.count)} />
          <Metric label="平均应发" value={`¥${formatNumber(summary.avgPayableCNY)}`} />
          <Metric label="中位数" value={`¥${formatNumber(summary.medianPayableCNY)}`} />
          <Metric label="最高" value={`¥${formatNumber(summary.maxPayableCNY)}`} />
          <Metric label="最低" value={`¥${formatNumber(summary.minPayableCNY)}`} />
          <Metric label="应发合计" value={`¥${formatNumber(summary.payableTotalCNY)}`} />
          <Metric label="应发人民币总计" value={`¥${formatNumber(summary.payableRMB)}`} sub="RMB 员工" />
          <Metric label="应发港币总计" value={`HK$${formatNumber(summary.payableHKD)}`} sub="HKD 员工" />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`p-3 border rounded-md ${highlight ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-blue-700 dark:text-blue-300' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

interface OverallSummary {
  count: number;
  accruedTotalCNY: number;
  deductionsTotalCNY: number;
  companySITotalCNY: number; // company-side social insurance + housing fund + MPF
  taxTotalCNY: number;
  mealTotalCNY: number;
  payableTotalCNY: number;
  employerCostTotalCNY: number; // accrued + company-side SI = total employer cost
  payableRMB: number;
  payableHKD: number;
  exchangeRate: number;
  avgPayableCNY: number;
  medianPayableCNY: number;
  maxPayableCNY: number;
  minPayableCNY: number;
  grossCostCNY: number;
  takeHomeRate: number;
}

function computeOverall(records: { record: PayrollRecord }[], rate: number): OverallSummary {
  const r = records.map((x) => x.record);
  if (r.length === 0) {
    return {
      count: 0, accruedTotalCNY: 0, deductionsTotalCNY: 0, companySITotalCNY: 0, taxTotalCNY: 0, mealTotalCNY: 0,
      payableTotalCNY: 0, employerCostTotalCNY: 0, payableRMB: 0, payableHKD: 0, exchangeRate: effectiveRate(rate),
      avgPayableCNY: 0, medianPayableCNY: 0, maxPayableCNY: 0, minPayableCNY: 0,
      grossCostCNY: 0, takeHomeRate: 0,
    };
  }
  let accruedTotalCNY = 0, deductionsTotalCNY = 0, companySITotalCNY = 0, taxTotalCNY = 0, mealTotalCNY = 0;
  let payableTotalCNY = 0, employerCostTotalCNY = 0, payableRMB = 0, payableHKD = 0;
  const payablesCNY: number[] = [];
  for (const rec of r) {
    const cny = payableInCNY(rec, rate);
    payablesCNY.push(cny);
    payableTotalCNY += cny;
    payableHKD += payableInHKD(rec, rate);
    if (rec.currency === 'RMB') payableRMB += safeNum(rec.payableAmount);
    const factor = cnyFactor(rec, rate);
    accruedTotalCNY += safeNum(rec.accruedSalary) * factor;
    deductionsTotalCNY += (safeNum(rec.pensionPersonal) + safeNum(rec.medicalPersonal) + safeNum(rec.unemploymentPersonal) + safeNum(rec.housingFundPersonal) + safeNum(rec.mpfPersonal)) * factor;
    companySITotalCNY += (safeNum(rec.pensionCompany) + safeNum(rec.medicalCompany) + safeNum(rec.unemploymentCompany) + safeNum(rec.maternityCompany) + safeNum(rec.workInjuryCompany) + safeNum(rec.housingFundCompany) + safeNum(rec.mpfCompany)) * factor;
    taxTotalCNY += safeNum(rec.taxWithheld) * factor;
    mealTotalCNY += safeNum(rec.housingAllowance) * factor;
    employerCostTotalCNY += safeNum(rec.employerCost) * factor;
  }
  payablesCNY.sort((a, b) => a - b);
  const median = payablesCNY[Math.floor(payablesCNY.length / 2)];
  const sum = payablesCNY.reduce((a, b) => a + b, 0);
  return {
    count: r.length,
    accruedTotalCNY,
    deductionsTotalCNY,
    companySITotalCNY,
    taxTotalCNY,
    mealTotalCNY,
    payableTotalCNY,
    employerCostTotalCNY,
    payableRMB,
    payableHKD,
    exchangeRate: effectiveRate(rate),
    avgPayableCNY: sum / payablesCNY.length,
    medianPayableCNY: median,
    maxPayableCNY: payablesCNY[payablesCNY.length - 1],
    minPayableCNY: payablesCNY[0],
    grossCostCNY: accruedTotalCNY + deductionsTotalCNY,
    takeHomeRate: accruedTotalCNY > 0 ? payableTotalCNY / accruedTotalCNY : 0,
  };
}

// ============================================================
// 2. Trend (last 6 months)
// ============================================================
function TrendSection({ savedRecords, rate }: { savedRecords: Record<string, PayrollRecord>; rate: number }) {
  const trend = useMemo(() => {
    const byMonth = new Map<string, { count: number; payable: number; deductions: number; tax: number; accrued: number }>();
    for (const rec of Object.values(savedRecords)) {
      const key = `${rec.year}-${String(rec.month).padStart(2, '0')}`;
      const cny = payableInCNY(rec, rate);
      const factor = cnyFactor(rec, rate);
      const existing = byMonth.get(key) ?? { count: 0, payable: 0, deductions: 0, tax: 0, accrued: 0 };
      existing.count++;
      existing.payable += cny;
      existing.deductions += (safeNum(rec.pensionPersonal) + safeNum(rec.medicalPersonal) + safeNum(rec.unemploymentPersonal) + safeNum(rec.housingFundPersonal) + safeNum(rec.mpfPersonal)) * factor;
      existing.tax += safeNum(rec.taxWithheld) * factor;
      existing.accrued += safeNum(rec.accruedSalary) * factor;
      byMonth.set(key, existing);
    }
    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, v]) => ({
        month: month.replace('-', '/'),
        ...v,
      }));
  }, [savedRecords, rate]);

  if (trend.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          月度趋势（最近 {trend.length} 个月）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v: number) => formatNumber(v)} />
            <Legend />
            <Line type="monotone" dataKey="accrued" name="应计薪资" stroke="#3b82f6" />
            <Line type="monotone" dataKey="payable" name="应发金额" stroke="#10b981" />
            <Line type="monotone" dataKey="deductions" name="五险一金" stroke="#f59e0b" />
            <Line type="monotone" dataKey="tax" name="个税" stroke="#ef4444" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 3. By Department
// ============================================================
function DepartmentSection({ records, rate }: { records: { record: PayrollRecord }[]; rate: number }) {
  const byDept = useMemo(() => aggregateBy(records, (r) => r.department ?? '未分配', rate), [records, rate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          按部门分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDept} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={80} />
              <Tooltip formatter={(v: number) => formatNumber(v)} />
              <Bar dataKey="payable" name="用工成本 (RMB等值)" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>部门</TableHead>
                <TableHead className="text-right">人数</TableHead>
                <TableHead className="text-right">用工成本</TableHead>
                <TableHead className="text-right">平均</TableHead>
                <TableHead className="text-right">占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDept.map((d) => (
                <TableRow key={d.name}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-right">{d.count}</TableCell>
                  <TableCell className="text-right">{formatNumber(d.payable)}</TableCell>
                  <TableCell className="text-right">{formatNumber(d.avgPayable)}</TableCell>
                  <TableCell className="text-right">{d.share.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 4. By Entity
// ============================================================
function EntitySection({ records, rate }: { records: { record: PayrollRecord }[]; rate: number }) {
  const byEntity = useMemo(() => aggregateBy(records, (r) => r.entity, rate), [records, rate]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          按签约主体分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byEntity} dataKey="payable" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name} ${(e.share).toFixed(0)}%`}>
                {byEntity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatNumber(v)} />
            </PieChart>
          </ResponsiveContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>主体</TableHead>
                <TableHead className="text-right">人数</TableHead>
                <TableHead className="text-right">用工成本</TableHead>
                <TableHead className="text-right">平均</TableHead>
                <TableHead className="text-right">占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byEntity.map((d) => (
                <TableRow key={d.name}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-right">{d.count}</TableCell>
                  <TableCell className="text-right">{formatNumber(d.payable)}</TableCell>
                  <TableCell className="text-right">{formatNumber(d.avgPayable)}</TableCell>
                  <TableCell className="text-right">{d.share.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 5. By Employment Type
// ============================================================
function EmploymentTypeSection({ records, rate }: { records: { record: PayrollRecord }[]; rate: number }) {
  const byType = useMemo(() => aggregateBy(records, (r) => r.employmentType, rate), [records, rate]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          按任职性质分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byType} dataKey="payable" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name} ${(e.share).toFixed(0)}%`}>
                {byType.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatNumber(v)} />
            </PieChart>
          </ResponsiveContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任职性质</TableHead>
                <TableHead className="text-right">人数</TableHead>
                <TableHead className="text-right">用工成本</TableHead>
                <TableHead className="text-right">平均</TableHead>
                <TableHead className="text-right">占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byType.map((d) => (
                <TableRow key={d.name}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-right">{d.count}</TableCell>
                  <TableCell className="text-right">{formatNumber(d.payable)}</TableCell>
                  <TableCell className="text-right">{formatNumber(d.avgPayable)}</TableCell>
                  <TableCell className="text-right">{d.share.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 6. By Currency
// ============================================================
function CurrencySection({ records, rate }: { records: { record: PayrollRecord }[]; rate: number }) {
  const byCcy = useMemo(() => {
    const r = records.map((x) => x.record);
    const rmb = r.filter((x) => x.currency === 'RMB');
    const hkd = r.filter((x) => x.currency === 'HKD');
    return [
      { name: '人民币 (RMB)', 人数: rmb.length, 应发: rmb.reduce((s, x) => s + safeNum(x.payableAmount), 0), color: '#3b82f6' },
      { name: '港币 (HKD)', 人数: hkd.length, 应发: hkd.reduce((s, x) => s + safeNum(x.payableAmount), 0), color: '#10b981' },
    ];
  }, [records]);
  const total = byCcy.reduce((s, x) => s + x.应发, 0);
  const r = effectiveRate(rate);
  const totalCNY = byCcy[0].应发 + byCcy[1].应发 / r;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          按发放币种分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {byCcy.map((c) => (
            <div key={c.name} className="p-3 border rounded-md">
              <div className="text-xs text-muted-foreground">{c.name}</div>
              <div className="text-lg font-bold">
                {c.name.includes('RMB') ? '¥' : 'HK$'} {formatNumber(c.应发)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.人数} 人 · 占比 {total > 0 ? ((c.应发 / total) * 100).toFixed(1) : '0'}%
              </div>
            </div>
          ))}
          <div className="p-3 border rounded-md bg-blue-50 dark:bg-blue-950/30 border-blue-200">
            <div className="text-xs text-muted-foreground">合计 (折算 RMB)</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
              ¥ {formatNumber(totalCNY)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">汇率 1 RMB = {r.toFixed(4)} HKD</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 7. Cost Composition
// ============================================================
function CostCompositionSection({ records, rate }: { records: { record: PayrollRecord }[]; rate: number }) {
  const composition = useMemo(() => {
    const r = records.map((x) => x.record);
    let accrued = 0, deductions = 0, tax = 0, meal = 0, adjustment = 0;
    for (const rec of r) {
      const factor = cnyFactor(rec, rate);
      accrued += safeNum(rec.accruedSalary) * factor;
      deductions += (safeNum(rec.pensionPersonal) + safeNum(rec.medicalPersonal) + safeNum(rec.unemploymentPersonal) + safeNum(rec.housingFundPersonal) + safeNum(rec.mpfPersonal)) * factor;
      tax += safeNum(rec.taxWithheld) * factor;
      meal += safeNum(rec.housingAllowance) * factor;
      adjustment += safeNum(rec.adjustment) * factor;
    }
    const total = accrued + deductions + tax + meal + adjustment;
    if (total <= 0) return [];
    const items = [
      { name: '应计薪资', value: accrued, share: (accrued / total) * 100 },
      { name: '五险一金/MPF', value: deductions, share: (deductions / total) * 100 },
      { name: '个税', value: tax, share: (tax / total) * 100 },
      { name: '房补', value: meal, share: (meal / total) * 100 },
    ];
    if (Math.abs(adjustment) > 0.01) {
      items.push({ name: '调整项', value: adjustment, share: (adjustment / total) * 100 });
    }
    return items;
  }, [records, rate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          成本构成（折算 RMB）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={composition} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name} ${e.share.toFixed(1)}%`}>
                {composition.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatNumber(v)} />
            </PieChart>
          </ResponsiveContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>科目</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="text-right">占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {composition.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{formatNumber(c.value)}</TableCell>
                  <TableCell className="text-right">{c.share.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 8. Top Earners
// ============================================================
function TopEarnersSection({ records, rate }: { records: { record: PayrollRecord }[]; rate: number }) {
  const top = useMemo(() => {
    const r = records.map((x) => x.record);
    return r
      .map((rec) => ({
        ...rec,
        costCNY: safeNum(rec.employerCost) * cnyFactor(rec, rate),
      }))
      .sort((a, b) => b.costCNY - a.costCNY)
      .slice(0, 10);
  }, [records, rate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Top 10 用工成本最高员工（折算 RMB）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>主体/性质</TableHead>
              <TableHead className="text-right">原币应发</TableHead>
              <TableHead className="text-right">用工成本(RMB)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.map((rec, i) => (
              <TableRow key={rec.employeeId}>
                <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{rec.employeeName}</TableCell>
                <TableCell>{rec.department ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{rec.entity}</Badge>
                  <span className="text-xs text-muted-foreground ml-1">{rec.employmentType}</span>
                </TableCell>
                <TableCell className="text-right">
                  {rec.currency === 'HKD' ? 'HK$' : '¥'}{formatNumber(rec.payableAmount)}
                </TableCell>
                <TableCell className="text-right font-bold">¥{formatNumber(rec.costCNY)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 9. Anomalies (highest deductions / tax)
// ============================================================
function AnomalySection({ records }: { records: { record: PayrollRecord }[] }) {
  const anomalies = useMemo(() => {
    const r = records.map((x) => x.record);
    // Highest effective tax rate (tax / accrued)
    const withRate = r
      .filter((rec) => safeNum(rec.accruedSalary) > 0)
      .map((rec) => {
        const deductions = safeNum(rec.pensionPersonal) + safeNum(rec.medicalPersonal) + safeNum(rec.unemploymentPersonal) + safeNum(rec.housingFundPersonal) + safeNum(rec.mpfPersonal);
        return {
          rec,
          effectiveTaxRate: safeNum(rec.taxWithheld) / rec.accruedSalary,
          deductionRate: deductions / rec.accruedSalary,
        };
      })
      .sort((a, b) => b.effectiveTaxRate - a.effectiveTaxRate)
      .slice(0, 5);
    return withRate;
  }, [records]);

  if (anomalies.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          高税率员工（个税/应计 占比 Top 5）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead className="text-right">应计薪资</TableHead>
              <TableHead className="text-right">五险一金</TableHead>
              <TableHead className="text-right">个税</TableHead>
              <TableHead className="text-right">扣除率</TableHead>
              <TableHead className="text-right">税率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anomalies.map(({ rec, effectiveTaxRate, deductionRate }) => {
              const deductions = safeNum(rec.pensionPersonal) + safeNum(rec.medicalPersonal) + safeNum(rec.unemploymentPersonal) + safeNum(rec.housingFundPersonal) + safeNum(rec.mpfPersonal);
              return (
                <TableRow key={rec.employeeId}>
                  <TableCell className="font-medium">{rec.employeeName}</TableCell>
                  <TableCell className="text-right">{formatNumber(rec.accruedSalary)}</TableCell>
                  <TableCell className="text-right text-orange-600">
                    {deductions.toFixed(0)}
                    <span className="text-xs text-muted-foreground ml-1">({(deductionRate * 100).toFixed(1)}%)</span>
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatNumber(rec.taxWithheld)}
                    <span className="text-xs text-muted-foreground ml-1">({(effectiveTaxRate * 100).toFixed(2)}%)</span>
                  </TableCell>
                  <TableCell className="text-right text-orange-600">{(deductionRate * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right text-red-600">{(effectiveTaxRate * 100).toFixed(2)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Helpers
// ============================================================
interface BucketStat {
  name: string;
  count: number;
  payable: number;       // total payable (CNY equivalent)
  accrued: number;       // total accrued (CNY equivalent)
  deductions: number;    // total deductions (CNY equivalent)
  avgPayable: number;
  share: number;         // percent of total payable
}

function aggregateBy(records: { record: PayrollRecord }[], keyFn: (r: PayrollRecord) => string, rate: number): BucketStat[] {
  const map = new Map<string, BucketStat>();
  let total = 0;
  for (const { record } of records) {
    const cny = payableInCNY(record, rate);
    const factor = cnyFactor(record, rate);
    const employerCost = safeNum(record.employerCost) * factor;
    const accrued = safeNum(record.accruedSalary) * factor;
    const deductions = (safeNum(record.pensionPersonal) + safeNum(record.medicalPersonal) + safeNum(record.unemploymentPersonal) + safeNum(record.housingFundPersonal) + safeNum(record.mpfPersonal)) * factor;
    const key = keyFn(record);
    const existing = map.get(key) ?? {
      name: key, count: 0, payable: 0, accrued: 0, deductions: 0,
      avgPayable: 0, share: 0,
    };
    existing.count++;
    // "payable" in buckets now represents employer cost (用工成本) per the
    // analytics-by-cost requirement.
    existing.payable += employerCost;
    existing.accrued += accrued;
    existing.deductions += deductions;
    map.set(key, existing);
    total += employerCost;
  }
  const result = Array.from(map.values()).map((b) => ({
    ...b,
    avgPayable: b.count > 0 ? b.payable / b.count : 0,
    share: total > 0 ? (b.payable / total) * 100 : 0,
  }));
  result.sort((a, b) => b.payable - a.payable);
  return result;
}
