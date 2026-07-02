'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Receipt, Download, Loader2, Eye, EyeOff, Wallet } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatNumber, formatCurrency } from '@/lib/payroll';
import { printPayslip } from '@/lib/payslip-print';
import type { PayrollRecord } from '@/lib/types';

export function MyPayslips() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<PayrollRecord | null>(null);
  const [hidden, setHidden] = useState(false);
  const mask = (v: string | number) => (hidden ? '••••' : v);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<PayrollRecord[]>('/api/records')
      .then((r) => { if (!cancelled) setRecords(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Group by year-month, desc.
  const grouped = useMemo(() => {
    const map = new Map<string, PayrollRecord[]>();
    for (const r of records) {
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-red-600">{error}</CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>暂无工资记录</p>
          <p className="text-xs mt-1">管理员尚未保存您的工资数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              我的工资条（{user?.employeeName ?? user?.username}）
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setHidden((h) => !h)}>
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {hidden ? '显示金额' : '隐藏金额'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {grouped.map(([month, recs]) => (
        <Card key={month}>
          <CardHeader>
            <CardTitle className="text-lg">{month.replace('-', ' 年 ')} 月</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">应计薪资</TableHead>
                  <TableHead className="text-right">五险一金</TableHead>
                  <TableHead className="text-right">个税</TableHead>
                  <TableHead className="text-right">房补</TableHead>
                  <TableHead className="text-right">实发</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recs.map((r) => {
                  const deductions = r.pensionPersonal + r.medicalPersonal + r.unemploymentPersonal + r.housingFundPersonal + r.mpfPersonal;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.month} 月</TableCell>
                      <TableCell className="text-right">{mask(formatCurrency(r.accruedSalary, r.currency))}</TableCell>
                      <TableCell className="text-right text-orange-600">{mask('-' + formatNumber(deductions))}</TableCell>
                      <TableCell className="text-right text-red-600">{mask('-' + formatNumber(r.taxWithheld))}</TableCell>
                      <TableCell className="text-right text-green-600">{mask('+' + formatNumber(r.housingAllowance))}</TableCell>
                      <TableCell className="text-right font-bold">{mask(formatCurrency(r.payableAmount, r.currency))}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              工资条 · {detail?.year} 年 {detail?.month} 月
            </DialogTitle>
          </DialogHeader>
          {detail && <PayslipDetail record={detail} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayslipDetail({ record: r }: { record: PayrollRecord }) {
  const ccy = r.currency;
  const deductions = r.pensionPersonal + r.medicalPersonal + r.unemploymentPersonal + r.housingFundPersonal + r.mpfPersonal;
  const rows: { label: string; value: number; type: 'add' | 'sub' | 'neutral' }[] = [
    { label: '应计薪资', value: r.accruedSalary, type: 'add' },
    { label: '房补', value: r.housingAllowance, type: 'add' },
    { label: '调整项', value: r.adjustment, type: r.adjustment >= 0 ? 'add' : 'sub' },
    { label: '养老保险', value: r.pensionPersonal, type: 'sub' },
    { label: '医疗保险', value: r.medicalPersonal, type: 'sub' },
    { label: '失业保险', value: r.unemploymentPersonal, type: 'sub' },
    { label: '住房公积金', value: r.housingFundPersonal, type: 'sub' },
    { label: 'MPF (香港)', value: r.mpfPersonal, type: 'sub' },
    { label: '个人所得税', value: r.taxWithheld, type: 'sub' },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md">
        <span className="text-sm text-muted-foreground">实发金额</span>
        <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
          {formatCurrency(r.payableAmount, ccy)}
        </span>
      </div>
      <Table>
        <TableBody>
          {rows.filter((x) => x.value !== 0).map((x) => (
            <TableRow key={x.label}>
              <TableCell>{x.label}</TableCell>
              <TableCell className={`text-right font-medium ${
                x.type === 'add' ? 'text-green-600' : x.type === 'sub' ? 'text-red-600' : ''
              }`}>
                {x.type === 'sub' ? '-' : x.type === 'add' ? '+' : ''}{formatNumber(x.value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <div>出勤天数：{r.attendanceDays} 天 · 事假：{r.personalLeaveHours ?? 0} 小时 · </div>
        {r.taxRate !== undefined && (
          <div>累计预扣个税：税率 {((r.taxRate ?? 0) * 100).toFixed(1)}%</div>
        )}
      </div>
      <Button variant="outline" className="w-full" onClick={() => printPayslip(r)}>
        <Download className="h-4 w-4 mr-2" /> 打印 / 保存为 PDF
      </Button>
    </div>
  );
}
