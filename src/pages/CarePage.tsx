import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck2,
  CheckCircle2,
  HeartHandshake,
  MessageCircleHeart,
  PenLine,
  Plus,
  RotateCcw,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useCareContacts } from '@/hooks/useCareContacts';
import { toast } from 'sonner';

function getDateLabel(date?: string | null) {
  const target = date ? new Date(date) : new Date();
  return target.toLocaleDateString('zh-TW', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export const CarePage = () => {
  const {
    contacts,
    isLoading,
    isLocalMode,
    createContact,
    recordAction,
    resetLocalContacts,
    isCreating,
    isRecording,
  } = useCareContacts();
  const [name, setName] = useState('');
  const [need, setNeed] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [prayer, setPrayer] = useState('');

  const activeContacts = useMemo(
    () => contacts.filter((contact) => !contact.lastCaredAt),
    [contacts]
  );
  const caredContacts = useMemo(
    () => contacts.filter((contact) => contact.lastCaredAt),
    [contacts]
  );
  const totalPrayers = contacts.reduce((sum, contact) => sum + contact.prayerCount, 0);

  const handleAddContact = () => {
    if (!name.trim()) return;

    createContact(
      {
        name: name.trim(),
        need: need.trim() || '需要更多了解與陪伴。',
        nextAction: nextAction.trim() || '這週主動問候一次。',
        prayer: prayer.trim() || '求主讓我用合宜的方式關心他。',
      },
      {
        onSuccess: () => {
          setName('');
          setNeed('');
          setNextAction('');
          setPrayer('');
          toast.success('已加入關懷清單');
        },
      }
    );
  };

  const markCared = (id: string) => {
    recordAction(
      { contactId: id, actionType: 'care' },
      {
        onSuccess: () => toast.success('已記錄這次關心'),
      }
    );
  };

  const markPrayed = (id: string) => {
    recordAction(
      { contactId: id, actionType: 'prayer' },
      {
        onSuccess: () => toast.success('已記下代禱'),
      }
    );
  };

  const resetStarter = () => {
    resetLocalContacts();
    toast.info('已重設示範關懷清單');
  };

  return (
    <FeatureGate featureKey="pastoral_beta" title="關懷功能 beta 測試中" description="關懷紀錄目前只開放給 beta 同工">
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/5">
      <Header title="關懷紀錄" subtitle="關懷清單與陪伴紀錄" variant="compact" backTo="/" />

      <main className="container mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="grid gap-0 md:grid-cols-[1fr_0.72fr]">
              <div className="p-4 sm:p-6">
                <Badge variant="outline" className="mb-3 border-secondary/20 bg-secondary/10 text-secondary">
                  個人紀錄
                </Badge>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                  <HeartHandshake className="h-7 w-7 text-secondary" />
                  從關懷清單到陪伴紀錄
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  先把想關心的人放進清單，記下他的需要、下一步行動與代禱方向。關心過後，再留下這次陪伴的紀錄。
                </p>
              </div>

              <div className="grid grid-cols-3 border-t bg-muted/25 md:border-l md:border-t-0 md:grid-cols-1">
                <div className="p-4 md:border-b">
                  <p className="text-xl font-bold">{isLoading ? '...' : activeContacts.length}</p>
                  <p className="text-xs text-muted-foreground">正在關懷</p>
                </div>
                <div className="border-l p-4 md:border-b md:border-l-0">
                  <p className="text-xl font-bold">{caredContacts.length}</p>
                  <p className="text-xs text-muted-foreground">陪伴紀錄</p>
                </div>
                <div className="border-l p-4 md:border-l-0">
                  <p className="text-xl font-bold">{totalPrayers}</p>
                  <p className="text-xs text-muted-foreground">代禱紀錄</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <Card className="rounded-lg shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">新增關懷對象</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      先記下一個人，之後再補上實際關心與陪伴。
                    </p>
                  </div>
                  {isLocalMode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 justify-start rounded-lg gap-2 text-muted-foreground sm:justify-center"
                      onClick={resetStarter}
                    >
                      <RotateCcw className="h-4 w-4" />
                      重設示範
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-[0.7fr_1.1fr_1fr_auto] lg:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="care-name">名字</Label>
                    <Input
                      id="care-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="例如：小組新朋友"
                      className="h-11 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="care-need">目前需要</Label>
                    <AutoResizeTextarea
                      id="care-need"
                      minRows={1}
                      maxRows={4}
                      value={need}
                      onChange={(event) => setNeed(event.target.value)}
                      placeholder="他最近需要什麼陪伴、鼓勵或代禱？"
                      className="min-h-11 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="care-action">下一個行動</Label>
                    <Input
                      id="care-action"
                      value={nextAction}
                      onChange={(event) => setNextAction(event.target.value)}
                      placeholder="例如：週三傳訊息問候"
                      className="h-11 rounded-lg"
                    />
                  </div>
                  <Button
                    className="h-11 rounded-lg gap-2 lg:w-36"
                    onClick={handleAddContact}
                    disabled={!name.trim() || isCreating}
                  >
                    <Plus className="h-4 w-4" />
                    加入清單
                  </Button>
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="care-prayer">代禱方向</Label>
                  <AutoResizeTextarea
                    id="care-prayer"
                    minRows={1}
                    maxRows={4}
                    value={prayer}
                    onChange={(event) => setPrayer(event.target.value)}
                    placeholder="為他寫一句禱告。"
                    className="min-h-11 rounded-lg"
                  />
                </div>
              </CardContent>
            </Card>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-lg font-bold text-foreground">正在關懷清單</h2>
                <Badge variant="outline">{activeContacts.length} 筆</Badge>
              </div>

              {activeContacts.length > 0 ? (
                <Card className="overflow-hidden rounded-lg shadow-sm">
                  <CardContent className="divide-y p-0">
                    {activeContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="grid gap-3 bg-card p-3 sm:p-4 lg:grid-cols-[8.5rem_minmax(7rem,0.6fr)_minmax(13rem,1fr)_minmax(12rem,1fr)_10rem] lg:items-center"
                      >
                        <p className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                          <CalendarCheck2 className="h-3.5 w-3.5" />
                          {getDateLabel(contact.createdAt)}
                        </p>
                        <h3 className="text-base font-bold leading-tight text-foreground">{contact.name}</h3>
                        <p className="line-clamp-2 rounded-lg bg-muted/35 px-3 py-2 text-sm leading-6 text-muted-foreground lg:line-clamp-1">
                          {contact.need}
                        </p>
                        <div className="space-y-1 text-sm leading-6 text-muted-foreground">
                          <p className="line-clamp-1">
                            <span className="font-medium text-foreground">行動：</span>
                            {contact.nextAction}
                          </p>
                          <p className="line-clamp-1">
                            <span className="font-medium text-foreground">代禱：</span>
                            {contact.prayer}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg gap-2"
                            onClick={() => markPrayed(contact.id)}
                            disabled={isRecording}
                          >
                            <Sparkles className="h-4 w-4" />
                            代禱
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 rounded-lg gap-2"
                            onClick={() => markCared(contact.id)}
                            disabled={isRecording}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            已關心
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-lg border-dashed shadow-sm">
                  <CardContent className="p-5 text-center">
                    <PenLine className="mx-auto mb-2 h-8 w-8 text-secondary" />
                    <h3 className="font-bold text-foreground">目前沒有正在關懷的人</h3>
                    <p className="mt-1 text-sm text-muted-foreground">新增一個名字後，就會進入這份清單。</p>
                  </CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-lg font-bold text-foreground">關懷紀錄</h2>
                <Badge variant="outline">{caredContacts.length} 筆</Badge>
              </div>

              {caredContacts.length > 0 ? (
                <Card className="overflow-hidden rounded-lg shadow-sm">
                  <CardContent className="divide-y p-0">
                    {caredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="grid gap-3 bg-card p-3 sm:p-4 lg:grid-cols-[8.5rem_minmax(7rem,0.6fr)_minmax(13rem,1fr)_minmax(12rem,1fr)_7rem] lg:items-center"
                      >
                        <p className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                          <CalendarCheck2 className="h-3.5 w-3.5" />
                          {getDateLabel(contact.lastCaredAt)}
                        </p>
                        <h3 className="text-base font-bold leading-tight text-foreground">{contact.name}</h3>
                        <p className="line-clamp-2 rounded-lg bg-muted/35 px-3 py-2 text-sm leading-6 text-muted-foreground lg:line-clamp-1">
                          {contact.need}
                        </p>
                        <div className="space-y-1 text-sm leading-6 text-muted-foreground">
                          <p className="line-clamp-1">
                            <span className="font-medium text-foreground">做了：</span>
                            {contact.nextAction}
                          </p>
                          <p className="line-clamp-1">
                            <span className="font-medium text-foreground">代禱：</span>
                            {contact.prayerCount > 0 ? `${contact.prayerCount} 次` : '尚未記錄'}
                          </p>
                        </div>
                        <Badge className="w-fit shrink-0 bg-emerald-500 text-white">已關心</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-lg border-dashed shadow-sm">
                  <CardContent className="p-6 text-center">
                    <UserRound className="mx-auto mb-3 h-10 w-10 text-secondary" />
                    <h3 className="text-lg font-bold text-foreground">還沒有關懷紀錄</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      當你完成一次關心，這裡會留下陪伴的足跡。
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            <div className="text-center">
              <Button variant="link" asChild className="text-muted-foreground">
                <Link to="/">回到今日面板</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>
      </div>
    </FeatureGate>
  );
};

export default CarePage;
