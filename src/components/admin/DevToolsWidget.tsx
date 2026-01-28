import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSimulateUsers, useClearSimulation } from '@/hooks/useStressTest';
import { useSessionParticipants } from '@/hooks/useSessionParticipants';
import { 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Trash2, 
  Bug,
  Users
} from 'lucide-react';

interface DevToolsWidgetProps {
  sessionId: string;
}

export const DevToolsWidget: React.FC<DevToolsWidgetProps> = ({ sessionId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(50);
  
  const { totalCount } = useSessionParticipants({ sessionId, enabled: isOpen });
  const simulateMutation = useSimulateUsers(sessionId);
  const clearMutation = useClearSimulation(sessionId);

  const handleSimulate = () => {
    simulateMutation.mutate(count);
  };

  const handleClear = () => {
    clearMutation.mutate();
  };

  const isLoading = simulateMutation.isPending || clearMutation.isPending;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="w-72 shadow-lg border-2 border-dashed border-secondary/50 bg-background/95 backdrop-blur">
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-secondary" />
                  <span>開發者工具</span>
                  <Badge variant="outline" className="text-xs border-secondary text-secondary">
                    DEV
                  </Badge>
                </div>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 px-4 space-y-4">
              {/* Participant Count Badge */}
              <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4" />
                  <span>目前參與者</span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {totalCount ?? '—'}
                </Badge>
              </div>

              {/* Count Input */}
              <div className="space-y-2">
                <Label htmlFor="mock-count" className="text-xs">
                  模擬人數 (最多 100)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="mock-count"
                    type="number"
                    min={10}
                    max={100}
                    value={count}
                    onChange={(e) => setCount(Math.min(100, Math.max(10, parseInt(e.target.value) || 10)))}
                    className="w-20 h-9"
                    disabled={isLoading}
                  />
                  <div className="flex gap-1">
                    {[25, 50, 100].map((n) => (
                      <Button
                        key={n}
                        variant="outline"
                        size="sm"
                        onClick={() => setCount(n)}
                        disabled={isLoading}
                        className={`h-9 px-2 text-xs ${count === n ? 'border-primary' : ''}`}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={handleSimulate}
                  disabled={isLoading}
                  className="w-full h-10 gap-2"
                  variant="default"
                >
                  {simulateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  💥 壓力測試：加入 {count} 人
                </Button>

                <Button
                  onClick={handleClear}
                  disabled={isLoading}
                  className="w-full h-10 gap-2"
                  variant="destructive"
                >
                  {clearMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  🧹 清理模擬資料
                </Button>
              </div>

              {/* Info */}
              <p className="text-xs text-muted-foreground">
                模擬用戶使用 @test.local 郵箱，可隨時清除
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
