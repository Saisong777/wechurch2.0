import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock3, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServingSchedule, useServingScheduleMutations } from '@/hooks/useServingSchedule';
import { cn } from '@/lib/utils';

interface ServingSchedulePanelProps {
  selectedChurch: string;
  currentChurchName: string;
}

const todayString = () => new Date().toISOString().slice(0, 10);

const statusLabels: Record<string, string> = {
  draft: '草稿',
  published: '已發布',
  completed: '完成',
  cancelled: '取消',
  pending: '待確認',
  confirmed: '已確認',
  declined: '無法',
  substitute: '代班',
  done: '已完成',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
}

export function ServingSchedulePanel({ selectedChurch, currentChurchName }: ServingSchedulePanelProps) {
  const scheduleQuery = useServingSchedule(selectedChurch);
  const mutations = useServingScheduleMutations(selectedChurch);

  const data = scheduleQuery.data;
  const teams = data?.teams ?? [];
  const roles = data?.roles ?? [];
  const members = data?.members ?? [];
  const events = data?.events ?? [];
  const people = data?.people ?? [];

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newMemberPersonId, setNewMemberPersonId] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('主日服事');
  const [newEventDate, setNewEventDate] = useState(todayString());
  const [newEventStart, setNewEventStart] = useState('10:30');
  const [assignmentEventId, setAssignmentEventId] = useState('');
  const [assignmentRoleId, setAssignmentRoleId] = useState('');
  const [assignmentPersonId, setAssignmentPersonId] = useState('');

  useEffect(() => {
    if (selectedTeamId && teams.some((team) => team.id === selectedTeamId)) return;
    setSelectedTeamId(teams[0]?.id ?? '');
  }, [selectedTeamId, teams]);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const teamRoles = roles.filter((role) => role.teamId === selectedTeamId);
  const teamMembers = members.filter((member) => member.teamId === selectedTeamId);
  const teamEvents = events.filter((event) => event.teamId === selectedTeamId);
  const activeEvent = teamEvents.find((event) => event.id === assignmentEventId) ?? teamEvents[0] ?? null;

  useEffect(() => {
    if (assignmentEventId && teamEvents.some((event) => event.id === assignmentEventId)) return;
    setAssignmentEventId(teamEvents[0]?.id ?? '');
  }, [assignmentEventId, teamEvents]);

  useEffect(() => {
    if (assignmentRoleId && teamRoles.some((role) => role.id === assignmentRoleId)) return;
    setAssignmentRoleId(teamRoles[0]?.id ?? '');
  }, [assignmentRoleId, teamRoles]);

  useEffect(() => {
    if (assignmentPersonId && people.some((person) => person.id === assignmentPersonId)) return;
    setAssignmentPersonId(people[0]?.id ?? '');
  }, [assignmentPersonId, people]);

  const stats = useMemo(() => {
    const gapCount = events.reduce((sum, event) => sum + event.gapCount, 0);
    const confirmedCount = events.reduce((sum, event) => sum + event.confirmedCount, 0);
    const publishedCount = events.filter((event) => event.status === 'published').length;
    return { gapCount, confirmedCount, publishedCount };
  }, [events]);

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      toast.success(message);
    } catch (error) {
      console.error(error);
      toast.error('操作失敗，請稍後再試');
    }
  };

  if (scheduleQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (data && !data.schemaReady) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">服事排班資料表尚未啟用</p>
            <p className="mt-1 text-sm text-muted-foreground">{data.message || '請先同步資料庫 schema。'}</p>
          </div>
          <Button onClick={() => run(mutations.seedDefaults.mutateAsync(), '已建立預設服事團隊')} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            建立預設團隊
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">服事團隊</p>
            <p className="mt-2 text-2xl font-bold">{teams.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">近期排班</p>
            <p className="mt-2 text-2xl font-bold">{events.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已確認</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{stats.confirmedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">缺口</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">{stats.gapCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{currentChurchName} 服事排班</h2>
          <p className="text-sm text-muted-foreground">支援領袖手動安排，也保留未來開放同工自行填班的空間。</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => run(mutations.seedDefaults.mutateAsync(), '已同步預設團隊')}>
          <RefreshCw className="h-4 w-4" />
          同步預設團隊
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">團隊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} placeholder="新增團隊名稱" />
              <Button
                size="icon"
                aria-label="新增團隊"
                disabled={!newTeamName.trim()}
                onClick={() => run(mutations.createTeam.mutateAsync({ name: newTeamName.trim() }).then(() => setNewTeamName('')), '已新增團隊')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40',
                    selectedTeamId === team.id && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{team.name}</p>
                    <Badge variant="outline">{team.category}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{team.memberCount} 位同工 ・ {team.roleCount} 個角色</p>
                </button>
              ))}
              {teams.length === 0 && <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">尚未建立服事團隊</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{selectedTeam?.name || '選擇團隊'}</CardTitle>
                  <p className="text-sm text-muted-foreground">{selectedTeam?.description || '管理角色、人員與排班'}</p>
                </div>
                {selectedTeam && <Badge variant="secondary">{selectedTeam.defaultLocation || '地點未設定'}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">角色需求</p>
                  <Badge variant="outline">{teamRoles.length}</Badge>
                </div>
                <div className="flex gap-2">
                  <Input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="例：主領、招待、音控" />
                  <Button
                    size="icon"
                    aria-label="新增角色"
                    disabled={!selectedTeamId || !newRoleName.trim()}
                    onClick={() => run(mutations.createRole.mutateAsync({ teamId: selectedTeamId, name: newRoleName.trim(), sortOrder: teamRoles.length + 1 }).then(() => setNewRoleName('')), '已新增角色')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {teamRoles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm font-medium">{role.name}</span>
                      <Badge variant="outline">需 {role.requiredCount}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">團隊同工</p>
                  <Badge variant="outline">{teamMembers.length}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Select value={newMemberPersonId} onValueChange={setNewMemberPersonId}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇同工" />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>{person.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="gap-2"
                    disabled={!selectedTeamId || !newMemberPersonId}
                    onClick={() => run(mutations.addMember.mutateAsync({ teamId: selectedTeamId, personId: newMemberPersonId }), '已加入團隊')}
                  >
                    <Users className="h-4 w-4" />
                    加入
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="rounded-lg border px-3 py-2">
                      <p className="truncate text-sm font-medium">{member.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.roleLabel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">建立排班</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-[1fr_150px_120px_auto] lg:items-end">
              <div className="space-y-1.5">
                <Label>名稱</Label>
                <Input value={newEventTitle} onChange={(event) => setNewEventTitle(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>日期</Label>
                <Input type="date" value={newEventDate} onChange={(event) => setNewEventDate(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>開始</Label>
                <Input type="time" value={newEventStart} onChange={(event) => setNewEventStart(event.target.value)} />
              </div>
              <Button
                className="gap-2"
                disabled={!selectedTeamId || !newEventTitle.trim()}
                onClick={() => run(mutations.createEvent.mutateAsync({
                  teamId: selectedTeamId,
                  title: newEventTitle.trim(),
                  serviceDate: newEventDate,
                  startTime: newEventStart,
                  location: selectedTeam?.defaultLocation,
                }), '已建立排班')}
              >
                <CalendarCheck className="h-4 w-4" />
                建立
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">近期排班表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{event.title}</p>
                        <Badge variant={event.status === 'published' ? 'default' : 'secondary'}>{statusLabels[event.status] || event.status}</Badge>
                        {event.gapCount > 0 && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">缺 {event.gapCount}</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDate(event.serviceDate)} {event.startTime || ''} ・ {event.location || selectedTeam?.defaultLocation || '地點未定'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => run(mutations.updateEventStatus.mutateAsync({ eventId: event.id, status: 'published' }), '已發布排班')}>
                        發布
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => run(mutations.updateEventStatus.mutateAsync({ eventId: event.id, status: 'completed' }), '已標記完成')}>
                        完成
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {event.assignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/35 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{assignment.roleName} ・ {assignment.displayName}</p>
                          <p className="text-xs text-muted-foreground">{statusLabels[assignment.status] || assignment.status}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" aria-label="確認" onClick={() => run(mutations.updateAssignment.mutateAsync({ assignmentId: assignment.id, status: 'confirmed' }), '已確認服事')}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="完成" onClick={() => run(mutations.updateAssignment.mutateAsync({ assignmentId: assignment.id, status: 'done' }), '已完成服事')}>
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {event.assignments.length === 0 && <p className="rounded-lg bg-muted/35 px-3 py-3 text-sm text-muted-foreground">尚未安排同工</p>}
                  </div>
                </div>
              ))}
              {teamEvents.length === 0 && <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">這個團隊尚未建立排班</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">快速安排同工</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-4 lg:items-end">
              <div className="space-y-1.5">
                <Label>排班</Label>
                <Select value={assignmentEventId} onValueChange={setAssignmentEventId}>
                  <SelectTrigger><SelectValue placeholder="選擇排班" /></SelectTrigger>
                  <SelectContent>
                    {teamEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>{formatDate(event.serviceDate)} {event.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select value={assignmentRoleId} onValueChange={setAssignmentRoleId}>
                  <SelectTrigger><SelectValue placeholder="選擇角色" /></SelectTrigger>
                  <SelectContent>
                    {teamRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>同工</Label>
                <Select value={assignmentPersonId} onValueChange={setAssignmentPersonId}>
                  <SelectTrigger><SelectValue placeholder="選擇同工" /></SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>{person.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="gap-2"
                disabled={!activeEvent || !assignmentRoleId || !assignmentPersonId}
                onClick={() => run(mutations.createAssignment.mutateAsync({
                  eventId: assignmentEventId || activeEvent?.id || '',
                  roleId: assignmentRoleId,
                  personId: assignmentPersonId,
                  status: 'pending',
                }), '已安排服事同工')}
              >
                <Clock3 className="h-4 w-4" />
                安排
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
