'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X, Plus, Building2, ListChecks, Settings as SettingsIcon, Loader2, Check, MapPin, Wallet } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { usePayrollStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import type { CityConfig } from '@/lib/types';

interface EntityConfig { name: string; calcType: 'shenzhen' | 'hongkong' | 'beijing'; }
interface DeptConfig { name: string; isRnD: boolean; }
interface AppSettings {
  companyName: string;
  entities: EntityConfig[];
  departments: DeptConfig[];
}

const CALC_TYPE_LABELS: Record<string, string> = {
  shenzhen: '深圳社保',
  hongkong: '香港 MPF',
  beijing: '北京社保',
};

export function SettingsPage() {
  const { config, updateConfig } = usePayrollStore();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [newDept, setNewDept] = useState('');
  const [newEntity, setNewEntity] = useState('');
  const [newEntityType, setNewEntityType] = useState<EntityConfig['calcType']>('shenzhen');

  // City social insurance config
  const [editingCity, setEditingCity] = useState<CityConfig | null>(null);
  const [newCityName, setNewCityName] = useState('');
  const emptyCity: Omit<CityConfig, 'city'> = {
    pensionBaseMin: 0, pensionBaseMax: 0,
    medicalBaseMin: 0, medicalBaseMax: 0,
    unemploymentBaseMin: 0, unemploymentBaseMax: 0,
    housingFundBaseMin: 0, housingFundBaseMax: 0,
  };
  const [newCityFields, setNewCityFields] = useState<Omit<CityConfig, 'city'>>(emptyCity);
  const [savingCity, setSavingCity] = useState(false);

  useEffect(() => {
    api<AppSettings>('/api/settings')
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !settings) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  async function saveCompanyName() {
    setSavingName(true);
    try {
      const updated = await api<AppSettings>('/api/settings', { method: 'PUT', body: { companyName: settings!.companyName } });
      setSettings(updated);
      toast({ title: '公司名称已保存' });
    } catch (e) {
      toast({ title: '保存失败', variant: 'destructive' });
    } finally { setSavingName(false); }
  }

  // --- Entities ---
  async function addEntity() {
    const name = newEntity.trim();
    if (!name) return;
    if (settings!.entities.some((e) => e.name === name)) { toast({ title: '该主体已存在', variant: 'destructive' }); return; }
    const entities = [...settings!.entities, { name, calcType: newEntityType }];
    try { setSettings({ ...settings!, entities }); setSettings((await api<AppSettings>('/api/settings', { method: 'PUT', body: { entities } }))); setNewEntity(''); }
    catch { toast({ title: '添加失败', variant: 'destructive' }); }
  }
  async function removeEntity(name: string) {
    const entities = settings!.entities.filter((e) => e.name !== name);
    try { setSettings((await api<AppSettings>('/api/settings', { method: 'PUT', body: { entities } }))); }
    catch { toast({ title: '删除失败', variant: 'destructive' }); }
  }

  // --- Departments ---
  async function addDepartment() {
    const name = newDept.trim();
    if (!name) return;
    if (settings!.departments.some((d) => d.name === name)) { toast({ title: '该部门已存在', variant: 'destructive' }); return; }
    // New departments default to RnD = true (most are RnD per the spec).
    const departments = [...settings!.departments, { name, isRnD: true }];
    try { setSettings((await api<AppSettings>('/api/settings', { method: 'PUT', body: { departments } }))); setNewDept(''); }
    catch { toast({ title: '添加失败', variant: 'destructive' }); }
  }
  async function removeDepartment(name: string) {
    const departments = settings!.departments.filter((d) => d.name !== name);
    try { setSettings((await api<AppSettings>('/api/settings', { method: 'PUT', body: { departments } }))); }
    catch { toast({ title: '删除失败', variant: 'destructive' }); }
  }
  async function toggleRnD(name: string) {
    const departments = settings!.departments.map((d) => d.name === name ? { ...d, isRnD: !d.isRnD } : d);
    try { setSettings((await api<AppSettings>('/api/settings', { method: 'PUT', body: { departments } }))); }
    catch { toast({ title: '更新失败', variant: 'destructive' }); }
  }

  // --- City social insurance configs ---
  const citySocialConfigs: CityConfig[] = config.citySocialConfigs ?? [];

  async function saveCityConfig(cfg: CityConfig) {
    setSavingCity(true);
    const existing = citySocialConfigs.filter((c) => c.city !== cfg.city);
    const updated = [...existing, cfg];
    try {
      await updateConfig({ citySocialConfigs: updated });
      toast({ title: `${cfg.city} 社保基数已保存` });
      setEditingCity(null);
      setNewCityName('');
      setNewCityFields(emptyCity);
    } catch {
      toast({ title: '保存失败', variant: 'destructive' });
    } finally {
      setSavingCity(false);
    }
  }

  async function removeCityConfig(city: string) {
    if (!confirm(`确认删除 ${city} 的社保基数配置？`)) return;
    const updated = citySocialConfigs.filter((c) => c.city !== city);
    try {
      await updateConfig({ citySocialConfigs: updated });
      toast({ title: `${city} 配置已删除` });
    } catch {
      toast({ title: '删除失败', variant: 'destructive' });
    }
  }

  const configFields: { key: keyof typeof config; label: string }[] = [
    { key: 'year', label: '当前年' }, { key: 'month', label: '当前月' },
    { key: 'housingAllowance', label: '房补' }, { key: 'exchangeRate', label: '汇率 (RMB→USD)' },
  ];

  return (
    <div className="space-y-4">
      {/* Company name */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> 公司名称</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>系统显示名称</Label>
              <Input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} />
            </div>
            <Button onClick={saveCompanyName} disabled={savingName}>
              {savingName ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} 保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entities */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> 签约主体管理</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {settings.entities.map((e) => (
              <div key={e.name} className="flex items-center justify-between p-2 border rounded-md">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.name}</span>
                  <Badge variant="outline" className="text-xs">{CALC_TYPE_LABELS[e.calcType]}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeEntity(e.name)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><Label>主体名称</Label><Input placeholder="如：上海豪腾" value={newEntity} onChange={(e) => setNewEntity(e.target.value)} /></div>
            <div className="w-40">
              <Label>计算类型</Label>
              <Select value={newEntityType} onValueChange={(v) => setNewEntityType(v as EntityConfig['calcType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shenzhen">深圳社保</SelectItem>
                  <SelectItem value="hongkong">香港 MPF</SelectItem>
                  <SelectItem value="beijing">北京社保</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addEntity} variant="outline"><Plus className="h-4 w-4 mr-1" /> 添加</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">计算类型决定薪资计算逻辑：深圳社保(养老/医疗/失业/公积金) 或 北京社保 或 香港 MPF</p>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" /> 部门管理</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {settings.departments.map((d) => (
              <div key={d.name} className="flex items-center justify-between p-2 border rounded-md">
                <div className="flex items-center gap-3">
                  <span className="font-medium w-28">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <Switch checked={d.isRnD} onCheckedChange={() => toggleRnD(d.name)} />
                    <span className={`text-xs ${d.isRnD ? 'text-green-600' : 'text-gray-400'}`}>
                      {d.isRnD ? '研发部门' : '非研发'}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeDepartment(d.name)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="输入部门名称..." value={newDept} onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDepartment(); } }} className="max-w-xs" />
            <Button onClick={addDepartment} variant="outline"><Plus className="h-4 w-4 mr-1" /> 添加</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">新部门默认标记为研发部门，可在上方切换</p>
        </CardContent>
      </Card>

      {/* Payroll parameters */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><SettingsIcon className="h-5 w-5" /> 计薪参数</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {configFields.map((f) => (
              <div key={f.key}>
                <Label className="text-xs">{f.label}</Label>
                <Input type="number" step="0.01" value={config[f.key]}
                  onChange={async (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) await updateConfig({ [f.key]: v } as never); }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* City social insurance configs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> 城市社保基数配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            为不同城市的员工设置社保/公积金缴费基数上下限。在员工档案中选择「工作城市」后，薪资计算将自动使用该城市的基数。
          </p>

          {/* Existing city configs */}
          {citySocialConfigs.map((c) => (
            <div key={c.city} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.city}</span>
                  <Badge variant="outline" className="text-xs">已配置</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditingCity(c)}>编辑</Button>
                  <Button variant="ghost" size="sm" onClick={() => removeCityConfig(c.city)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {editingCity?.city === c.city ? (
                <CityConfigForm
                  value={editingCity}
                  onChange={setEditingCity}
                  onSave={() => saveCityConfig(editingCity)}
                  onCancel={() => setEditingCity(null)}
                  saving={savingCity}
                  cityNameEditable={false}
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs text-muted-foreground">
                  <span>养老: {c.pensionBaseMin.toLocaleString()} ~ {c.pensionBaseMax.toLocaleString()}</span>
                  <span>医疗: {c.medicalBaseMin.toLocaleString()} ~ {c.medicalBaseMax.toLocaleString()}</span>
                  <span>失业: {c.unemploymentBaseMin.toLocaleString()} ~ {c.unemploymentBaseMax.toLocaleString()}</span>
                  <span>公积金: {c.housingFundBaseMin.toLocaleString()} ~ {c.housingFundBaseMax.toLocaleString()}</span>
                </div>
              )}
            </div>
          ))}

          {/* Add new city */}
          <div className="border rounded-md p-3 space-y-3 bg-muted/20">
            <div className="text-sm font-medium">添加新城市</div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">城市名称</Label>
                <Input
                  placeholder="如：上海、北京、广州..."
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                />
              </div>
            </div>
            {newCityName.trim() && (
              <CityConfigForm
                value={{ city: newCityName.trim(), ...newCityFields }}
                onChange={(v) => setNewCityFields({ ...v })}
                onSave={() => saveCityConfig({ city: newCityName.trim(), ...newCityFields })}
                onCancel={() => { setNewCityName(''); setNewCityFields(emptyCity); }}
                saving={savingCity}
                cityNameEditable={false}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 最低工资标准卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> 最低工资标准
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            用于医疗期病假工资计算。员工请病假时，除按 (1/应出勤天数)*Base 扣减外，
            还会按 (1/应出勤天数)*当地最低工资*80% 发放病假工资。修改后保存会立即生效。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(['深圳', '北京'] as const).map((city) => {
              const w = config.minimumWageByCity?.[city] ?? { monthly: 0, hourly: 0 };
              return (
                <div key={city} className="p-3 border rounded-md space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{city}</span>
                    <Badge variant="outline" className="text-xs">法定最低</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">月标准 (元)</Label>
                      <Input
                        type="number"
                        value={w.monthly}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const cur = config.minimumWageByCity ?? {};
                          void updateConfig({
                            minimumWageByCity: { ...cur, [city]: { ...(cur[city] ?? { monthly: 0, hourly: 0 }), monthly: Number.isFinite(v) ? v : 0 } },
                          } as any);
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">小时标准 (元)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={w.hourly}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const cur = config.minimumWageByCity ?? {};
                          void updateConfig({
                            minimumWageByCity: { ...cur, [city]: { ...(cur[city] ?? { monthly: 0, hourly: 0 }), hourly: Number.isFinite(v) ? v : 0 } },
                          } as any);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Inline form for editing a single city's social insurance base ranges. */
function CityConfigForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  cityNameEditable,
}: {
  value: CityConfig;
  onChange: (v: CityConfig) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  cityNameEditable: boolean;
}) {
  const fields: { key: keyof Omit<CityConfig, 'city'>; label: string }[] = [
    { key: 'pensionBaseMin', label: '养老下限' },
    { key: 'pensionBaseMax', label: '养老上限' },
    { key: 'medicalBaseMin', label: '医疗下限' },
    { key: 'medicalBaseMax', label: '医疗上限' },
    { key: 'unemploymentBaseMin', label: '失业下限' },
    { key: 'unemploymentBaseMax', label: '失业上限' },
    { key: 'housingFundBaseMin', label: '公积金下限' },
    { key: 'housingFundBaseMax', label: '公积金上限' },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="text-xs">{f.label}</Label>
            <Input
              type="number"
              value={value[f.key] || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                onChange({ ...value, [f.key]: v });
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          保存
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>取消</Button>
      </div>
    </div>
  );
}
