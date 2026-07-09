'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function CalculationGuide() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>薪资计算说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overview */}
          <section>
            <h3 className="font-semibold text-lg mb-2">计算流程总览</h3>
            <p className="text-sm text-muted-foreground mb-3">
              本系统根据员工的签约主体、任职性质和发放币种，采用不同的计算方法。首先区分员工签约主体（豪腾灵动、豪腾创想、境外主体），然后区分任职性质（全职、外包、实习生），最后确定发放币种（人民币、美元）。
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">豪腾灵动</Badge>
              <Badge variant="default">豪腾创想</Badge>
              <Badge variant="secondary">境外主体</Badge>
              <span className="mx-2">|</span>
              <Badge>全职</Badge>
              <Badge>外包</Badge>
              <Badge>实习生</Badge>
              <span className="mx-2">|</span>
              <Badge>RMB</Badge>
              <Badge>USD</Badge>
            </div>
          </section>

          {/* Shenzhen Full-time */}
          <section className="space-y-3">
            <h3 className="font-semibold text-lg">豪腾灵动 / 豪腾创想 - 全职员工（人民币）</h3>
            <div className="bg-muted/30 rounded-md p-4 space-y-3">
              <div>
                <h4 className="font-medium mb-1">1. 应计薪资</h4>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">应计薪资 = Base ÷ 应出勤天数 × 实际出勤计薪天数</code>
                </p>
                <ul className="text-sm text-muted-foreground mt-1 ml-4 list-disc space-y-1">
                  <li><strong>应出勤天数</strong>：当月标准工作日数，每月单独填写（默认 21.75 天，可按实际月历调整）</li>
                  <li><strong>实际出勤计薪天数</strong>：实际工作天数（事假、缺勤已扣减）</li>
                  <li>例：应出勤 22 天，实际出勤 21 天 → 应计薪资 = Base ÷ 22 × 21</li>
                  <li>默认应出勤天数可在计薪参数中调整</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">2. 五险一金扣除（个人部分）</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  按深圳 2026 政策，<strong>每个险种都有独立的缴费基数上下限</strong>。员工 Base（或社保基数）超过上限按上限算，低于下限按下限算，再乘以个人比例。计算逻辑中四个险种各自 clamp。
                </p>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr className="bg-background">
                        <th className="border p-1.5 text-left">险种</th>
                        <th className="border p-1.5 text-right">基数下限</th>
                        <th className="border p-1.5 text-right">基数上限</th>
                        <th className="border p-1.5 text-right">个人比例</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="border p-1.5">养老保险</td><td className="border p-1.5 text-right">4,775</td><td className="border p-1.5 text-right">27,549</td><td className="border p-1.5 text-right">8%</td></tr>
                      <tr><td className="border p-1.5">医疗保险（一档）</td><td className="border p-1.5 text-right">6,727</td><td className="border p-1.5 text-right">33,633</td><td className="border p-1.5 text-right">2%</td></tr>
                      <tr><td className="border p-1.5">失业保险</td><td className="border p-1.5 text-right">2,520</td><td className="border p-1.5 text-right">44,265</td><td className="border p-1.5 text-right">0.2%</td></tr>
                      <tr><td className="border p-1.5">住房公积金</td><td className="border p-1.5 text-right">4,775</td><td className="border p-1.5 text-right">27,549</td><td className="border p-1.5 text-right">5%-12%</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>示例（Base = 50,000）：</strong>
                </p>
                <ul className="text-xs text-muted-foreground ml-4 list-disc space-y-1">
                  <li>养老：clamp 到上限 27,549 → 扣 2,203.92</li>
                  <li>医疗：50,000 还在 [6,727, 33,633] 范围内 → 扣 1,000</li>
                  <li>失业：50,000 还在 [2,520, 44,265] 范围内 → 扣 100</li>
                  <li>公积金：clamp 到上限 27,549 → 5% 即 1,377.45</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  详情弹窗里会标出哪个险种被 clamp 了（⚠️ 图标）。上下限可在「薪资计算 → 计薪参数」中调整。
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">3. 个人所得税（累计预扣法）</h4>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">
                    累计应纳税所得额 = 累计收入 - 累计减除费用 - 累计专项扣除 - 累计专项附加扣除
                  </code>
                </p>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">
                    本月应扣税 = 累计应纳税额 - 已缴税额
                  </code>
                </p>
                <ul className="text-sm text-muted-foreground mt-1 ml-4 list-disc space-y-1">
                  <li>累计减除费用：5000元/月</li>
                  <li>累计专项扣除：五险一金个人部分累计</li>
                  <li>累计数从本年度在本单位任职起开始计算</li>
                </ul>
                <div className="mt-2 overflow-x-auto">
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr className="bg-background">
                        <th className="border p-1.5 text-left">累计应纳税所得额</th>
                        <th className="border p-1.5 text-right">税率</th>
                        <th className="border p-1.5 text-right">速算扣除数</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="border p-1.5">不超过36,000元</td><td className="border p-1.5 text-right">3%</td><td className="border p-1.5 text-right">0</td></tr>
                      <tr><td className="border p-1.5">36,000-144,000元</td><td className="border p-1.5 text-right">10%</td><td className="border p-1.5 text-right">2,520</td></tr>
                      <tr><td className="border p-1.5">144,000-300,000元</td><td className="border p-1.5 text-right">20%</td><td className="border p-1.5 text-right">16,920</td></tr>
                      <tr><td className="border p-1.5">300,000-420,000元</td><td className="border p-1.5 text-right">25%</td><td className="border p-1.5 text-right">31,920</td></tr>
                      <tr><td className="border p-1.5">420,000-660,000元</td><td className="border p-1.5 text-right">30%</td><td className="border p-1.5 text-right">52,920</td></tr>
                      <tr><td className="border p-1.5">660,000-960,000元</td><td className="border p-1.5 text-right">35%</td><td className="border p-1.5 text-right">85,920</td></tr>
                      <tr><td className="border p-1.5">超过960,000元</td><td className="border p-1.5 text-right">45%</td><td className="border p-1.5 text-right">181,920</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-1">4. 房补</h4>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">房补 = 600 - 迟到天数 × 30</code>
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">5. 应发金额</h4>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">
                    应发金额 = 应计薪资 - 五险一金 - 个税 + 房补 + 调整项
                  </code>
                </p>
              </div>
            </div>
          </section>

          {/* Hong Kong Full-time */}
          <section className="space-y-3">
            <h3 className="font-semibold text-lg">境外主体 - 全职员工（美元）</h3>
            <div className="bg-muted/30 rounded-md p-4 space-y-3">
              <div>
                <h4 className="font-medium mb-1">1. 应计薪资</h4>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">应计薪资 = Base ÷ 30 × 应计薪天数</code>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  应计薪天数 = 当月自然日 - 事假天数（事假算半薪）
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">2. MPF强积金扣除（个人部分）</h4>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">MPF = min(Base × 5%, 1500港币)</code>
                </p>
                <p className="text-sm text-muted-foreground mt-1">1500港币封顶</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">3. 房补</h4>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">房补 = 660 - 迟到天数 × 30</code>
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">4. 应发金额</h4>
                <p className="text-sm">
                  <code className="bg-background px-1.5 py-0.5 rounded">
                    应发金额 = 应计薪资 - MPF + 房补
                  </code>
                </p>
              </div>
            </div>
          </section>

          {/* Interns */}
          <section className="space-y-3">
            <h3 className="font-semibold text-lg">实习生</h3>
            <div className="bg-muted/30 rounded-md p-4 space-y-3">
              <div>
                <h4 className="font-medium mb-1">月薪实习生</h4>
                <ul className="text-sm text-muted-foreground ml-4 list-disc space-y-1">
                  <li>应计薪资 = 月薪（按出勤比例计算）</li>
                  <li>按劳务报酬累计预扣形式计算代扣个税</li>
                  <li>劳务报酬减除费用：收入≤4000元减除800元，收入&gt;4000元减除20%</li>
                </ul>
                <div className="mt-2 overflow-x-auto">
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr className="bg-background">
                        <th className="border p-1.5 text-left">预扣预缴应纳税所得额</th>
                        <th className="border p-1.5 text-right">税率</th>
                        <th className="border p-1.5 text-right">速算扣除数</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="border p-1.5">不超过20,000元</td><td className="border p-1.5 text-right">20%</td><td className="border p-1.5 text-right">0</td></tr>
                      <tr><td className="border p-1.5">20,000-50,000元</td><td className="border p-1.5 text-right">30%</td><td className="border p-1.5 text-right">2,000</td></tr>
                      <tr><td className="border p-1.5">超过50,000元</td><td className="border p-1.5 text-right">40%</td><td className="border p-1.5 text-right">7,000</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-1">日薪实习生</h4>
                <ul className="text-sm text-muted-foreground ml-4 list-disc space-y-1">
                  <li>应计薪资 = 日薪 × 实际出勤天数</li>
                  <li>同样按劳务报酬计算代扣个税</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Outsourcing */}
          <section className="space-y-3">
            <h3 className="font-semibold text-lg">外包</h3>
            <div className="bg-muted/30 rounded-md p-4">
              <p className="text-sm">
                按照合同约定形式计算薪资。在薪资计算页面直接输入应付金额即可。
              </p>
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <h3 className="font-semibold text-lg">使用说明</h3>
            <ul className="text-sm text-muted-foreground ml-4 list-disc space-y-1">
              <li>所有数据保存在浏览器本地存储中，清除浏览器数据将丢失</li>
              <li>系统已预置2026年5月员工数据，可直接开始计算</li>
              <li>累计税务数据需在员工管理中手动维护（参照上月数据）</li>
              <li>公积金比例可在员工管理中设置默认值，也可在薪资计算中按月调整</li>
              <li>支持导出CSV格式，可用Excel打开</li>
            </ul>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
