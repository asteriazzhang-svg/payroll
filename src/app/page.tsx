'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { EmployeeManager } from '@/components/employee-manager';
import { PayrollCalculator } from '@/components/payroll-calculator';
import { PayrollHistory } from '@/components/payroll-history';
import { TaxManagement } from '@/components/tax-management';
import { Analytics } from '@/components/analytics';
import { CalculationGuide } from '@/components/calculation-guide';
import { MyPayslips } from '@/components/my-payslips';
import { UserManagement } from '@/components/user-management';
import { SettingsPage } from '@/components/settings-page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Calculator, Users, BookOpen, Wallet, History, FileSpreadsheet,
  BarChart3, LogOut, Loader2, Receipt, UserCog, Settings as SettingsIcon,
} from 'lucide-react';
import { usePayrollStore } from '@/lib/store';
import { api } from '@/lib/api-client';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const { loadAll, loaded, loading: storeLoading } = usePayrollStore();
  const [activeTab, setActiveTab] = useState('payroll');
  const [loadError, setLoadError] = useState(false);
  const [companyName, setCompanyName] = useState('Hortor Payroll System');

  useEffect(() => {
    api<{ companyName: string }>('/api/settings')
      .then((s) => { if (s.companyName) setCompanyName(s.companyName); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role === 'ADMIN' && !loaded && !loadError) {
      loadAll().catch(() => setLoadError(true));
    }
  }, [user, loaded, loadAll, loadError]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gray-200 bg-white text-gray-900">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div>
                <h1 className="text-base font-semibold text-gray-800">{companyName}</h1>
                <p className="text-xs text-gray-400">
                  {isAdmin ? '管理后台' : `${user.employeeName ?? user.username} 的工资条`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <div className="font-medium text-gray-700">{user.username}</div>
                <div className="text-gray-400 text-xs">{isAdmin ? '管理员' : '员工'}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4 mr-1" />
                登出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isAdmin ? (
          <AdminTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            loading={storeLoading && !loaded}
            loadError={loadError}
            onRetry={() => { setLoadError(false); }}
          />
        ) : (
          <EmployeeView />
        )}
      </main>

      <footer className="border-t mt-8 py-4 text-center text-sm text-muted-foreground">
        <p>{companyName} © 2026</p>
      </footer>
    </div>
  );
}

function AdminTabs({
  activeTab, setActiveTab, loading, loadError, onRetry,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
}) {
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-red-600">数据加载失败，请检查网络后重试。</p>
        <Button onClick={onRetry}>
          <Loader2 className="h-4 w-4 mr-2" /> 重新加载
        </Button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full max-w-5xl grid-cols-8">
        <TabsTrigger value="payroll" className="flex items-center gap-1">
          <Calculator className="h-4 w-4" /> 薪资计算
        </TabsTrigger>
        <TabsTrigger value="analytics" className="flex items-center gap-1">
          <BarChart3 className="h-4 w-4" /> 数据分析
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-1">
          <History className="h-4 w-4" /> 历史记录
        </TabsTrigger>
        <TabsTrigger value="tax" className="flex items-center gap-1">
          <FileSpreadsheet className="h-4 w-4" /> 个税管理
        </TabsTrigger>
        <TabsTrigger value="employees" className="flex items-center gap-1">
          <Users className="h-4 w-4" /> 员工管理
        </TabsTrigger>
        <TabsTrigger value="users" className="flex items-center gap-1">
          <UserCog className="h-4 w-4" /> 账号管理
        </TabsTrigger>
        <TabsTrigger value="settings" className="flex items-center gap-1">
          <SettingsIcon className="h-4 w-4" /> 基础设置
        </TabsTrigger>
        <TabsTrigger value="guide" className="flex items-center gap-1">
          <BookOpen className="h-4 w-4" /> 计算说明
        </TabsTrigger>
      </TabsList>
      <TabsContent value="payroll" className="mt-4"><PayrollCalculator /></TabsContent>
      <TabsContent value="analytics" className="mt-4"><Analytics /></TabsContent>
      <TabsContent value="history" className="mt-4"><PayrollHistory /></TabsContent>
      <TabsContent value="tax" className="mt-4"><TaxManagement /></TabsContent>
      <TabsContent value="employees" className="mt-4"><EmployeeManager /></TabsContent>
      <TabsContent value="users" className="mt-4"><UserManagement /></TabsContent>
      <TabsContent value="settings" className="mt-4"><SettingsPage /></TabsContent>
      <TabsContent value="guide" className="mt-4"><CalculationGuide /></TabsContent>
    </Tabs>
  );
}

function EmployeeView() {
  const [tab, setTab] = useState('payslips');
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid w-full max-w-2xl grid-cols-2">
        <TabsTrigger value="payslips" className="flex items-center gap-1">
          <Receipt className="h-4 w-4" /> 我的工资条
        </TabsTrigger>
        <TabsTrigger value="guide" className="flex items-center gap-1">
          <BookOpen className="h-4 w-4" /> 计算说明
        </TabsTrigger>
      </TabsList>
      <TabsContent value="payslips" className="mt-4"><MyPayslips /></TabsContent>
      <TabsContent value="guide" className="mt-4"><CalculationGuide /></TabsContent>
    </Tabs>
  );
}
