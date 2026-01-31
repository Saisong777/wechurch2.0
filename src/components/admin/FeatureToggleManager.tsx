import React, { useState } from 'react';
import { useFeatureToggles, FeatureToggle } from '@/hooks/useFeatureToggles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings, Power, PowerOff, Edit2, Save, X, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FeatureToggleManagerProps {
  onBack?: () => void;
}

export const FeatureToggleManager: React.FC<FeatureToggleManagerProps> = ({ onBack }) => {
  const { features, loading, updateFeature, refetch } = useFeatureToggles();
  const [editingFeature, setEditingFeature] = useState<FeatureToggle | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggle = async (feature: FeatureToggle) => {
    setUpdating(feature.feature_key);
    const success = await updateFeature(feature.feature_key, !feature.is_enabled);
    
    if (success) {
      toast.success(
        feature.is_enabled 
          ? `已關閉「${feature.feature_name}」` 
          : `已開啟「${feature.feature_name}」`
      );
    } else {
      toast.error('更新失敗，請稍後再試');
    }
    setUpdating(null);
  };

  const handleEditMessage = (feature: FeatureToggle) => {
    setEditingFeature(feature);
    setEditMessage(feature.disabled_message || '即將推出');
  };

  const handleSaveMessage = async () => {
    if (!editingFeature) return;
    
    setUpdating(editingFeature.feature_key);
    const success = await updateFeature(
      editingFeature.feature_key, 
      editingFeature.is_enabled, 
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

  // Group features by category
  const mainFeatures = features.filter(f => 
    ['we_live', 'we_learn', 'we_play', 'we_share'].includes(f.feature_key)
  );
  const subFeatures = features.filter(f => 
    !['we_live', 'we_learn', 'we_play', 'we_share'].includes(f.feature_key)
  );

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
              控制各項功能的開放狀態
            </p>
          </div>
        </div>
      </div>

      {/* Main Features */}
      <div>
        <h3 className="text-lg font-medium mb-4">主要功能</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {mainFeatures.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              updating={updating === feature.feature_key}
              onToggle={() => handleToggle(feature)}
              onEditMessage={() => handleEditMessage(feature)}
            />
          ))}
        </div>
      </div>

      {/* Sub Features */}
      {subFeatures.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">子功能</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subFeatures.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                updating={updating === feature.feature_key}
                onToggle={() => handleToggle(feature)}
                onEditMessage={() => handleEditMessage(feature)}
                compact
              />
            ))}
          </div>
        </div>
      )}

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
              <p className="text-sm text-muted-foreground">{editingFeature?.feature_name}</p>
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
            <Button onClick={handleSaveMessage} disabled={updating === editingFeature?.feature_key}>
              {updating === editingFeature?.feature_key ? (
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

interface FeatureCardProps {
  feature: FeatureToggle;
  updating: boolean;
  onToggle: () => void;
  onEditMessage: () => void;
  compact?: boolean;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  feature,
  updating,
  onToggle,
  onEditMessage,
  compact = false,
}) => {
  return (
    <Card className={`transition-all ${feature.is_enabled ? '' : 'opacity-75 border-dashed'}`}>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className={`flex items-center gap-2 ${compact ? 'text-base' : ''}`}>
              {feature.is_enabled ? (
                <Power className="w-4 h-4 text-accent flex-shrink-0" />
              ) : (
                <PowerOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className="truncate">{feature.feature_name}</span>
            </CardTitle>
            {feature.description && !compact && (
              <CardDescription className="mt-1">
                {feature.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {updating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Switch
                checked={feature.is_enabled}
                onCheckedChange={onToggle}
                aria-label={`Toggle ${feature.feature_name}`}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? 'pt-0' : ''}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={feature.is_enabled ? 'default' : 'secondary'}>
              {feature.is_enabled ? '開放中' : feature.disabled_message || '已關閉'}
            </Badge>
          </div>
          {!feature.is_enabled && (
            <Button variant="ghost" size="sm" onClick={onEditMessage} className="h-7 px-2">
              <Edit2 className="w-3 h-3 mr-1" />
              編輯訊息
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
