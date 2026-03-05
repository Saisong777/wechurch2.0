import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { MyNotebook } from '@/components/user/MyNotebook';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureGate } from '@/components/ui/feature-gate';
import { INSIGHT_CATEGORIES, parseCategories, parseNotes } from '@/types/spiritual-fitness';
import {
  Dumbbell, BookOpen, Calendar, ChevronDown, ChevronUp,
  Users, Globe, Loader2, BookMarked, Heart, Eye, Target,
  MessageCircle, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface SessionInfo {
  session_id: string;
  verse_reference: string;
  session_date: string;
  group_number: number | null;
  participant_id: string;
}

interface GroupResponse {
  id: string;
  title_phrase: string | null;
  heartbeat_verse: string | null;
  observation: string | null;
  core_insight_category: string | null;
  core_insight_note: string | null;
  scholars_note: string | null;
  action_plan: string | null;
  cool_down_note: string | null;
  participant_name: string;
  participant_email: string;
}

interface AiReport {
  id: string;
  sessionId: string;
  reportType: string;
  groupNumber: number | null;
  content: string;
  status: string;
  createdAt: string;
}

const ResponseDetail = ({ response }: { response: GroupResponse }) => {
  const parsedCats = parseCategories(response.core_insight_category);
  const parsedNts = parseNotes(response.core_insight_note, parsedCats);

  return (
    <div className="space-y-3 p-3 rounded-md bg-muted/30" data-testid={`response-detail-${response.id}`}>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{response.participant_name}</Badge>
      </div>

      {response.heartbeat_verse && (
        <div className="flex gap-2">
          <Heart className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-0.5">心動經文</p>
            <p className="text-sm text-muted-foreground">{response.heartbeat_verse}</p>
          </div>
        </div>
      )}

      {response.observation && (
        <div className="flex gap-2">
          <Eye className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-0.5">觀察</p>
            <p className="text-sm text-muted-foreground">{response.observation}</p>
          </div>
        </div>
      )}

      {parsedCats.length > 0 && (
        <div className="flex gap-2">
          <Dumbbell className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-0.5">核心訓練</p>
            <div className="flex flex-wrap gap-1 mb-1">
              {parsedCats.map(catVal => {
                const catInfo = INSIGHT_CATEGORIES.find(c => c.value === catVal);
                return catInfo ? (
                  <Badge key={catVal} variant="outline">
                    {catInfo.emoji} {catInfo.label}
                  </Badge>
                ) : null;
              })}
            </div>
            {parsedCats.map(catVal => {
              const note = parsedNts[catVal];
              if (!note) return null;
              const catInfo = INSIGHT_CATEGORIES.find(c => c.value === catVal);
              return (
                <p key={catVal} className="text-sm text-muted-foreground">
                  {catInfo && <span className="font-medium">{catInfo.label}: </span>}
                  {note}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {response.scholars_note && (
        <div className="flex gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-0.5">學者分享</p>
            <p className="text-sm text-muted-foreground">{response.scholars_note}</p>
          </div>
        </div>
      )}

      {response.action_plan && (
        <div className="flex gap-2">
          <Target className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-0.5">行動計劃</p>
            <p className="text-sm text-muted-foreground">{response.action_plan}</p>
          </div>
        </div>
      )}

      {response.cool_down_note && (
        <div className="flex gap-2">
          <MessageCircle className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-0.5">緩和心得</p>
            <p className="text-sm text-muted-foreground">{response.cool_down_note}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const GroupSessionCard = ({ session }: { session: SessionInfo }) => {
  const [expanded, setExpanded] = useState(false);

  const { data: groupResponses, isLoading: loadingResponses } = useQuery({
    queryKey: ['/api/notebook/group-responses', session.session_id, session.group_number],
    queryFn: async () => {
      const res = await fetch(`/api/notebook/group-responses?sessionId=${session.session_id}&groupNumber=${session.group_number}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return (data?.responses || []) as GroupResponse[];
    },
    enabled: expanded && session.group_number !== null,
    staleTime: 60000,
  });

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ['/api/sessions', session.session_id, 'reports'],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${session.session_id}/reports`);
      if (!res.ok) throw new Error('Failed to fetch');
      return (await res.json()) as AiReport[];
    },
    enabled: expanded,
    staleTime: 60000,
  });

  const groupReport = reports?.find(
    r => r.reportType === 'group' && r.groupNumber === session.group_number && r.status === 'COMPLETED'
  );

  return (
    <Card
      className="overflow-visible hover-elevate cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      data-testid={`card-group-session-${session.session_id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 flex-wrap">
              <Calendar className="w-4 h-4" />
              {session.session_date ? format(new Date(session.session_date), 'yyyy年M月d日', { locale: zhTW }) : ''}
            </div>
            <CardTitle className="text-base font-medium truncate" data-testid={`text-group-verse-${session.session_id}`}>
              {session.verse_reference}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {session.group_number !== null && (
              <Badge variant="secondary" data-testid={`badge-group-number-${session.session_id}`}>
                <Users className="w-3 h-3 mr-1" />
                第{session.group_number}組
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4 border-t" onClick={e => e.stopPropagation()}>
          {groupReport && (
            <div className="mt-3">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                小組 AI 報告
              </h4>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                {groupReport.content}
              </div>
            </div>
          )}

          {loadingResponses || loadingReports ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {groupResponses && groupResponses.length > 0 ? (
                <div className="mt-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    組員筆記 ({groupResponses.length})
                  </h4>
                  <div className="space-y-3">
                    {groupResponses.map(resp => (
                      <ResponseDetail key={resp.id} response={resp} />
                    ))}
                  </div>
                </div>
              ) : (
                !loadingResponses && (
                  <p className="text-sm text-muted-foreground text-center py-2">尚無組員筆記</p>
                )
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

const OverallSessionCard = ({ session, allSessions }: { session: SessionInfo; allSessions: SessionInfo[] }) => {
  const [expanded, setExpanded] = useState(false);

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ['/api/sessions', session.session_id, 'reports'],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${session.session_id}/reports`);
      if (!res.ok) throw new Error('Failed to fetch');
      return (await res.json()) as AiReport[];
    },
    enabled: expanded,
    staleTime: 60000,
  });

  const overallReport = reports?.find(
    r => r.reportType === 'overall' && r.status === 'COMPLETED'
  );
  const groupReports = reports?.filter(
    r => r.reportType === 'group' && r.status === 'COMPLETED'
  )?.sort((a, b) => (a.groupNumber ?? 0) - (b.groupNumber ?? 0));

  return (
    <Card
      className="overflow-visible hover-elevate cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      data-testid={`card-overall-session-${session.session_id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 flex-wrap">
              <Calendar className="w-4 h-4" />
              {session.session_date ? format(new Date(session.session_date), 'yyyy年M月d日', { locale: zhTW }) : ''}
            </div>
            <CardTitle className="text-base font-medium truncate" data-testid={`text-overall-verse-${session.session_id}`}>
              {session.verse_reference}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">
              <Globe className="w-3 h-3 mr-1" />
              全體
            </Badge>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4 border-t" onClick={e => e.stopPropagation()}>
          {loadingReports ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {overallReport && (
                <div className="mt-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    全體 AI 報告
                  </h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                    {overallReport.content}
                  </div>
                </div>
              )}

              {groupReports && groupReports.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    各組 AI 報告
                  </h4>
                  <div className="space-y-3">
                    {groupReports.map(report => (
                      <div key={report.id} className="bg-muted/30 p-3 rounded-md">
                        <Badge variant="outline" className="mb-2">第{report.groupNumber}組</Badge>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {report.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!overallReport && (!groupReports || groupReports.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-2">尚無 AI 報告</p>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

const GroupTab = ({ userEmail }: { userEmail: string }) => {
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['/api/notebook/sessions', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/notebook/sessions?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return (data?.sessions || []) as SessionInfo[];
    },
    enabled: !!userEmail,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!sessionsData || sessionsData.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">尚無小組記錄</h3>
          <p className="text-muted-foreground text-sm">
            參加靈魂健身房後，您的小組筆記會顯示在這裡
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">小組查經記錄</h2>
        <Badge variant="secondary">{sessionsData.length} 場</Badge>
      </div>
      {sessionsData.map(session => (
        <GroupSessionCard key={`${session.session_id}-${session.participant_id}`} session={session} />
      ))}
    </div>
  );
};

const OverallTab = ({ userEmail }: { userEmail: string }) => {
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['/api/notebook/sessions', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/notebook/sessions?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return (data?.sessions || []) as SessionInfo[];
    },
    enabled: !!userEmail,
    staleTime: 60000,
  });

  const uniqueSessions = sessionsData
    ? Array.from(new Map(sessionsData.map(s => [s.session_id, s])).values())
    : [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (uniqueSessions.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">尚無全體報告</h3>
          <p className="text-muted-foreground text-sm">
            參加靈魂健身房後，全體 AI 報告會顯示在這裡
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Globe className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">全體報告</h2>
        <Badge variant="secondary">{uniqueSessions.length} 場</Badge>
      </div>
      {uniqueSessions.map(session => (
        <OverallSessionCard
          key={session.session_id}
          session={session}
          allSessions={sessionsData || []}
        />
      ))}
    </div>
  );
};

export const SoulGymNotebookPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const userEmail = user?.email || localStorage.getItem('bible_study_guest_email') || '';

  useEffect(() => {
    if (!loading && !user && !localStorage.getItem('bible_study_guest_email')) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="compact" title="Soul Gym 查經筆記本" backTo="/user" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <FeatureGate
      featureKeys={["we_live", "notebook"]}
      title="筆記本功能維護中"
      description="筆記本功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background" data-testid="soul-gym-notebook-page">
        <Header variant="compact" title="Soul Gym 查經筆記本" backTo="/user" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8">
          <div className="max-w-2xl md:max-w-3xl mx-auto">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6" data-testid="notebook-tabs">
                <TabsTrigger value="personal" data-testid="tab-personal">
                  <Dumbbell className="w-4 h-4 mr-1" />
                  個人
                </TabsTrigger>
                <TabsTrigger value="group" data-testid="tab-group">
                  <Users className="w-4 h-4 mr-1" />
                  小組
                </TabsTrigger>
                <TabsTrigger value="overall" data-testid="tab-overall">
                  <Globe className="w-4 h-4 mr-1" />
                  全體
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personal">
                <MyNotebook userEmail={userEmail} />
              </TabsContent>

              <TabsContent value="group">
                <GroupTab userEmail={userEmail} />
              </TabsContent>

              <TabsContent value="overall">
                <OverallTab userEmail={userEmail} />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default SoulGymNotebookPage;
