import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { IcebreakerCard } from './IcebreakerCard';
import { LevelSelector } from './LevelSelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchGroupMembers } from '@/lib/supabase-helpers';
import { 
  CheckCircle, Circle, Users, Loader2, Sparkles, 
  Languages, ArrowRight, RefreshCw, Clock 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types/bible-study';
import type { Database } from '@/integrations/supabase/types';

type CardLevel = Database['public']['Enums']['card_level'];

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

  // Derived state
  const isMyTurn = gameState.currentDrawerId === currentUserId;
  const hasDrawn = gameState.currentDrawerCardId !== null && isMyTurn;
  const hasShared = gameState.sharedMemberIds.includes(currentUserId);
  const sharedCount = gameState.sharedMemberIds.length;
  const totalCount = members.length;
  const allComplete = sharedCount >= totalCount && totalCount > 0;
  const progress = totalCount > 0 ? (sharedCount / totalCount) * 100 : 0;

  // Get current drawer's info
  const currentDrawer = useMemo(() => 
    members.find(m => m.id === gameState.currentDrawerId),
    [members, gameState.currentDrawerId]
  );

  // Load members and initialize game
  const initGame = useCallback(async () => {
    try {
      // Load group members
      const groupMembers = await fetchGroupMembers(sessionId, groupNumber);
      setMembers(groupMembers);

      // Find existing game for this session/group (get the OLDEST one to ensure consistency)
      let { data: existingGames, error } = await supabase
        .from('icebreaker_games')
        .select('*')
        .eq('bible_study_session_id', sessionId)
        .eq('group_number', groupNumber)
        .eq('mode', 'session')
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) throw error;

      let existingGame = existingGames?.[0] || null;

      if (!existingGame) {
        // Try to create new game with drawer order
        const shuffledOrder = groupMembers
          .map(m => m.id)
          .sort(() => Math.random() - 0.5);

        const { data: newGame, error: createError } = await supabase
          .from('icebreaker_games')
          .insert({
            bible_study_session_id: sessionId,
            group_number: groupNumber,
            mode: 'session',
            drawer_order: shuffledOrder,
            current_drawer_id: shuffledOrder[0] || null,
            shared_member_ids: [],
          })
          .select()
          .single();

        // Handle race condition: if insert failed due to conflict, re-fetch
        if (createError) {
          console.log('[TurnBasedCardGame] Create failed, re-fetching existing game...');
          const { data: retryGames } = await supabase
            .from('icebreaker_games')
            .select('*')
            .eq('bible_study_session_id', sessionId)
            .eq('group_number', groupNumber)
            .eq('mode', 'session')
            .eq('status', 'active')
            .order('created_at', { ascending: true })
            .limit(1);
          
          existingGame = retryGames?.[0] || null;
          if (!existingGame) throw createError; // Still no game, throw original error
        } else {
          existingGame = newGame;
        }
      }

      // Initialize drawer order if not set
      if (!existingGame.drawer_order || existingGame.drawer_order.length === 0) {
        const shuffledOrder = groupMembers
          .map(m => m.id)
          .sort(() => Math.random() - 0.5);

        await supabase
          .from('icebreaker_games')
          .update({
            drawer_order: shuffledOrder,
            current_drawer_id: shuffledOrder[0] || null,
          })
          .eq('id', existingGame.id);

        existingGame.drawer_order = shuffledOrder;
        existingGame.current_drawer_id = shuffledOrder[0] || null;
      }

      // Fetch current card content if exists
      let cardContent = null;
      let cardContentEn = null;
      if (existingGame.current_drawer_card_id) {
        const { data: cardData } = await supabase
          .from('card_questions')
          .select('content_text, content_text_en')
          .eq('id', existingGame.current_drawer_card_id)
          .single();
        
        if (cardData) {
          cardContent = cardData.content_text;
          cardContentEn = cardData.content_text_en;
          setIsFlipped(true);
        }
      }

      setGameState({
        gameId: existingGame.id,
        currentDrawerId: existingGame.current_drawer_id || null,
        currentDrawerCardId: existingGame.current_drawer_card_id || null,
        drawerOrder: (existingGame.drawer_order as string[]) || [],
        sharedMemberIds: (existingGame.shared_member_ids as string[]) || [],
        currentLevel: existingGame.current_level || 'L1',
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

  // Subscribe to realtime updates
  useEffect(() => {
    if (!gameState.gameId) return;

    const channel = supabase
      .channel(`turn-based-game-${gameState.gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'icebreaker_games',
          filter: `id=eq.${gameState.gameId}`,
        },
        async (payload) => {
          const newData = payload.new as any;
          
          // Fetch card content if card changed
          let cardContent = gameState.currentCardContent;
          let cardContentEn = gameState.currentCardContentEn;
          
          if (newData.current_drawer_card_id && 
              newData.current_drawer_card_id !== gameState.currentDrawerCardId) {
            const { data: cardData } = await supabase
              .from('card_questions')
              .select('content_text, content_text_en')
              .eq('id', newData.current_drawer_card_id)
              .single();
            
            if (cardData) {
              cardContent = cardData.content_text;
              cardContentEn = cardData.content_text_en;
              setIsFlipped(true);
            }
          } else if (!newData.current_drawer_card_id) {
            cardContent = null;
            cardContentEn = null;
            setIsFlipped(false);
          }

          setGameState(prev => ({
            ...prev,
            currentDrawerId: newData.current_drawer_id || null,
            currentDrawerCardId: newData.current_drawer_card_id || null,
            drawerOrder: (newData.drawer_order as string[]) || prev.drawerOrder,
            sharedMemberIds: (newData.shared_member_ids as string[]) || [],
            currentLevel: newData.current_level || prev.currentLevel,
            currentCardContent: cardContent,
            currentCardContentEn: cardContentEn,
          }));

          // Check if everyone has shared
          const newSharedIds = newData.shared_member_ids || [];
          if (newSharedIds.length >= members.length && members.length > 0) {
            toast.success('全員分享完成！準備進入查經筆記', { duration: 2000 });
            setTimeout(onComplete, 1500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameState.gameId, gameState.currentDrawerCardId, members.length, onComplete]);

  // Draw a card (only for current drawer)
  const drawCard = async () => {
    if (!gameState.gameId || !isMyTurn || isDrawing) return;

    setIsDrawing(true);
    try {
      const { data, error } = await supabase
        .rpc('draw_next_card', {
          p_game_id: gameState.gameId,
          p_level: gameState.currentLevel,
        });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.card_id) {
        toast.info('這個等級的牌已經抽完了！');
        return;
      }

      // Update game with the drawn card
      await supabase
        .from('icebreaker_games')
        .update({ current_drawer_card_id: result.card_id })
        .eq('id', gameState.gameId);

      setGameState(prev => ({
        ...prev,
        currentDrawerCardId: result.card_id,
        currentCardContent: result.card_content,
        currentCardContentEn: null, // Will be fetched via realtime
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

  // Mark as shared and advance to next person
  const markAsShared = async () => {
    if (!gameState.gameId || isMarking || !isMyTurn) return;

    setIsMarking(true);
    try {
      // Add self to shared list
      const newSharedIds = [...gameState.sharedMemberIds, currentUserId];
      
      // Find next drawer who hasn't shared yet
      const remainingDrawers = gameState.drawerOrder.filter(
        id => !newSharedIds.includes(id)
      );
      const nextDrawerId = remainingDrawers[0] || null;

      await supabase
        .from('icebreaker_games')
        .update({
          shared_member_ids: newSharedIds,
          current_drawer_id: nextDrawerId,
          current_drawer_card_id: null, // Reset for next person
        })
        .eq('id', gameState.gameId);

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

  // Change level (only for current drawer before drawing)
  const changeLevel = async (level: CardLevel) => {
    if (!gameState.gameId || !isMyTurn || hasDrawn) return;

    try {
      await supabase
        .from('icebreaker_games')
        .update({ current_level: level })
        .eq('id', gameState.gameId);

      setGameState(prev => ({ ...prev, currentLevel: level }));
    } catch (error) {
      console.error('[TurnBasedCardGame] Change level failed:', error);
    }
  };

  // Sort members by drawer order, showing current drawer first
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
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="font-medium">第 {groupNumber} 組 破冰時間</span>
        </div>
        <p className="text-muted-foreground text-sm">
          輪流翻牌分享，完成後打勾讓下一位繼續
        </p>
      </div>

      {/* Progress */}
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

      {/* Language Toggle */}
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

      {/* Current Turn Display */}
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

      {/* Level Selector - Only for current drawer before drawing */}
      {isMyTurn && !hasDrawn && (
        <LevelSelector
          currentLevel={gameState.currentLevel}
          onLevelChange={changeLevel}
          disabled={isDrawing}
        />
      )}

      {/* Card Display */}
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

      {/* Draw Button - For current drawer who hasn't drawn */}
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

      {/* Share Complete Button - For current drawer who has drawn */}
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
          分享完畢 ✓
        </Button>
      )}

      {/* Member List */}
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

      {/* All Complete */}
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
