import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Users, ArrowRight, Dumbbell } from 'lucide-react';

interface GameLobbyProps {
  onCreateGame: () => void;
  onJoinGame: (roomCode: string) => void;
  isLoading: boolean;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  onCreateGame,
  onJoinGame,
  isLoading,
}) => {
  const [roomCode, setRoomCode] = useState('');

  const handleJoin = () => {
    if (roomCode.trim().length >= 4) {
      onJoinGame(roomCode.trim().toUpperCase());
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-secondary/30 rounded-full blur-2xl animate-pulse-soft" />
          <div className="relative w-24 h-24 rounded-full gradient-gold flex items-center justify-center glow-gold">
            <Sparkles className="w-12 h-12 text-secondary-foreground" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">真心話不用冒險</h1>
        <p className="text-muted-foreground">Truth Without Dare</p>
      </div>

      {/* Create New Game */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Dumbbell className="w-5 h-5 text-primary" />
            開始新遊戲
          </CardTitle>
          <CardDescription>
            自己抽牌，一人一台
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="gold"
            size="lg"
            className="w-full h-14"
            onClick={onCreateGame}
            disabled={isLoading}
          >
            {isLoading ? '準備中...' : '開始遊戲'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </CardContent>
      </Card>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground">
            或加入房間
          </span>
        </div>
      </div>

      {/* Join Existing Game */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-secondary" />
            加入小組遊戲
          </CardTitle>
          <CardDescription>
            輸入房間代碼，同步看牌
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="輸入 4 碼房間代碼"
            className="h-14 text-xl font-mono text-center tracking-[0.3em] uppercase"
            maxLength={4}
          />
          <Button
            variant="outline"
            size="lg"
            className="w-full h-12"
            onClick={handleJoin}
            disabled={isLoading || roomCode.trim().length < 4}
          >
            加入房間
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
