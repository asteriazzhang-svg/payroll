// Shared printable payslip generator.
//
// Used by BOTH the admin payroll calculator and the employee "my payslips"
// view, so the on-screen detail and the exported PDF look identical.
//
// Works from a saved PayrollRecord (which denormalizes employee identity +
// computed results), so it needs no separate Employee/PayrollInput.

import type { PayrollRecord } from './types';

/**
 * Open a new window with a printable payslip and trigger print().
 * The user picks "Save as PDF" from the browser print dialog.
 *
 * `extra` lets callers (e.g. the admin calculator with a live Employee on
 * hand) supply fields that a saved PayrollRecord may not carry — baseSalary,
 * or a department that hasn't been denormalized into the record yet.
 */
export function printPayslip(
  record: PayrollRecord,
  extra?: { baseSalary?: number }
) {
  const sym = record.currency === 'HKD' ? 'HK$' : '¥';
  const fmt = (n: number) =>
    `${sym}${(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtAbs = (n: number) => fmt(Math.abs(n));

  const totalDed =
    record.pensionPersonal + record.medicalPersonal +
    record.unemploymentPersonal + record.housingFundPersonal + record.mpfPersonal;

  // Company-side social insurance / MPF (employer portion) + total employer cost.
  const totalCompanySI =
    record.pensionCompany + record.medicalCompany + record.maternityCompany +
    record.unemploymentCompany + record.workInjuryCompany + record.housingFundCompany +
    record.mpfCompany;
  const companyLines: string[] = [];
  if (record.pensionCompany > 0) companyLines.push(`<tr><td>养老保险（公司）</td><td style="text-align:right">${fmt(record.pensionCompany)}</td></tr>`);
  if (record.medicalCompany > 0) companyLines.push(`<tr><td>医疗保险（公司）</td><td style="text-align:right">${fmt(record.medicalCompany)}</td></tr>`);
  if (record.maternityCompany > 0) companyLines.push(`<tr><td>生育保险（公司）</td><td style="text-align:right">${fmt(record.maternityCompany)}</td></tr>`);
  if (record.unemploymentCompany > 0) companyLines.push(`<tr><td>失业保险（公司）</td><td style="text-align:right">${fmt(record.unemploymentCompany)}</td></tr>`);
  if (record.workInjuryCompany > 0) companyLines.push(`<tr><td>工伤保险（公司）</td><td style="text-align:right">${fmt(record.workInjuryCompany)}</td></tr>`);
  if (record.housingFundCompany > 0) companyLines.push(`<tr><td>住房公积金（公司）</td><td style="text-align:right">${fmt(record.housingFundCompany)}</td></tr>`);
  if (record.mpfCompany > 0) companyLines.push(`<tr><td>MPF 强积金（公司）</td><td style="text-align:right">${fmt(record.mpfCompany)}</td></tr>`);
  const companySection = companyLines.length > 0
    ? `<h3 style="margin-top:20px;border-bottom:1px solid #ccc;padding-bottom:4px">公司缴纳部分（用工成本）</h3>
       <table>
         ${companyLines.join('\n')}
         <tr class="total-row"><td>总用工成本（应计+公司侧）</td><td style="text-align:right">${fmt(record.employerCost)}</td></tr>
       </table>`
    : '';

  const lines: string[] = [];
  lines.push(`<tr><td>应计薪资</td><td style="text-align:right">${fmt(record.accruedSalary)}</td></tr>`);
  if (record.pensionPersonal > 0) lines.push(`<tr><td>养老保险（个人）</td><td style="text-align:right">-${fmtAbs(record.pensionPersonal)}</td></tr>`);
  if (record.medicalPersonal > 0) lines.push(`<tr><td>医疗保险（个人）</td><td style="text-align:right">-${fmtAbs(record.medicalPersonal)}</td></tr>`);
  if (record.unemploymentPersonal > 0) lines.push(`<tr><td>失业保险（个人）</td><td style="text-align:right">-${fmtAbs(record.unemploymentPersonal)}</td></tr>`);
  if (record.housingFundPersonal > 0) lines.push(`<tr><td>住房公积金（个人）</td><td style="text-align:right">-${fmtAbs(record.housingFundPersonal)}</td></tr>`);
  if (record.mpfPersonal > 0) lines.push(`<tr><td>MPF 强积金（个人）</td><td style="text-align:right">-${fmtAbs(record.mpfPersonal)}</td></tr>`);
  if (record.taxWithheld > 0) lines.push(`<tr><td>个人所得税代扣</td><td style="text-align:right">-${fmtAbs(record.taxWithheld)}</td></tr>`);
  if (record.housingAllowance > 0) lines.push(`<tr><td>房补</td><td style="text-align:right">+${fmt(record.housingAllowance)}</td></tr>`);
  if (record.adjustment !== 0) lines.push(`<tr><td>调整项</td><td style="text-align:right">${record.adjustment > 0 ? '+' : '-'}${fmtAbs(record.adjustment)}</td></tr>`);

  // Cumulative IIT section (SZ full-time only).
  let cumSection = '';
  if (record.entity === '豪腾灵动' && record.employmentType === '全职' && record.cumIncome !== undefined) {
    cumSection = `
      <h3 style="margin-top:20px;border-bottom:1px solid #ccc;padding-bottom:4px">个税累计预扣</h3>
      <table>
        <tr><td>累计收入额</td><td style="text-align:right">${fmt(record.cumIncome)}</td></tr>
        <tr><td>累计减除费用</td><td style="text-align:right">${fmt(record.cumDeduction ?? 0)}</td></tr>
        <tr><td>累计专项扣除</td><td style="text-align:right">${fmt(record.cumSpecial ?? 0)}</td></tr>
        <tr><td>累计应纳税所得额</td><td style="text-align:right">${fmt(record.taxableIncome ?? 0)}</td></tr>
        <tr><td>适用税率</td><td style="text-align:right">${((record.taxRate ?? 0) * 100).toFixed(0)}%</td></tr>
        <tr><td>速算扣除数</td><td style="text-align:right">${fmt(record.quickDeduction ?? 0)}</td></tr>
        <tr><td>累计应纳税额</td><td style="text-align:right">${fmt(record.cumTaxPayable ?? 0)}</td></tr>
        <tr><td>已缴税额</td><td style="text-align:right">${fmt(record.prevTaxPaid ?? 0)}</td></tr>
        <tr><td>本月应扣税额</td><td style="text-align:right">${fmt(record.taxWithheld)}</td></tr>
      </table>`;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${record.employeeName} - ${record.year}年${record.month}月薪资单</title>
<style>
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 720px; margin: 30px auto; padding: 0 20px; color: #111; }
  h1 { text-align:center; margin-bottom: 4px; font-size: 20px; }
  .meta { text-align:center; color:#666; font-size:13px; margin-bottom: 24px; }
  .info { display:grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 20px; font-size: 13px; }
  .info div { padding: 4px 0; border-bottom: 1px dashed #eee; }
  table { width:100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 6px 0; }
  td:first-child { color: #555; }
  .total-row td { font-weight: bold; font-size: 16px; padding-top: 10px; border-top: 2px solid #333; }
  .footer { margin-top: 40px; text-align:center; font-size: 11px; color:#999; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { margin: 10mm; } .no-print { display:none; } }
</style></head><body>
<h1>薪资条</h1>
<div class="meta">${record.year} 年 ${record.month} 月 · Hortor Payroll System</div>
<div class="info">
  <div><b>姓名：</b>${record.employeeName}</div>
  <div><b>部门：</b>${record.department ?? '-'}</div>
  <div><b>签约主体：</b>${record.entity}</div>
  <div><b>任职性质：</b>${record.employmentType}</div>
  <div><b>发放币种：</b>${record.currency}</div>
  <div><b>${extra?.baseSalary !== undefined ? 'Base' : '出勤天数'}：</b>${extra?.baseSalary !== undefined ? (extra.baseSalary > 0 ? fmt(extra.baseSalary) : '-') : record.attendanceDays}</div>
  <div><b>事假小时：</b>${record.personalLeaveHours ?? 0}</div>
  <div><b>公积金比例：</b>${((record.housingFundRatio ?? 0) * 100).toFixed(0)}%</div>
  <div><b>五险一金合计：</b>${fmt(totalDed)}</div>
</div>
<h3 style="border-bottom:1px solid #ccc;padding-bottom:4px">计算明细</h3>
<table>
  ${lines.join('\n')}
  <tr class="total-row"><td>应发金额</td><td style="text-align:right">${fmt(record.payableAmount)}</td></tr>
  ${record.payableHKD && record.currency === 'RMB' ? `<tr><td>折算港币</td><td style="text-align:right">HK$${record.payableHKD.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td></tr>` : ''}
</table>
${companySection}
${cumSection}
<div class="footer">本薪资单由系统生成 · 打印日期 ${new Date().toLocaleDateString('zh-CN')}</div>
<div class="no-print" style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:8px 20px;cursor:pointer">打印 / 另存为 PDF</button>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) {
    alert('请允许浏览器弹出窗口以使用打印功能');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try { w.print(); } catch { /* user can click the button */ }
  }, 300);
}
