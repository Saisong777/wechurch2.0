import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { IcebreakerCard } from './IcebreakerCard';
import { LevelSelector } from './LevelSelector';
import { toast } from 'sonner';
import { 
  CheckCircle, Circle, Users, Loader2, Sparkles, 
  Languages, ArrowRight, Clock 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withRetry, staggeredStart } from '@/lib/retry-utils';

type CardLevel = 'L1' | 'L2' | 'L3';

interface User {
  id: string;
  name: string;
}

interface TurnBasedCardGameProps {
  sessionId: string;
  groupNumber: number;
  currentUserId: string;
  onComplete: () => void;
}

interface GameState {
  gameId: string | null;
  currentDrawerId: string | null;
  currentDrawerCardId: string | null;
  drawerOrder: string[];
  sharedMemberIds: string[];
  currentLevel: CardLevel;
  currentCardContent: string | null;
  currentCardContentEn: string | null;
}

export const TurnBasedCardGame: React.FC<TurnBasedCardGameProps> = ({
  sessionId,
  groupNumber,
  currentUserId,
  onComplete,
}) => {
  const [members, setMembers] = useState<User[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    gameId: null,
    currentDrawerId: null,
    currentDrawerCardId: null,
    drawerOrder: [],
    sharedMemberIds: [],
    currentLevel: 'L1',
    currentCardContent: null,
    currentCardContentEn: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const isMyTurn = gameState.currentDrawerId === currentUserId;
  const hasDrawn = gameState.currentDrawerCardId !== null && isMyTurn;
  const hasShared = gameState.sharedMemberIds.includes(currentUserId);
  const sharedCount = gameState.sharedMemberIds.length;
  const totalCount = members.length;
  const allComplete = sharedCount >= totalCount && totalCount > 0;
  const progress = totalCount > 0 ? (sharedCount / totalCount) * 100 : 0;

  const currentDrawer = useMemo(() => 
    members.find(m => m.id === gameState.currentDrawerId),
    [members, gameState.currentDrawerId]
  );

  const fetchGroupMembers = async (): Promise<User[]> => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/participants`);
      if (!response.ok) return [];
      const participants = await response.json();
      return participants
        .filter((p: any) => p.groupNumber === groupNumber)
        .map((p: any) => ({ id: p.id, name: p.name || p.guestName || 'Unknown' }));
    } catch {
      return [];
    }
  };

  const fetchCardContent = async (cardId: string): Promise<{ content: string; contentEn: string | null } | null> => {
    try {
      const response = await fetch(`/api/icebreaker/cards/${cardId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return { content: data.contentText, contentEn: data.contentTextEn };
    } catch {
      return null;
    }
  };

  const initGame = useCallback(async () => {
    try {
      await staggeredStart(500 + groupNumber * 300);
      
      const groupMembers = await withRetry(
        () => fetchGroupMembers(),
        { maxRetries: 3, baseDelayMs: 500 }
      );
      setMembers(groupMembers);

      let existingGame = await withRetry(async () => {
        const response = await fetch(
          `/api/icebreaker/session-game?sessionId=${sessionId}&groupNumber=${groupNumber}`
        );
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Failed to fetch game');
        return response.json();
      }, { maxRetries: 2 });

      if (!existingGame) {
        const shuffledOrder = groupMembers
          .map(m => m.id)
          .sort(() => Math.random() - 0.5);

        const createResponse = await fetch('/api/icebreaker/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bibleStudySessionId: sessionId,
            groupNumber: groupNumber,
            mode: 'session',
            drawerOrder: shuffledOrder,
            currentDrawerId: shuffledOrder[0] || null,
            sharedMemberIds: [],
          }),
        });

        if (createResponse.ok) {
          existingGame = await createResponse.json();
        } else {
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
          const retryResponse = await fetch(
            `/api/icebreaker/session-game?sessionId=${sessionId}&groupNumber=${groupNumber}`
          );
          if (retryResponse.ok) {
            existingGame = await retryResponse.json();
          }
        }
      }

      if (!existingGame) {
        throw new Error('Failed to create or find game');
      }

      if (!existingGame.drawerOrder || existingGame.drawerOrder.length === 0) {
        const shuffledOrder = groupMembers
          .map(m => m.id)
          .sort(() => Math.random() - 0.5);

        await fetch(`/api/icebreaker/games/${existingGame.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drawerOrder: shuffledOrder,
            currentDrawerId: shuffledOrder[0] || null,
          }),
        });

        existingGame.drawerOrder = shuffledOrder;
        existingGame.currentDrawerId = shuffledOrder[0] || null;
      }

      let cardContent = null;
      let cardContentEn = null;
      if (existingGame.currentDrawerCardId) {
        const cardData = await fetchCardContent(existingGame.currentDrawerCardId);
        if (cardData) {
          cardContent = cardData.content;
          cardContentEn = cardData.contentEn;
          setIsFlipped(true);
        }
      }

      setGameState({
        gameId: existingGame.id,
        currentDrawerId: existingGame.currentDrawerId || null,
        currentDrawerCardId: existingGame.currentDrawerCardId || null,
        drawerOrder: (existingGame.drawerOrder as string[]) || [],
        sharedMemberIds: (existingGame.sharedMemberIds as string[]) || [],
        currentLevel: existingGame.currentLevel || 'L1',
        currentCardContent: cardContent,
        currentCardContentEn: cardContentEn,
      });
    } catch (error) {
      console.error('[TurnBasedCardGame] Init failed:', error);
      toast.error('載入遊戲失敗');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, groupNumber]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const pollGameState = useCallback(async () => {
    if (!gameState.gameId) return;

    try {
      const response = await fetch(`/api/icebreaker/session-game?sessionId=${sessionId}&groupNumber=${groupNumber}`);
      if (!response.ok) return;
      
      const newData = await response.json();
      
      let cardContent = gameState.currentCardContent;
      let cardContentEn = gameState.currentCardContentEn;
      
      if (newData.currentDrawerCardId && 
          newData.currentDrawerCardId !== gameState.currentDrawerCardId) {
        const cardData = await fetchCardContent(newData.currentDrawerCardId);
        if (cardData) {
          cardContent = cardData.content;
          cardContentEn = cardData.contentEn;
          setIsFlipped(true);
        }
      } else if (!newData.currentDrawerCardId) {
        cardContent = null;
        cardContentEn = null;
        setIsFlipped(false);
      }

      setGameState(prev => ({
        ...prev,
        currentDrawerId: newData.currentDrawerId || null,
        currentDrawerCardId: newData.currentDrawerCardId || null,
        drawerOrder: (newData.drawerOrder as string[]) || prev.drawerOrder,
        sharedMemberIds: (newData.sharedMemberIds as string[]) || [],
        currentLevel: newData.currentLevel || prev.currentLevel,
        currentCardContent: cardContent,
        currentCardContentEn: cardContentEn,
      }));

      const newSharedIds = newData.sharedMemberIds || [];
      if (newSharedIds.length >= members.length && members.length > 0) {
        toast.success('全員分享完成！準備進入查經筆記', { duration: 2000 });
        setTimeout(onComplete, 1500);
      }
    } catch (err) {
      console.warn('Failed to poll game state:', err);
    }
  }, [gameState.gameId, gameState.currentDrawerCardId, sessionId, groupNumber, members.length, onComplete]);

  useEffect(() => {
    if (!gameState.gameId) return;

    pollingRef.current = setInterval(pollGameState, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [gameState.gameId, pollGameState]);

  const drawCard = async () => {
    if (!gameState.gameId || !isMyTurn || isDrawing) return;

    setIsDrawing(true);
    try {
      const response = await fetch(`/api/icebreaker/games/${gameState.gameId}/draw-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: gameState.currentLevel }),
      });

      if (!response.ok) throw new Error('Failed to draw card');

      const result = await response.json();
      if (!result?.cardId) {
        toast.info('這個等級的牌已經抽完了！');
        return;
      }

      await fetch(`/api/icebreaker/games/${gameState.gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentDrawerCardId: result.cardId }),
      });

      setGameState(prev => ({
        ...prev,
        currentDrawerCardId: result.cardId,
        currentCardContent: result.cardContent,
        currentCardContentEn: null,
      }));
      setIsFlipped(true);

      toast.success('抽牌成功！分享你的回答後打勾');
    } catch (error) {
      console.error('[TurnBasedCardGame] Draw failed:', error);
      toast.error('抽牌失敗');
    } finally {
      setIsDrawing(false);
    }
  };

  const markAsShared = async () => {
    if (!gameState.gameId || isMarking || !isMyTurn) return;

    setIsMarking(true);
    try {
      const newSharedIds = [...gameState.sharedMemberIds, currentUserId];
      
      const remainingDrawers = gameState.drawerOrder.filter(
        id => !newSharedIds.includes(id)
      );
      const nextDrawerId = remainingDrawers[0] || null;

      await fetch(`/api/icebreaker/games/${gameState.gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedMemberIds: newSharedIds,
          currentDrawerId: nextDrawerId,
          currentDrawerCardId: null,
        }),
      });

      setGameState(prev => ({
        ...prev,
        sharedMemberIds: newSharedIds,
        currentDrawerId: nextDrawerId,
        currentDrawerCardId: null,
        currentCardContent: null,
        currentCardContentEn: null,
      }));
      setIsFlipped(false);

      if (remainingDrawers.length === 0) {
        toast.success('全員分享完成！');
      } else {
        toast.success('分享完成！輪到下一位');
      }
    } catch (error) {
      console.error('[TurnBasedCardGame] Mark shared failed:', error);
      toast.error('操作失敗');
    } finally {
      setIsMarking(false);
    }
  };

  const changeLevel = async (level: CardLevel) => {
    if (!gameState.gameId || !isMyTurn || hasDrawn) return;

    try {
      await fetch(`/api/icebreaker/games/${gameState.gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLevel: level }),
      });

      setGameState(prev => ({ ...prev, currentLevel: level }));
    } catch (error) {
      console.error('[TurnBasedCardGame] Change level failed:', error);
    }
  };

  const sortedMembers = useMemo(() => {
    const order = gameState.drawerOrder;
    return [...members].sort((a, b) => {
      const aIndex = order.indexOf(a.id);
      const bIndex = order.indexOf(b.id);
      return aIndex - bIndex;
    });
  }, [members, gameState.drawerOrder]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="font-medium">第 {groupNumber} 組 破冰時間</span>
        </div>
        <p className="text-muted-foreground text-sm">
          輪流翻牌分享，完成後打勾讓下一位繼續
        </p>
      </div>

      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="font-medium">分享進度</span>
            </div>
            <Badge variant="outline" className="text-sm">
              {sharedCount} / {totalCount} 完成
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2">
        <Languages className="w-4 h-4 text-muted-foreground" />
        <Label htmlFor="lang-toggle" className="text-sm text-muted-foreground cursor-pointer">
          中文
        </Label>
        <Switch
          id="lang-toggle"
          checked={showEnglish}
          onCheckedChange={setShowEnglish}
        />
        <Label htmlFor="lang-toggle" className="text-sm text-muted-foreground cursor-pointer">
          English
        </Label>
      </div>

      {!allComplete && (
        <Card className={cn(
          "border-2 transition-all",
          isMyTurn ? "border-primary bg-primary/5" : "border-muted"
        )}>
          <CardContent className="py-4 text-center">
            {isMyTurn ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Clock className="w-5 h-5" />
                  <span className="font-bold text-lg">輪到你了！</span>
                </div>
                {!hasDrawn ? (
                  <p className="text-sm text-muted-foreground">
                    選擇等級後抽一張牌
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    分享你的回答，完成後打勾
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  等待 <span className="font-medium text-foreground">{currentDrawer?.name || '...'}</span> 分享
                </p>
                {gameState.currentCardContent && (
                  <p className="text-xs text-muted-foreground">
                    正在回答問題中...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isMyTurn && !hasDrawn && (
        <LevelSelector
          currentLevel={gameState.currentLevel}
          onLevelChange={changeLevel}
          disabled={isDrawing}
        />
      )}

      {(isMyTurn || gameState.currentCardContent) && (
        <AnimatePresence mode="wait">
          <motion.div
            key={gameState.currentDrawerCardId || 'empty'}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <IcebreakerCard
              content={gameState.currentCardContent}
              contentEn={gameState.currentCardContentEn}
              level={gameState.currentLevel}
              isFlipped={isFlipped}
              isDrawing={isDrawing}
              showEnglish={showEnglish}
              onTap={isMyTurn && !hasDrawn ? drawCard : undefined}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {isMyTurn && !hasDrawn && (
        <Button
          variant="gold"
          size="lg"
          className="w-full h-14 text-lg"
          onClick={drawCard}
          disabled={isDrawing}
        >
          {isDrawing ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Sparkles className="w-5 h-5 mr-2" />
          )}
          抽牌
        </Button>
      )}

      {isMyTurn && hasDrawn && (
        <Button
          variant="gold"
          size="lg"
          className="w-full h-14 text-lg"
          onClick={markAsShared}
          disabled={isMarking}
        >
          {isMarking ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CheckCircle className="w-5 h-5 mr-2" />
          )}
          分享完畢
        </Button>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            輪流順序
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedMembers.map((member, index) => {
            const memberHasShared = gameState.sharedMemberIds.includes(member.id);
            const isCurrentDrawer = gameState.currentDrawerId === member.id;
            const isCurrentUser = member.id === currentUserId;
            
            return (
              <div
                key={member.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all',
                  memberHasShared
                    ? 'bg-accent/10 border-accent/30'
                    : isCurrentDrawer
                      ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30'
                      : 'bg-muted/30 border-border',
                  isCurrentUser && !isCurrentDrawer && 'ring-2 ring-offset-1 ring-secondary'
                )}
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">
                  {index + 1}
                </div>
                
                {memberHasShared ? (
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
                ) : isCurrentDrawer ? (
                  <Clock className="w-5 h-5 text-primary flex-shrink-0 animate-pulse" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {member.name}
                    {isCurrentUser && (
                      <span className="text-primary ml-1">(你)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {memberHasShared 
                      ? '已完成' 
                      : isCurrentDrawer 
                        ? '正在分享...' 
                        : '等待中'}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {allComplete && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="py-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-accent mb-3" />
            <p className="font-medium text-lg">全員分享完成！</p>
            <p className="text-sm text-muted-foreground mt-1">
              即將進入查經筆記...
            </p>
            <Button
              variant="gold"
              size="lg"
              className="mt-4"
              onClick={onComplete}
            >
              開始查經
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
