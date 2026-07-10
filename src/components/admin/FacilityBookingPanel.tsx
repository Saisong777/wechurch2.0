import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, DoorOpen, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  FacilityBookingSummary,
  FacilityConflictClientError,
  useFacilityBookingMutations,
  useFacilityBookings,
} from '@/hooks/useFacilityBookings';
import { cn } from '@/lib/utils';

interface FacilityBookingPanelProps {
  selectedChurch: string;
  currentChurchName: string;
}

const todayString = () => new Date().toISOString().slice(0, 10);

const statusLabels: Record<string, string> = {
  pending: '待審核',
  approved: '已核准',
  declined: '已婉拒',
  cancelled: '已取消',
  completed: '完成',
};

const purposeLabels: Record<string, string> = {
  small_group: '小組',
  classroom: '課程',
  service: '崇拜',
  event: '活動',
  meeting: '會議',
  pastoral: '牧養',
  outside_rental: '外部租借',
  children: '兒童',
  youth: '青少',
  prayer: '禱告會',
  visit: '參訪',
  worship_night: '敬拜夜',
  maintenance: '保養',
  kids: '兒童教室',
};

function toDateTime(date: string, time: string) {
  return `${date}T${time || '00:00'}:00`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPurposePriority(purpose: string) {
  if (purpose === 'service') return 95;
  if (purpose === 'children') return 88;
  if (purpose === 'worship_night') return 84;
  if (purpose === 'prayer') return 82;
  if (purpose === 'visit') return 78;
  if (purpose === 'small_group') return 65;
  if (purpose === 'classroom' || purpose === 'youth') return 60;
  if (purpose === 'outside_rental') return 35;
  return 50;
}

export function FacilityBookingPanel({ selectedChurch, currentChurchName }: FacilityBookingPanelProps) {
  const overviewQuery = useFacilityBookings(selectedChurch);
  const mutations = useFacilityBookingMutations(selectedChurch);
  const rooms = overviewQuery.data?.rooms ?? [];
  const bookings = overviewQuery.data?.bookings ?? [];

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [bookingTitle, setBookingTitle] = useState('小組使用');
  const [bookingPurpose, setBookingPurpose] = useState('small_group');
  const [bookingDate, setBookingDate] = useState(todayString());
  const [startTime, setStartTime] = useState('19:30');
  const [endTime, setEndTime] = useState('21:30');
  const [bookingNote, setBookingNote] = useState('');
  const [conflicts, setConflicts] = useState<FacilityBookingSummary[]>([]);

  useEffect(() => {
    if (selectedRoomId && rooms.some((room) => room.id === selectedRoomId)) return;
    setSelectedRoomId(rooms[0]?.id ?? '');
  }, [rooms, selectedRoomId]);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const roomBookings = bookings.filter((booking) => booking.roomId === selectedRoomId);
  const stats = useMemo(() => {
    const pending = bookings.filter((booking) => booking.status === 'pending').length;
    const approved = bookings.filter((booking) => booking.status === 'approved').length;
    const conflictCount = bookings.reduce((sum, booking) => sum + booking.conflictCount, 0);
    return { pending, approved, conflictCount };
  }, [bookings]);

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      toast.success(message);
    } catch (error) {
      console.error(error);
      toast.error('操作失敗，請稍後再試');
    }
  };

  const handleCreateBooking = async () => {
    if (!selectedRoomId || !bookingTitle.trim()) return;
    setConflicts([]);
    try {
      await mutations.createBooking.mutateAsync({
        roomId: selectedRoomId,
        title: bookingTitle.trim(),
        purpose: bookingPurpose,
        startAt: toDateTime(bookingDate, startTime),
        endAt: toDateTime(bookingDate, endTime),
        priority: getPurposePriority(bookingPurpose),
        note: bookingNote.trim() || null,
      });
      toast.success('已送出場地預約');
    } catch (error) {
      if (error instanceof FacilityConflictClientError) {
        setConflicts(error.conflicts);
        toast.error('這個時段已有預約，請先處理衝突');
        return;
      }
      console.error(error);
      toast.error('建立預約失敗');
    }
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (overviewQuery.data && !overviewQuery.data.schemaReady) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">場地預約資料表尚未啟用</p>
            <p className="mt-1 text-sm text-muted-foreground">{overviewQuery.data.message || '請先同步資料庫 schema。'}</p>
          </div>
          <Button onClick={() => run(mutations.seedDefaults.mutateAsync(), '已建立預設場地')} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            建立預設場地
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
            <p className="text-sm text-muted-foreground">場地</p>
            <p className="mt-2 text-2xl font-bold">{rooms.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">待審核</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已核准</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">衝突</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">{stats.conflictCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{currentChurchName} 場地預約</h2>
          <p className="text-sm text-muted-foreground">教室、小組、會談、兒童、青少、參訪與內部活動都先回到同一個 booking 規則。</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => run(mutations.seedDefaults.mutateAsync(), '已同步預設場地')}>
          <RefreshCw className="h-4 w-4" />
          同步預設場地
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">場地清單</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} placeholder="新增場地" />
              <Button
                size="icon"
                aria-label="新增場地"
                disabled={!newRoomName.trim()}
                onClick={() => run(mutations.createRoom.mutateAsync({ name: newRoomName.trim(), category: 'classroom' }).then(() => setNewRoomName('')), '已新增場地')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setSelectedRoomId(room.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40',
                    room.id === selectedRoomId && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{room.name}</p>
                    <Badge variant="outline">{room.capacity} 人</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{purposeLabels[room.category] || room.category} ・ {room.upcomingBookingCount} 筆預約</p>
                </button>
              ))}
              {rooms.length === 0 && <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">尚未建立場地</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{selectedRoom?.name || '選擇場地'}</CardTitle>
                  <p className="text-sm text-muted-foreground">{selectedRoom?.description || '建立預約並處理撞期'}</p>
                </div>
                {selectedRoom && <Badge variant="secondary">{selectedRoom.location || '位置未設定'}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-[1fr_150px_140px_110px_110px_auto] lg:items-end">
              <div className="space-y-1.5">
                <Label>用途名稱</Label>
                <Input value={bookingTitle} onChange={(event) => setBookingTitle(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>類型</Label>
                <Select value={bookingPurpose} onValueChange={setBookingPurpose}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(purposeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>日期</Label>
                <Input type="date" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>開始</Label>
                <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>結束</Label>
                <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </div>
              <Button className="gap-2" disabled={!selectedRoomId || !bookingTitle.trim()} onClick={handleCreateBooking}>
                <CalendarDays className="h-4 w-4" />
                預約
              </Button>
              <div className="space-y-1.5 lg:col-span-6">
                <Label>設備 / 開關門 / 清場備註</Label>
                <Textarea
                  value={bookingNote}
                  onChange={(event) => setBookingNote(event.target.value)}
                  placeholder="例：需小蜜蜂、冷氣、紅樓廁所指引，或活動前需清場"
                  className="min-h-[76px]"
                />
              </div>
            </CardContent>
          </Card>

          {conflicts.length > 0 && (
            <Card className="border-rose-200 bg-rose-50/70">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-rose-700" />
                  <div>
                    <p className="font-semibold text-rose-800">這個時段已有預約</p>
                    <div className="mt-2 grid gap-2">
                      {conflicts.map((conflict) => (
                        <div key={conflict.id} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm">
                          <span className="font-medium">{conflict.title}</span>
                          <span className="text-muted-foreground"> ・ {formatDateTime(conflict.startAt)} - {formatDateTime(conflict.endAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">近期預約</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {roomBookings.map((booking) => (
                <div key={booking.id} className={cn('rounded-lg border p-3', booking.conflictCount > 0 && 'border-rose-200 bg-rose-50/60')}>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <DoorOpen className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{booking.title}</p>
                        <Badge variant={booking.status === 'approved' ? 'default' : booking.status === 'pending' ? 'secondary' : 'outline'}>
                          {statusLabels[booking.status] || booking.status}
                        </Badge>
                        {booking.conflictCount > 0 && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">衝突 {booking.conflictCount}</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTime(booking.startAt)} - {formatDateTime(booking.endAt)} ・ {purposeLabels[booking.purpose] || booking.purpose}
                      </p>
                      {booking.note && <p className="mt-1 text-xs leading-5 text-muted-foreground">{booking.note}</p>}
                      {booking.requesterName && <p className="mt-1 text-xs text-muted-foreground">申請：{booking.requesterName}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => run(mutations.updateBookingStatus.mutateAsync({ bookingId: booking.id, status: 'approved' }), '已核准場地')}>
                        核准
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => run(mutations.updateBookingStatus.mutateAsync({ bookingId: booking.id, status: 'declined' }), '已婉拒場地')}>
                        婉拒
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {roomBookings.length === 0 && <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">這個場地尚無近期預約</p>}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
