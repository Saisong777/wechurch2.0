import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dumbbell, Play, Download, CheckCircle, Copy, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { getSessionJoinUrl } from '@/lib/url-helpers';

interface CreateSessionProps {
  onCreated: () => void;
}

export const CreateSession: React.FC<CreateSessionProps> = ({ onCreated }) => {
  const { setCurrentSession, setIsAdmin } = useSession();
  const { user } = useAuth();
  const [verseReference, setVerseReference] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState('');
  const [createdVerseRef, setCreatedVerseRef] = useState('');

  // Build the join URL dynamically
  const joinUrl = createdSessionId ? getSessionJoinUrl(createdSessionId) : '';

  const handleCreate = async () => {
    if (!user) {
      toast.error('請先登入');
      return;
    }
    
    setIsCreating(true);
    
    const { data, error } = await supabase
      .from('sessions')
      .insert({ 
        verse_reference: verseReference, 
        status: 'waiting',
        owner_id: user.id 
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating session:', error);
      toast.error('建立失敗，請重試');
      setIsCreating(false);
      return;
    }

    setCurrentSession({
      id: data.id,
      bibleVerse: '',
      verseReference: data.verse_reference,
      status: data.status as 'waiting' | 'grouping' | 'studying' | 'completed',
      createdAt: new Date(data.created_at),
      groups: [],
    });
    setIsAdmin(true);
    
    // Show success modal with QR code
    setCreatedSessionId(data.id);
    setCreatedVerseRef(data.verse_reference);
    setShowSuccessModal(true);
    
    setIsCreating(false);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(createdSessionId);
    toast.success('Session ID 已複製！');
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
      downloadLink.download = `bible-study-${createdSessionId.slice(0, 8)}.png`;
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
            
            {/* Session ID with copy */}
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
              <span className="text-sm font-mono text-muted-foreground">
                ID: {createdSessionId.slice(0, 8)}...
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyId}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              掃描 QR Code 或輸入 Session ID 加入聚會
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
