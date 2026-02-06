import React, { useState, useMemo } from 'react';
import { useFeatureToggles, FeatureToggle } from '@/hooks/useFeatureToggles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings, Power, PowerOff, Edit2, Save, ChevronLeft, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FeatureToggleManagerProps {
  onBack?: () => void;
}

const FEATURE_HIERARCHY: Record<string, string[]> = {
  we_live: ['bible_study', 'notebook'],
  we_learn: ['bible_reading', 'jesus_timeline', 'reading_plans'],
  we_play: ['icebreaker_game', 'random_grouper'],
  we_share: ['prayer_wall', 'prayer_meeting', 'message_cards'],
};

const PARENT_FEATURE_KEYS = Object.keys(FEATURE_HIERARCHY);

export const FeatureToggleManager: React.FC<FeatureToggleManagerProps> = ({ onBack }) => {
  const { features, loading, updateFeature, isFeatureEnabled } = useFeatureToggles();
  const [editingFeature, setEditingFeature] = useState<FeatureToggle | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set(PARENT_FEATURE_KEYS));

  // Group features by parent/child
  const { parentFeatures, childFeaturesByParent } = useMemo(() => {
    const parents: FeatureToggle[] = [];
    const children: Record<string, FeatureToggle[]> = {};

    // Initialize children arrays
    PARENT_FEATURE_KEYS.forEach(key => {
      children[key] = [];
    });

    features.forEach(feature => {
      if (PARENT_FEATURE_KEYS.includes(feature.featureKey)) {
        parents.push(feature);
      } else {
        // Find which parent this child belongs to
        for (const [parentKey, childKeys] of Object.entries(FEATURE_HIERARCHY)) {
          if (childKeys.includes(feature.featureKey)) {
            children[parentKey].push(feature);
            break;
          }
        }
      }
    });

    // Sort parents by feature_key
    parents.sort((a, b) => a.featureKey.localeCompare(b.featureKey));

    return { parentFeatures: parents, childFeaturesByParent: children };
  }, [features]);

  const handleToggle = async (feature: FeatureToggle) => {
    setUpdating(feature.featureKey);
    const success = await updateFeature(feature.featureKey, !feature.isEnabled);
    
    if (success) {
      toast.success(
        feature.isEnabled 
          ? `已關閉「${feature.featureName}」` 
          : `已開啟「${feature.featureName}」`
      );
    } else {
      toast.error('更新失敗，請稍後再試');
    }
    setUpdating(null);
  };

  const handleEditMessage = (feature: FeatureToggle) => {
    setEditingFeature(feature);
    setEditMessage(feature.disabledMessage || '即將推出');
  };

  const handleSaveMessage = async () => {
    if (!editingFeature) return;
    
    setUpdating(editingFeature.featureKey);
    const success = await updateFeature(
      editingFeature.featureKey, 
      editingFeature.isEnabled, 
      editMessage
    );
    
    if (success) {
      toast.success('已更新關閉訊息');
      setEditingFeature(null);
    } else {
      toast.error('更新失敗，請稍後再試');
    }
    setUpdating(null);
  };

  const toggleExpanded = (parentKey: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentKey)) {
        next.delete(parentKey);
      } else {
        next.add(parentKey);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
              功能開關管理
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              控制各項功能的開放狀態（父層關閉時子層自動鎖定）
            </p>
          </div>
        </div>
      </div>

      {/* Feature Tree */}
      <div className="space-y-4">
        {parentFeatures.map((parent) => {
          const childFeatures = childFeaturesByParent[parent.featureKey] || [];
          const isExpanded = expandedParents.has(parent.featureKey);
          const hasChildren = childFeatures.length > 0;

          return (
            <Collapsible
              key={parent.id}
              open={isExpanded}
              onOpenChange={() => hasChildren && toggleExpanded(parent.featureKey)}
            >
              <Card className={`transition-all ${parent.isEnabled ? '' : 'opacity-75 border-dashed'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {hasChildren && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          {parent.isEnabled ? (
                            <Power className="w-5 h-5 text-accent flex-shrink-0" />
                          ) : (
                            <PowerOff className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="truncate">{parent.featureName}</span>
                          {hasChildren && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {childFeatures.length} 子功能
                            </Badge>
                          )}
                        </CardTitle>
                        {parent.description && (
                          <CardDescription className="mt-1 ml-7">
                            {parent.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {updating === parent.featureKey ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Switch
                          checked={parent.isEnabled}
                          onCheckedChange={() => handleToggle(parent)}
                          aria-label={`Toggle ${parent.featureName}`}
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={parent.isEnabled ? 'default' : 'secondary'}>
                      {parent.isEnabled ? '開放中' : parent.disabledMessage || '已關閉'}
                    </Badge>
                    {!parent.isEnabled && (
                      <Button variant="ghost" size="sm" onClick={() => handleEditMessage(parent)} className="h-7 px-2">
                        <Edit2 className="w-3 h-3 mr-1" />
                        編輯訊息
                      </Button>
                    )}
                  </div>

                  {/* Child Features */}
                  {hasChildren && (
                    <CollapsibleContent className="mt-4">
                      <div className="border-l-2 border-muted ml-4 pl-4 space-y-3">
                        {childFeatures.map((child) => (
                          <ChildFeatureCard
                            key={child.id}
                            feature={child}
                            parentEnabled={parent.isEnabled}
                            updating={updating === child.featureKey}
                            onToggle={() => handleToggle(child)}
                            onEditMessage={() => handleEditMessage(child)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  )}
                </CardContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Edit Message Dialog */}
      <Dialog open={!!editingFeature} onOpenChange={(open) => !open && setEditingFeature(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯關閉訊息</DialogTitle>
            <DialogDescription>
              設定當功能關閉時顯示給使用者的訊息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>功能名稱</Label>
              <p className="text-sm text-muted-foreground">{editingFeature?.featureName}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">關閉時顯示訊息</Label>
              <Input
                id="message"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                placeholder="例如：即將推出、維護中、尚未開放"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFeature(null)}>
              取消
            </Button>
            <Button onClick={handleSaveMessage} disabled={updating === editingFeature?.featureKey}>
              {updating === editingFeature?.featureKey ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface ChildFeatureCardProps {
  feature: FeatureToggle;
  parentEnabled: boolean;
  updating: boolean;
  onToggle: () => void;
  onEditMessage: () => void;
}

const ChildFeatureCard: React.FC<ChildFeatureCardProps> = ({
  feature,
  parentEnabled,
  updating,
  onToggle,
  onEditMessage,
}) => {
  const isLocked = !parentEnabled;
  const effectivelyDisabled = isLocked || !feature.isEnabled;

  return (
    <div className={`p-3 rounded-lg border ${effectivelyDisabled ? 'bg-muted/30 border-dashed' : 'bg-card'} transition-all`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isLocked ? (
            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : feature.isEnabled ? (
            <Power className="w-4 h-4 text-accent flex-shrink-0" />
          ) : (
            <PowerOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${isLocked ? 'text-muted-foreground' : ''}`}>
              {feature.featureName}
            </p>
            {feature.description && (
              <p className="text-xs text-muted-foreground truncate">
                {feature.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {updating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Switch
              checked={feature.isEnabled}
              onCheckedChange={onToggle}
              disabled={isLocked}
              aria-label={`Toggle ${feature.featureName}`}
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          {isLocked ? (
            <Badge variant="outline" className="text-xs">
              <Lock className="w-3 h-3 mr-1" />
              父層已關閉
            </Badge>
          ) : (
            <Badge variant={feature.isEnabled ? 'default' : 'secondary'} className="text-xs">
              {feature.isEnabled ? '開放中' : feature.disabledMessage || '已關閉'}
            </Badge>
          )}
        </div>
        {!feature.isEnabled && !isLocked && (
          <Button variant="ghost" size="sm" onClick={onEditMessage} className="h-6 px-2 text-xs">
            <Edit2 className="w-3 h-3 mr-1" />
            編輯
          </Button>
        )}
      </div>
    </div>
  );
};
