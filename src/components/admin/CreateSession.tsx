import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dumbbell, Download, CheckCircle, Copy, Flame, Gamepad2, Clock, Church } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { getSessionJoinUrl } from '@/lib/url-helpers';

interface CreateSessionProps {
  onCreated: () => void;
}

export const CreateSession: React.FC<CreateSessionProps> = ({ onCreated }) => {
  const { setCurrentSession, setIsAdmin } = useSession();
  const { user } = useAuth();
  const [churchUnit, setChurchUnit] = useState('');
  const [verseReference, setVerseReference] = useState('');
  const [icebreakerEnabled, setIcebreakerEnabled] = useState(true);
  const [icebreakerLevel, setIcebreakerLevel] = useState<'L1' | 'L2' | 'L3'>('L1');
  const [allowLatecomers, setAllowLatecomers] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState('');
  const [createdShortCode, setCreatedShortCode] = useState('');
  const [createdVerseRef, setCreatedVerseRef] = useState('');

  // Build the join URL dynamically using short code
  const joinUrl = createdShortCode ? getSessionJoinUrl(createdShortCode) : '';

  const handleCreate = async () => {
    if (!user) {
      toast.error('請先登入');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchUnit: churchUnit || undefined,
          verseReference,
          status: 'waiting',
          ownerId: user.id,
          icebreakerEnabled,
          icebreakerLevel: icebreakerEnabled ? icebreakerLevel : 'L1',
          allowLatecomers
        })
      });

      if (!response.ok) throw new Error('Failed to create session');
      const data = await response.json();

      setCurrentSession({
        id: data.id,
        shortCode: data.shortCode,
        bibleVerse: '',
        verseReference: data.verseReference,
        status: data.status as 'waiting' | 'grouping' | 'studying' | 'completed',
        createdAt: new Date(data.createdAt),
        groups: [],
      });
      setIsAdmin(true);
      
      // Show success modal with QR code
      setCreatedSessionId(data.id);
      setCreatedShortCode(data.shortCode || data.id.slice(0, 8));
      setCreatedVerseRef(data.verseReference);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('建立失敗，請重試');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(createdShortCode);
    toast.success('課程代碼已複製！');
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('created-session-qr');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `soul-gym-${createdShortCode}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    onCreated();
  };

  return (
    <>
      <Card variant="highlight" className="w-full max-w-xl mx-auto">
        <CardHeader className="text-center px-4 sm:px-6">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full gradient-orange flex items-center justify-center mb-4 glow-orange">
            <Dumbbell className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">開始新的健身課程</CardTitle>
          <CardDescription className="text-base sm:text-sm">
            Start a new Soul Gym training session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="church-unit" className="text-base font-semibold flex items-center gap-2">
              <Church className="w-4 h-4 text-primary" />
              課程單位 Church Unit
            </Label>
            <Input
              id="church-unit"
              value={churchUnit}
              onChange={(e) => setChurchUnit(e.target.value)}
              placeholder="例如: 台北靈糧堂 / Taipei Bread of Life Church"
              className="h-12 sm:h-14 text-base sm:text-lg"
              data-testid="input-church-unit"
            />
            <p className="text-sm text-muted-foreground">
              輸入開課的教會或單位名稱，方便日後搜尋
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verse" className="text-base font-semibold">
              訓練經文 Training Scripture
            </Label>
            <Input
              id="verse"
              value={verseReference}
              onChange={(e) => setVerseReference(e.target.value)}
              placeholder="例如: 約翰福音 3:1-21 / John 3:1-21"
              className="h-12 sm:h-14 text-base sm:text-lg"
            />
            <p className="text-sm text-muted-foreground">
              輸入今天訓練使用的經文章節
            </p>
          </div>

          {/* Session Options */}
          <div className="space-y-4 pt-2 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">課程設定</p>
            
            {/* Icebreaker Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-secondary" />
                <Label htmlFor="icebreaker-toggle" className="text-sm cursor-pointer">
                  啟用真心話不用冒險
                </Label>
              </div>
              <Switch
                id="icebreaker-toggle"
                checked={icebreakerEnabled}
                onCheckedChange={setIcebreakerEnabled}
              />
            </div>
            {icebreakerEnabled && (
              <div className="ml-6 space-y-3">
                <p className="text-xs text-muted-foreground">
                  分組後會先進行真心話不用冒險環節
                </p>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">起始難度</Label>
                  <div className="flex gap-2">
                    {([
                      { value: 'L1' as const, label: '真心話', desc: 'Warm-Up', color: 'bg-emerald-500 border-emerald-400 text-white' },
                      { value: 'L2' as const, label: '連結', desc: 'Connection', color: 'bg-amber-500 border-amber-400 text-white' },
                      { value: 'L3' as const, label: '深度', desc: 'Deep', color: 'bg-rose-500 border-rose-400 text-white' },
                    ]).map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setIcebreakerLevel(level.value)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                          icebreakerLevel === level.value
                            ? `${level.color} ring-2 ring-offset-1 ring-offset-background scale-[1.02]`
                            : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <div>{level.label}</div>
                        <div className="text-[10px] opacity-80">{level.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Allow Latecomers Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                <Label htmlFor="latecomer-toggle" className="text-sm cursor-pointer">
                  允許遲到者加入
                </Label>
              </div>
              <Switch
                id="latecomer-toggle"
                checked={allowLatecomers}
                onCheckedChange={setAllowLatecomers}
              />
            </div>
            {allowLatecomers && (
              <p className="text-xs text-muted-foreground ml-6">
                ⏰ 課程開始後，遲到者仍可加入最小組別
              </p>
            )}
          </div>

          <Button
            variant="default"
            size="xl"
            className="w-full bg-secondary hover:bg-secondary/90 text-white h-14 sm:h-12 text-base sm:text-lg"
            onClick={handleCreate}
            disabled={!verseReference || isCreating}
          >
            {isCreating ? (
              '準備中...'
            ) : (
              <>
                <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
                開始訓練 Start Training
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Success Modal with QR Code */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <CheckCircle className="w-6 h-6 text-accent" />
              聚會建立成功！
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 space-y-4">
            <p className="text-lg font-serif font-semibold text-center">
              {createdVerseRef}
            </p>
            
            {/* QR Code */}
            <div className="p-4 bg-white rounded-xl shadow-lg">
              <QRCodeSVG
                id="created-session-qr"
                value={joinUrl}
                size={200}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#1a1a2e"
              />
            </div>
            
            {/* Short Code with copy */}
            <div className="flex items-center gap-3 px-5 py-3 bg-muted rounded-xl">
              <span className="text-2xl font-mono font-bold tracking-widest text-foreground">
                {createdShortCode}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              掃描 QR Code 或輸入 4 碼代碼加入課程
            </p>
            
            {/* Action buttons */}
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleDownloadQR}>
                <Download className="w-4 h-4 mr-2" />
                下載 QR Code
              </Button>
              <Button variant="gold" className="flex-1" onClick={handleCloseModal}>
                進入等候室
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
