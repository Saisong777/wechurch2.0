import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookHeart, CalendarCheck2, CheckCircle2, PartyPopper, Plus, Sparkles } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { usePrayerWall } from '@/hooks/usePrayerWall';
import { toast } from 'sonner';

type GraceStatus = 'waiting' | 'answered' | 'grace_response';
type GraceResponseType = 'ended' | 'blocked' | 'grace' | 'keep_waiting' | 'other';

interface GraceRecord {
  id: string;
  title: string;
  prayer: string;
  response?: string;
  status?: GraceStatus;
  responseType?: GraceResponseType;
  createdAt: string;
}

const STORAGE_KEY = 'wechurch_grace_records_v1';
const GRACE_RESPONSE_OPTIONS: Array<{ value: GraceResponseType; label: string }> = [
  { value: 'grace', label: '有恩典' },
  { value: 'ended', label: '已結束' },
  { value: 'blocked', label: '神攔阻' },
  { value: 'keep_waiting', label: '要等候' },
  { value: 'other', label: '其他' },
];

function getDateLabel(date: string) {
  return new Date(date).toLocaleDateString('zh-TW', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `grace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasGraceResponse(record: GraceRecord) {
  return !!record.response?.trim();
}

function getResponseTypeLabel(type?: GraceResponseType) {
  return GRACE_RESPONSE_OPTIONS.find((option) => option.value === type)?.label || '恩典回應';
}

const GraceRecordPage = () => {
  const { data: prayers = [] } = usePrayerWall();
  const [records, setRecords] = useState<GraceRecord[]>([]);
  const [title, setTitle] = useState('');
  const [prayer, setPrayer] = useState('');
  const [respondingRecordId, setRespondingRecordId] = useState<string | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [responseTypeDrafts, setResponseTypeDrafts] = useState<Record<string, GraceResponseType>>({});

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setRecords(parsed);
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event('wechurch:grace-records-updated'));
  }, [records]);

  const answeredMine = useMemo(
    () => prayers.filter((item) => item.isOwner && item.isAnswered),
    [prayers]
  );

  const waitingRecords = useMemo(
    () =>
      records
        .filter((record) => !hasGraceResponse(record))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [records]
  );
  const graceRecords = useMemo(
    () =>
      records
        .filter((record) => hasGraceResponse(record))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [records]
  );

  const handleAdd = () => {
    if (!title.trim() && !prayer.trim()) return;

    const nextRecord: GraceRecord = {
      id: createId(),
      title: title.trim() || '今天的禱告',
      prayer: prayer.trim(),
      status: 'waiting',
      createdAt: new Date().toISOString(),
    };

    setRecords((current) => [nextRecord, ...current]);
    setTitle('');
    setPrayer('');
    toast.success('已加入禱告清單，也會出現在首頁個人禱告');
  };

  const openResponseForm = (record: GraceRecord) => {
    setRespondingRecordId(record.id);
    setResponseDrafts((current) => ({
      ...current,
      [record.id]: current[record.id] ?? record.response ?? '',
    }));
    setResponseTypeDrafts((current) => ({
      ...current,
      [record.id]: current[record.id] ?? record.responseType ?? 'grace',
    }));
  };

  const saveGraceResponse = (record: GraceRecord) => {
    const response = responseDrafts[record.id]?.trim() || '';
    if (!response) {
      toast.error('請先寫下神如何回應或帶領');
      return;
    }

    setRecords((current) =>
      current.map((item) =>
        item.id === record.id
          ? {
              ...item,
              response,
              status: 'grace_response',
              responseType: responseTypeDrafts[record.id] || 'grace',
            }
          : item
      )
    );
    setRespondingRecordId(null);
    toast.success('已存入恩典紀錄簿');
  };

  const moveBackToWaiting = (record: GraceRecord) => {
    setRecords((current) =>
      current.map((item) =>
        item.id === record.id
          ? {
              ...item,
              response: '',
              status: 'waiting',
              responseType: undefined,
            }
          : item
      )
    );
    toast.success('已放回禱告清單');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-emerald-50/40">
      <Header title="個人禱告" subtitle="禱告清單與恩典紀錄簿" variant="compact" backTo="/share" />

      <main className="container mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="grid gap-0 md:grid-cols-[1fr_0.72fr]">
              <div className="p-4 sm:p-6">
                <Badge variant="outline" className="mb-3 border-emerald-200 bg-emerald-50 text-emerald-700">
                  個人紀錄
                </Badge>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                  <BookHeart className="h-7 w-7 text-emerald-600" />
                  從禱告清單到恩典紀錄簿
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  先把需要禱告的事放進清單，它會同步出現在首頁的「個人禱告」。等神有帶領或回應時，再從那一筆禱告補上恩典回應，存入恩典紀錄簿。
                </p>
              </div>

              <div className="grid grid-cols-2 border-t bg-muted/25 md:border-l md:border-t-0 md:grid-cols-1">
                <div className="p-4 md:border-b">
                  <p className="text-xl font-bold">{waitingRecords.length}</p>
                  <p className="text-xs text-muted-foreground">正在禱告</p>
                </div>
                <div className="border-l p-4 md:border-l-0">
                  <p className="text-xl font-bold">{graceRecords.length}</p>
                  <p className="text-xs text-muted-foreground">恩典紀錄</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <Card className="rounded-lg shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">新增一筆禱告</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      寫下禱告就代表開始禱告；恩典回應之後再補。
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[0.75fr_1.25fr_auto] lg:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="grace-title">標題</Label>
                    <Input
                      id="grace-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="例如：我要買房"
                      className="h-11 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="grace-prayer">禱告內容</Label>
                    <AutoResizeTextarea
                      id="grace-prayer"
                      minRows={1}
                      maxRows={4}
                      value={prayer}
                      onChange={(event) => setPrayer(event.target.value)}
                      placeholder="我現在要向神求什麼、交託什麼？"
                      className="min-h-11 rounded-lg"
                    />
                  </div>
                  <Button
                    className="h-11 rounded-lg gap-2 lg:w-36"
                    onClick={handleAdd}
                    disabled={!title.trim() && !prayer.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    開始禱告
                  </Button>
                </div>
              </CardContent>
            </Card>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-lg font-bold text-foreground">正在禱告清單</h2>
                <Badge variant="outline">{waitingRecords.length} 筆</Badge>
              </div>

              {waitingRecords.length > 0 ? (
                <Card className="overflow-hidden rounded-lg shadow-sm">
                  <CardContent className="divide-y p-0">
                    {waitingRecords.map((record) => (
                      <div key={record.id} className="bg-card">
                        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[9.5rem_minmax(9rem,0.7fr)_minmax(14rem,1fr)_6rem_10rem] lg:items-center">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CalendarCheck2 className="h-3.5 w-3.5" />
                            {getDateLabel(record.createdAt)}
                          </p>
                          <h3 className="text-base font-bold leading-tight text-foreground">{record.title}</h3>
                          <p className="line-clamp-2 rounded-lg bg-muted/35 px-3 py-2 text-sm leading-6 text-muted-foreground lg:line-clamp-1">
                            {record.prayer || '沒有補充內容'}
                          </p>
                          <Badge variant="outline" className="w-fit shrink-0">等候中</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg gap-2"
                            onClick={() => openResponseForm(record)}
                          >
                            <Sparkles className="h-4 w-4" />
                            記錄
                          </Button>
                        </div>

                        {respondingRecordId === record.id && (
                          <div className="border-t bg-muted/20 p-3 sm:p-4">
                            <div className="grid gap-3 lg:grid-cols-[minmax(12rem,0.9fr)_minmax(18rem,1.2fr)_auto] lg:items-end">
                              <div className="space-y-2">
                                <Label>回應分類</Label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2">
                                  {GRACE_RESPONSE_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                                        (responseTypeDrafts[record.id] || 'grace') === option.value
                                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                          : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() =>
                                        setResponseTypeDrafts((current) => ({
                                          ...current,
                                          [record.id]: option.value,
                                        }))
                                      }
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`response-${record.id}`}>恩典回應</Label>
                                <AutoResizeTextarea
                                  id={`response-${record.id}`}
                                  minRows={2}
                                  maxRows={5}
                                  value={responseDrafts[record.id] || ''}
                                  onChange={(event) =>
                                    setResponseDrafts((current) => ({
                                      ...current,
                                      [record.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="後來發生了什麼？神怎麼帶領、攔阻、供應，或提醒你繼續等候？"
                                  className="rounded-lg"
                                />
                              </div>
                              <div className="flex gap-2 lg:flex-col">
                                <Button className="flex-1 rounded-lg lg:flex-none" onClick={() => saveGraceResponse(record)}>
                                  存入紀錄簿
                                </Button>
                                <Button variant="outline" className="rounded-lg" onClick={() => setRespondingRecordId(null)}>
                                  取消
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-lg border-dashed shadow-sm">
                  <CardContent className="p-5 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                    <h3 className="font-bold text-foreground">目前沒有正在等候的禱告</h3>
                    <p className="mt-1 text-sm text-muted-foreground">新增一筆禱告後，首頁也會顯示它。</p>
                  </CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-lg font-bold text-foreground">恩典紀錄簿</h2>
                <Badge variant="outline">{graceRecords.length} 筆</Badge>
              </div>

              {graceRecords.length > 0 ? (
                <Card className="overflow-hidden rounded-lg shadow-sm">
                  <CardContent className="divide-y p-0">
                    {graceRecords.map((record) => (
                      <div key={record.id} className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[9.5rem_minmax(9rem,0.7fr)_minmax(14rem,1fr)_7rem_8rem] lg:items-center">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CalendarCheck2 className="h-3.5 w-3.5" />
                          {getDateLabel(record.createdAt)}
                        </p>
                        <h3 className="text-base font-bold leading-tight text-foreground">{record.title}</h3>
                        <div className="space-y-1">
                          <p className="line-clamp-1 text-xs text-muted-foreground">{record.prayer}</p>
                          <p className="line-clamp-2 text-sm leading-6 text-foreground lg:line-clamp-1">{record.response}</p>
                        </div>
                        <Badge className="w-fit shrink-0 bg-emerald-500 text-white">
                          {getResponseTypeLabel(record.responseType)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 justify-start px-0 text-muted-foreground hover:text-foreground lg:justify-center lg:px-2"
                          onClick={() => moveBackToWaiting(record)}
                        >
                          放回清單
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-lg border-dashed shadow-sm">
                  <CardContent className="p-6 text-center">
                    <PartyPopper className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
                    <h3 className="text-lg font-bold text-foreground">還沒有恩典回應紀錄</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      當某一筆禱告有了後續帶領，再從禱告清單補上回應。
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            {answeredMine.length > 0 && (
              <Card className="rounded-lg shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-foreground">我的公開禱告已蒙應允</h2>
                    <Button variant="link" asChild className="h-auto p-0 text-emerald-700">
                      <Link to="/prayer-wall?view=my">回禱告牆</Link>
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {answeredMine.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-lg border bg-background/80 p-3">
                        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default GraceRecordPage;
