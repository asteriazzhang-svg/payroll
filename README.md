# 薪酬计算系统 (Payroll Calculator)

> 本地化的小型薪酬计算工具 — 数据全部保存在浏览器 localStorage，无需后端，无需联网。

支持功能：

- **多种员工类型**：深圳全职 / 香港全职 / 实习生（月薪+日薪）/ 外包
- **社保公积金**（深圳 2026 政策）：养老 / 医疗 / 失业 / 公积金各自独立的缴费基数上下限，clamp 行为在 UI 里可视化（⚠️ 标记）
- **累计预扣个税**：上月记录自动续算，可手动覆盖，可跨年自动重置
- **跨币种发放**：员工币种是单位（决定 base/餐补/应发），主体是逻辑（决定走五险还是 MPF）
- **香港 MPF**：5% 个人扣除，1500 HKD / 等值 RMB 上限
- **薪资历史记录**：按月保存的快照，可以批量删除整个月
- **个税累计管理**：单独 Tab 手动调整每位员工的累计基数
- **导出**：CSV（计算结果 + 历史记录）、PDF 工资条（浏览器原生打印）

## 技术栈

- [Next.js 15](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) (Radix UI + Tailwind 组件库)
- [Zustand](https://zustand-demo.pmnd.rs/) (状态管理 + localStorage 持久化)
- [Prisma](https://www.prisma.io/) (ORM，仅 schema 文件保留，未接入)

## 快速开始

需要 Node.js 18+（推荐 20 / 22）。

```bash
# 安装依赖
npm install

# 开发模式（默认 http://localhost:3000）
npm run dev

# 生产构建并启动
npm run build
npm start
```

> 注意：`npm run build` 默认配置为 `output: "standalone"`（Node.js 服务模式）。  
> 如需导出纯静态站点（部署到 CDN / GitHub Pages 等），编辑 `next.config.ts`：
> ```ts
> output: "export"
> images: { unoptimized: true }
> trailingSlash: false
> ```
> 然后 `npm run build` 会输出 `out/` 目录。

## 使用说明

打开应用后，5 个 Tab：

1. **薪资计算**：所有在职员工的当月薪资计算。明细行可改出勤/事假/迟到/公积金比例/调整项；点击行末的箭头看详情；顶部可设计薪参数（含五险一金上下限、餐补、汇率等）；右上「保存记录」按月存档。
2. **历史记录**：所有保存过的快照。点眼睛看详情、点垃圾桶删单条、顶部选月份批量删整月、右上导出 CSV。
3. **个税管理**：每个深圳全职员工一行，显示当前累计基数 + 数据来源（手动/上月记录/员工档案/已重置）。点编辑手动调整。优先级：**手动设置 > 上月保存记录 > 员工档案 prevCumulative > 重置**。
4. **员工管理**：CRUD 员工档案。每个员工可独立设置：签约主体（深圳/香港/外包）、发放币种（RMB/HKD）、Base 薪资、社保基数、公积金基数、公积金比例（5%-12%）、个税专项附加扣除、是否发放餐补、上月底累计个税。
5. **计算说明**：公式 + 上下限表 + clamp 示例。

## 数据模型与计算规则

详见 [`src/lib/payroll.ts`](./src/lib/payroll.ts) 和 [「计算说明」Tab](./src/components/calculation-guide.tsx)。

要点：

- 应计薪资 = Base / 应计薪天数 × 出勤天数。SZ 应计薪天数 = 21.75，HK = 30。
- 五险一金按各自险种的上下限 clamp 到基数，再乘个人比例。养老 8%、医疗 2%、失业 0.2%、公积金 5-12%。
- 个税用累计预扣法：累计收入 − 累计减除费用 − 累计专项扣除 − 累计专项附加扣除 = 累计应纳税所得额，按月查税率表。
- 月度 5000 减除费用。
- MPF：5% × Base，HKD 上限 1500，RMB 上限 ≈ 1401.87（按汇率换算）。
- 日薪实习生免税。
- 跨年（Dec → Jan）累计自动 reset。

## 数据存储

所有用户数据（员工、薪资输入、计算历史、计薪参数）都存在浏览器 localStorage 的 `payroll-storage` key 里。

- 同一浏览器、同一域名下持久化
- 清除浏览器数据会丢全部记录，**建议每月用「导出 CSV」备份**
- 没有任何后端，不会发送到任何服务器

## 自定义种子数据

`src/lib/seed-data.ts` 里有一份**占位用的示例员工数据**（`示例-员工A` ~ `示例-员工H`，姓名/部门/薪资均为虚构）。打开应用后会自动加载这些数据方便上手。

要把 seed 数据换成自己的，最简单的做法是在「员工管理」Tab 里把示例员工删掉，再手动添加。或者直接编辑 `src/lib/seed-data.ts`，但要注意：

- 首次启动后，seed 数据会被 zustand persist 序列化进 localStorage
- 想让新 seed 生效：清空浏览器 localStorage，或在「员工管理」里点 resetToSeed（在 store 里定义了但目前没暴露 UI 入口）

## 项目结构

```
src/
├── app/                    # Next.js App Router 入口
│   ├── layout.tsx
│   ├── page.tsx            # 5 个 Tab 的容器
│   └── globals.css
├── components/             # React 组件
│   ├── payroll-calculator.tsx
│   ├── payroll-history.tsx
│   ├── tax-management.tsx
│   ├── employee-manager.tsx
│   ├── calculation-guide.tsx
│   └── ui/                 # shadcn/ui 组件
├── lib/                    # 核心逻辑
│   ├── payroll.ts          # 计算引擎
│   ├── store.ts            # Zustand 状态 + localStorage
│   ├── seed-data.ts        # 示例数据（请替换为你自己的）
│   ├── types.ts            # TypeScript 类型
│   └── utils.ts
└── hooks/
```

## 路线图

- [ ] 工资条 PDF 导出走 jsPDF 而非浏览器打印
- [ ] 历史记录导入（从 CSV 恢复）
- [ ] 多公司 / 多账套支持
- [ ] 个税年终汇算支持
- [ ] 月度对比报表

## 贡献

PR / Issue 都欢迎。提 Issue 时附上：

- 复现步骤
- 期望 vs 实际
- 浏览器 / Node 版本
- 控制台报错（如有）

## License

MIT — 详见 [LICENSE](./LICENSE)。

## 免责声明

本项目涉及薪资计算，**仅作工具参考**。具体实施请以当地税务局、人社局、公积金管理中心最新政策为准。计算结果不构成任何税务或社保申报建议。使用者应自行承担合规责任。