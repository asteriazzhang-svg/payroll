'use client';

import { useState, useMemo } from 'react';
import { usePayrollStore } from '@/lib/store';
import type { PayrollRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Trash2, Eye, Download } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/payroll';

export function PayrollHistory() {
  const { savedRecords: rawSavedRecords, deleteRecord, deleteRecordsByMonth } = usePayrollStore();
  // Guard against non-object during store init.
  const savedRecords: Record<string, PayrollRecord> =
    rawSavedRecords && typeof rawSavedRecords === 'object' ? rawSavedRecords : {};
  const [filterValue, setFilterValue] = useState<string>('all');
  const [detailRecord, setDetailRecord] = useState<PayrollRecord | null>(null);

  // Convert savedRecords to sorted array
  const records = useMemo(() => {
    return Object.entries(savedRecords)
      .map(([key, record]) => ({ key, record }))
      .sort((a, b) => {
        if (a.record.year !== b.record.year) return b.record.year - a.record.year;
        if (a.record.month !== b.record.month) return b.record.month - a.record.month;
        return a.record.employeeName.localeCompare(b.record.employeeName);
      });
  }, [savedRecords]);

  // Get unique year-months with counts
  const yearMonths = useMemo(() => {
    const map = new Map<string, { year: number; month: number; count: number; total: number }>();
    records.forEach(({ record }) => {
      const key = `${record.year}-${record.month}`;
      if (!map.has(key)) {
        map.set(key, { year: record.year, month: record.month, count: 0, total: 0 });
      }
      const e = map.get(key)!;
      e.count++;
      e.total += record.payableAmount;
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [records]);

  // Filter
  const filteredRecords = useMemo(() => {
    if (filterValue === 'all') return records;
    return records.filter(
      (r) => `${r.record.year}-${r.record.month}` === filterValue
    );
  }, [records, filterValue]);

  // Totals
  const totals = useMemo(() => {
    let accrued = 0, deductions = 0, tax = 0, meal = 0;
    let payableRMB = 0, payableHKD = 0;
    for (const { record } of filteredRecords) {
      accrued += record.accruedSalary;
      deductions += record.pensionPersonal + record.medicalPersonal +
        record.unemploymentPersonal + record.housingFundPersonal + record.mpfPersonal;
      tax += record.taxWithheld;
      meal += record.housingAllowance;
      if (record.currency === 'RMB') payableRMB += record.payableAmount;
      else payableHKD += record.payableAmount;
    }
    return { accrued, deductions, tax, meal, payableRMB, payableHKD };
  }, [filteredRecords]);

  const handleDelete = async (key: string, name: string, year: number, month: number) => {
    if (confirm(`确定删除 ${year}年${month}月 ${name} 的记录吗？\n删除后下个月计算时会丢失累计基准，可能导致个税计算错误。`)) {
      try {
        await deleteRecord(key);
      } catch (e) {
        alert('删除失败：' + (e instanceof Error ? e.message : String(e)));
      }
    }
  };

  const handleDeleteMonth = async () => {
    if (filterValue === 'all') return;
    const [y, m] = filterValue.split('-').map(Number);
    const count = filteredRecords.length;
    if (count === 0) return;
    if (confirm(
      `确定要删除 ${y}年${m}月的全部 ${count} 条记录吗？\n\n` +
      `警告：这会清除该月所有员工的薪资快照。\n` +
      `如果有员工以该月记录作为下月累计基准，请谨慎操作。`
    )) {
      try {
        const removed = await deleteRecordsByMonth(y, m);
        alert(`已删除 ${removed} 条 ${y}年${m}月 记录`);
      } catch (e) {
        alert('删除失败：' + (e instanceof Error ? e.message : String(e)));
      }
    }
  };

  const handleExport = () => {
    const headers = [
      '年月', '姓名', '签约主体', '任职性质', '币种',
      '应计薪资', '房补', '奖金',
      '养老个人', '医疗个人', '失业个人', '公积金个人', 'MPF个人',
      '个税代扣', '调整项', '应发金额',
      '累计收入额', '累计减除费用', '累计专项扣除', '累计应纳税所得额',
    ];
    const rows = filteredRecords.map(({ record }) => [
      `${record.year}-${record.month}`,
      record.employeeName,
      record.entity,
      record.employmentType,
      record.currency,
      record.accruedSalary.toFixed(2),
      record.housingAllowance.toFixed(2),
      (record.bonus ?? 0).toFixed(2),
      record.pensionPersonal.toFixed(2),
      record.medicalPersonal.toFixed(2),
      record.unemploymentPersonal.toFixed(2),
      record.housingFundPersonal.toFixed(2),
      record.mpfPersonal.toFixed(2),
      record.taxWithheld.toFixed(2),
      record.adjustment.toFixed(2),
      record.payableAmount.toFixed(2),
      record.cumIncome?.toFixed(2) ?? '',
      record.cumDeduction?.toFixed(2) ?? '',
      record.cumSpecial?.toFixed(2) ?? '',
      record.taxableIncome?.toFixed(2) ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filterLabel = filterValue === 'all' ? '全部' : filterValue.replace('-', '年') + '月';
    link.download = `薪资历史_${filterLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              薪资历史记录 ({records.length} 条)
            </CardTitle>
            <div className="flex items-center gap-2">
              {filterValue !== 'all' && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteMonth}
                  disabled={filteredRecords.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除当月 ({filteredRecords.length} 条)
                </Button>
              )}
              <Button variant="outline" onClick={handleExport} disabled={filteredRecords.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                导出CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <Label>筛选月份：</Label>
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部月份</SelectItem>
                {yearMonths.map((ym) => (
                  <SelectItem
                    key={`${ym.year}-${ym.month}`}
                    value={`${ym.year}-${ym.month}`}
                  >
                    {ym.year}年{ym.month}月 · {ym.count}人
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterValue !== 'all' && (
              <span className="text-sm text-muted-foreground">
                {filteredRecords.length} 条记录
              </span>
            )}
          </div>

          {/* Totals */}
          {filteredRecords.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-3 bg-muted/30 rounded-md">
              <div>
                <div className="text-xs text-muted-foreground">应计薪资合计</div>
                <div className="text-base font-bold">{formatNumber(totals.accrued)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">五险一金/MPF</div>
                <div className="text-base font-bold text-red-600">{formatNumber(totals.deductions)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">个税代扣</div>
                <div className="text-base font-bold text-red-600">{formatNumber(totals.tax)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">房补</div>
                <div className="text-base font-bold text-green-600">{formatNumber(totals.meal)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">应发合计</div>
                <div className="text-base font-bold space-y-0.5">
                  {totals.payableRMB > 0 && (
                    <div className="text-blue-600">¥{formatNumber(totals.payableRMB)}</div>
                  )}
                  {totals.payableHKD > 0 && (
                    <div className="text-green-600">HK${formatNumber(totals.payableHKD)}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">年月</TableHead>
                  <TableHead className="min-w-[120px]">姓名</TableHead>
                  <TableHead className="min-w-[140px]">主体/性质</TableHead>
                  <TableHead className="text-right min-w-[120px]">应计薪资</TableHead>
                  <TableHead className="text-right min-w-[100px]">房补</TableHead>
                  <TableHead className="text-right min-w-[100px]">奖金</TableHead>
                  <TableHead className="text-right min-w-[120px]">五险一金</TableHead>
                  <TableHead className="text-right min-w-[100px]">个税</TableHead>
                  <TableHead className="text-right min-w-[100px]">调整项</TableHead>
                  <TableHead className="text-right min-w-[130px]">应发金额</TableHead>
                  <TableHead className="text-center min-w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map(({ key, record }) => {
                  const totalDed =
                    record.pensionPersonal + record.medicalPersonal +
                    record.unemploymentPersonal + record.housingFundPersonal + record.mpfPersonal;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        {record.year}年{record.month}月
                      </TableCell>
                      <TableCell>{record.employeeName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={
                              record.entity === '豪腾灵动' ? 'default' :
                              record.entity === '境外主体' ? 'secondary' : 'outline'
                            }
                            className="w-fit"
                          >
                            {record.entity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {record.employmentType} · {record.currency}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(record.accruedSalary)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {record.housingAllowance > 0 ? `+${formatNumber(record.housingAllowance)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {record.bonus && record.bonus > 0 ? `+${formatNumber(record.bonus)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {totalDed > 0 ? `-${formatNumber(totalDed)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {record.taxWithheld > 0 ? `-${formatNumber(record.taxWithheld)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.adjustment !== 0 ? formatNumber(record.adjustment) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {record.currency === 'HKD' ? 'HK$' : '¥'}
                        {formatNumber(record.payableAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailRecord(record)}
                          title="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(key, record.employeeName, record.year, record.month)}
                          title="删除记录"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {records.length === 0
                ? '暂无保存的记录。计算薪资后点击「保存记录」即可存到这里。'
                : '当前筛选条件下无记录'}
            </div>
          )}
        </CardContent>
      </Card>

      <HistoryDetailDialog record={detailRecord} onClose={() => setDetailRecord(null)} />
    </div>
  );
}

function HistoryDetailDialog({
  record,
  onClose,
}: {
  record: PayrollRecord | null;
  onClose: () => void;
}) {
  if (!record) return null;

  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {record.year}年{record.month}月 · {record.employeeName} · 薪资详情
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-2 text-sm p-3 bg-muted/30 rounded-md">
            <div>签约主体：{record.entity}</div>
            <div>任职性质：{record.employmentType}</div>
            <div>发放币种：{record.currency}</div>
            <div>出勤天数：{record.attendanceDays}</div>
            <div>事假小时：{record.personalLeaveHours ?? 0}</div>
            <div></div>
            {record.housingFundRatio !== undefined && (
              <div>公积金比例：{(record.housingFundRatio * 100).toFixed(0)}%</div>
            )}
          </div>

          {/* Calculation Breakdown */}
          <div className="space-y-2">
            <div className="font-medium border-b pb-2">计算明细</div>
            <CalcRow label="应计薪资" value={record.accruedSalary} currency={record.currency} />
            {record.pensionPersonal > 0 && (
              <CalcRow label="养老保险（个人）" value={-record.pensionPersonal} currency={record.currency} />
            )}
            {record.medicalPersonal > 0 && (
              <CalcRow label="医疗保险（个人）" value={-record.medicalPersonal} currency={record.currency} />
            )}
            {record.unemploymentPersonal > 0 && (
              <CalcRow label="失业保险（个人）" value={-record.unemploymentPersonal} currency={record.currency} />
            )}
            {record.housingFundPersonal > 0 && (
              <CalcRow label="住房公积金（个人）" value={-record.housingFundPersonal} currency={record.currency} />
            )}
            {record.mpfPersonal > 0 && (
              <CalcRow label="MPF强积金（个人）" value={-record.mpfPersonal} currency={record.currency} />
            )}
            {record.taxWithheld > 0 && (
              <CalcRow label="个人所得税代扣" value={-record.taxWithheld} currency={record.currency} />
            )}
            {record.housingAllowance > 0 && (
              <CalcRow label="房补" value={record.housingAllowance} currency={record.currency} />
            )}
            {record.adjustment !== 0 && (
              <CalcRow label="调整项" value={record.adjustment} currency={record.currency} />
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>应发金额</span>
              <span className={record.currency === 'HKD' ? 'text-green-600' : 'text-blue-600'}>
                {formatCurrency(record.payableAmount, record.currency)}
              </span>
            </div>
            {record.payableHKD && record.currency === 'RMB' && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>折算港币</span>
                <span>HK${formatNumber(record.payableHKD)}</span>
              </div>
            )}
          </div>

          {/* Cumulative (Shenzhen full-time only) */}
          {record.entity === '豪腾灵动' &&
            record.employmentType === '全职' &&
            record.cumIncome !== undefined && (
              <div className="space-y-2">
                <div className="font-medium border-b pb-2">个税累计预扣（截至本月）</div>
                <CalcRow label="累计收入额" value={record.cumIncome} currency={record.currency} />
                <CalcRow label="累计减除费用" value={record.cumDeduction!} currency={record.currency} />
                <CalcRow label="累计专项扣除" value={record.cumSpecial!} currency={record.currency} />
                <CalcRow label="累计应纳税所得额" value={record.taxableIncome!} currency={record.currency} />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">适用税率</span>
                  <span>{((record.taxRate ?? 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">速算扣除数</span>
                  <span>{formatNumber(record.quickDeduction ?? 0)}</span>
                </div>
                <CalcRow label="累计应纳税额" value={record.cumTaxPayable!} currency={record.currency} />
                <CalcRow label="本月应扣税额" value={record.taxWithheld} currency={record.currency} />
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CalcRow({
  label,
  value,
  currency = 'RMB',
}: {
  label: string;
  value: number;
  currency?: string;
}) {
  const isNegative = value < 0;
  const symbol = currency === 'HKD' ? 'HK$' : '¥';
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={isNegative ? 'text-red-600' : ''}>
        {value < 0 ? '-' : ''}
        {symbol}
        {formatNumber(Math.abs(value))}
      </span>
    </div>
  );
}