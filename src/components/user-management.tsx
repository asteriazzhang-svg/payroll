'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { UserCog, Plus, Loader2, KeyRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { usePayrollStore } from '@/lib/store';

interface UserRow {
  id: string;
  username: string;
  role: string;
  employeeId: string | null;
  employeeName: string | null;
  active: boolean;
  mustChangePwd: boolean;
  createdAt: string;
}

export function UserManagement() {
  const { employees } = usePayrollStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  function reload() {
    setLoading(true);
    api<UserRow[]>('/api/users')
      .then(setUsers)
      .catch((e) => toast({ title: '加载失败', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [toast]);

  async function toggleActive(u: UserRow) {
    try {
      const updated = await api<UserRow>(`/api/users/${u.id}`, {
        method: 'PATCH', body: { active: !u.active },
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
    } catch (e) {
      toast({ title: '操作失败', description: e instanceof ApiError ? e.message : '', variant: 'destructive' });
    }
  }

  async function resetPassword(u: UserRow) {
    const np = prompt(`重置 ${u.username} 的密码（至少 6 位）：`);
    if (!np) return;
    try {
      await api(`/api/users/${u.id}/reset-password`, { method: 'POST', body: { newPassword: np } });
      toast({ title: '密码已重置', description: `${u.username} 下次登录需修改密码` });
    } catch (e) {
      toast({ title: '重置失败', description: e instanceof ApiError ? e.message : '', variant: 'destructive' });
    }
  }

  async function deleteUser(u: UserRow) {
    if (!confirm(`确认删除账号 ${u.username}？`)) return;
    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast({ title: '已删除' });
    } catch (e) {
      toast({ title: '删除失败', description: e instanceof ApiError ? e.message : '', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" /> 账号管理
            </CardTitle>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> 新建账号</Button>
              </DialogTrigger>
              <CreateUserDialog
                employees={employees}
                onCreated={() => { setCreateOpen(false); reload(); }}
              />
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>绑定员工</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>需改密</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
                        {u.role === 'ADMIN' ? '管理员' : '员工'}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.employeeName ?? '—'}</TableCell>
                    <TableCell>
                      <Switch checked={u.active} onCheckedChange={() => toggleActive(u)} />
                    </TableCell>
                    <TableCell>{u.mustChangePwd ? <Badge variant="outline">是</Badge> : '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => resetPassword(u)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {u.role !== 'ADMIN' && (
                        <Button variant="ghost" size="sm" onClick={() => deleteUser(u)}>删除</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateUserDialog({
  employees, onCreated,
}: {
  employees: { id: string; name: string; entity: string }[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!username || newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast({ title: '请填用户名，密码至少 8 位且含字母和数字', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api('/api/users', {
        method: 'POST',
        body: { username, password, employeeId: employeeId || undefined, role: 'EMPLOYEE' },
      });
      toast({ title: '账号已创建', description: `${username} 下次登录需改密` });
      setUsername(''); setPassword(''); setEmployeeId('');
      onCreated();
    } catch (e) {
      toast({ title: '创建失败', description: e instanceof ApiError ? e.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>新建员工账号</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>用户名</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>初始密码（至少 6 位）</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>绑定员工（可选）</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger><SelectValue placeholder="选择员工..." /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.entity})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" onClick={handleCreate} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          创建
        </Button>
      </div>
    </DialogContent>
  );
}
