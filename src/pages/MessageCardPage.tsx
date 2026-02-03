import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Download, Image, Loader2, Lock, Mail, User, ChevronLeft, ScanLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRCodeScanner } from '@/components/user/QRCodeScanner';
import { staggeredStart, withRetry } from '@/lib/retry-utils';
import { FeatureGate } from '@/components/ui/feature-gate';
import { getMessageCardUrl } from '@/lib/storage-helpers';

type PageStep = 'initializing' | 'enter-code' | 'auth' | 'download';

interface MessageCard {
  id: string;
  title: string;
  shortCode: string;
  imagePath: string;
  createdAt: string;
}

/**
 * High-Concurrency Optimized Message Card Download Page
 * Supports 500+ concurrent users with:
 * - Staggered start (0-1.5s random delay)
 * - Exponential backoff with jitter for retries
 * - Non-blocking download recording
 */
export const MessageCardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [step, setStep] = useState<PageStep>('initializing');
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [card, setCard] = useState<MessageCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Guest auth state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // High-concurrency: prevent duplicate operations
  const initializingRef = useRef(false);
  const recordingRef = useRef(false);

  // High-concurrency: Staggered start to prevent thundering herd
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    const initialize = async () => {
      // Random delay 0-1.5s to spread out concurrent connections
      await staggeredStart(1500);
      
      // Load saved guest info
      const savedName = localStorage.getItem('bible_study_guest_name');
      const savedEmail = localStorage.getItem('bible_study_guest_email');
      if (savedName) setGuestName(savedName);
      if (savedEmail) setGuestEmail(savedEmail);

      // Check for URL code
      const urlCode = searchParams.get('code');
      if (urlCode) {
        setCode(urlCode);
        await handleCheckCode(urlCode);
      } else {
        setStep('enter-code');
      }
    };

    initialize();
  }, []);

  // When user becomes authenticated and we have a card, go to download
  useEffect(() => {
    if (!authLoading && user && card && step === 'auth') {
      recordDownloadAndShow();
    }
  }, [user, authLoading, card, step]);

  /**
   * Fetch card with retry logic for high-concurrency resilience
   */
  const handleCheckCode = async (checkCode?: string) => {
    const codeToCheck = (checkCode || code).toUpperCase().trim();
    if (!codeToCheck || codeToCheck.length !== 4) {
      toast.error('請輸入 4 位數代碼');
      setStep('enter-code');
      return;
    }

    setLoading(true);
    try {
      // Use retry with exponential backoff for high-concurrency
      const data = await withRetry(
        async () => {
          const response = await fetch(`/api/message-cards/${codeToCheck}`);
          if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Failed to fetch card');
          }
          return await response.json();
        },
        { maxRetries: 3, baseDelayMs: 500, jitterFactor: 0.4 }
      );
      
      if (!data) {
        toast.error('找不到此代碼的圖片');
        setStep('enter-code');
        setLoading(false);
        return;
      }

      setCard(data);
      
      // Use proxy URL to hide Supabase storage URL from users
      setImageUrl(getMessageCardUrl(data.imagePath, 'view'));

      // If already logged in, proceed to download
      if (user) {
        await recordDownloadAndShow();
      } else {
        setStep('auth');
      }
    } catch (err) {
      console.error('Error fetching card:', err);
      toast.error('查詢失敗，請重試');
      setStep('enter-code');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Record download with non-blocking fire-and-forget pattern
   * Download succeeds even if recording fails
   */
  const recordDownloadAndShow = async () => {
    if (!card) return;
    
    // Prevent duplicate recording
    if (recordingRef.current) return;
    recordingRef.current = true;

    // Show download immediately (non-blocking)
    setStep('download');

    // Fire-and-forget: record download in background with retry
    try {
      const userName = user?.user_metadata?.display_name || 
                       user?.user_metadata?.full_name || 
                       guestName || 
                       '未知';
      const userEmail = user?.email || guestEmail || '未知';

      // Background recording with retry - don't await to not block UI
      withRetry(
        async () => {
          const response = await fetch('/api/message-card-downloads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cardId: card.id,
              userId: user?.id || null,
              userName: userName,
              userEmail: userEmail,
            }),
          });
          if (!response.ok) throw new Error('Failed to record download');
        },
        { maxRetries: 2, baseDelayMs: 1000, jitterFactor: 0.5 }
      ).catch(err => {
        // Silent fail - download recording is not critical
        console.warn('Failed to record download (non-critical):', err);
      });
    } catch (err) {
      // Silent fail - download recording is not critical
      console.warn('Error preparing download record:', err);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      // Redirect to Replit auth
      window.location.href = `/api/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    } catch (err) {
      toast.error('登入失敗，請重試');
      setIsGoogleLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) {
      toast.error('請填寫姓名和電子郵件');
      return;
    }

    // Save to localStorage
    localStorage.setItem('bible_study_guest_name', guestName);
    localStorage.setItem('bible_study_guest_email', guestEmail);

    // Sync to potential_members table (non-blocking)
    // First try to insert, if conflict then we don't need to update since they already exist
    withRetry(
      async () => {
        const normalizedEmail = guestEmail.trim().toLowerCase();
        const response = await fetch('/api/potential-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            name: guestName.trim(),
            firstJoinedAt: new Date().toISOString(),
            lastSessionAt: new Date().toISOString(),
            sessionsCount: 1,
          }),
        });
        // Ignore 409 conflict errors - user already exists which is fine
        if (!response.ok && response.status !== 409) {
          throw new Error('Failed to sync potential member');
        }
      },
      { maxRetries: 2, baseDelayMs: 500, jitterFactor: 0.3 }
    ).catch(err => {
      console.warn('Failed to sync to potential_members (non-critical):', err);
    });

    // Record and show download
    await recordDownloadAndShow();
  };

  const handleDownload = async () => {
    if (!card) return;
    
    setLoading(true);
    try {
      // Use edge function proxy to hide Supabase URL from users
      const proxyUrl = getMessageCardUrl(card.imagePath, 'download');
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${card.title || 'message-card'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
      
      toast.success('下載完成！');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('下載失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = (scannedValue: string) => {
    // Extract code from URL or use directly
    let cardCode = scannedValue;
    
    try {
      const url = new URL(scannedValue);
      const codeParam = url.searchParams.get('code');
      if (codeParam) {
        cardCode = codeParam;
      }
    } catch {
      // Not a URL, use as-is (might be direct 4-digit code)
    }

    // Clean up and validate
    cardCode = cardCode.toUpperCase().trim();
    if (cardCode.length === 4) {
      setCode(cardCode);
      handleCheckCode(cardCode);
    } else {
      toast.error('無效的 QR Code');
    }
  };

  // Loading state during initialization
  const renderInitializing = () => (
    <div className="px-4 py-16 max-w-md mx-auto flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-secondary mb-4" />
      <p className="text-muted-foreground">載入中...</p>
    </div>
  );

  const renderEnterCode = () => (
    <div className="px-4 py-8 max-w-md mx-auto">
      <Card className="border-2">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full gradient-gold flex items-center justify-center glow-gold">
            <Image className="w-8 h-8 text-secondary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-serif">本週信息摘要</CardTitle>
            <CardDescription className="text-base mt-2">
              掃描 QR Code 或輸入 4 位數代碼下載信息卡片
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* QR Code Scanner Button */}
          <Button
            variant="outline"
            size="lg"
            className="w-full h-14 text-base border-2 border-dashed hover:border-secondary hover:bg-secondary/5"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="w-5 h-5 mr-2" />
            掃描 QR Code
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">或輸入代碼</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code" className="text-base">代碼 Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="例如：AB12"
              className="h-14 text-2xl text-center font-mono tracking-widest uppercase"
              maxLength={4}
            />
          </div>
          <Button
            variant="gold"
            size="lg"
            className="w-full"
            onClick={() => handleCheckCode()}
            disabled={loading || code.length !== 4}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />查詢中...</>
            ) : (
              <>查詢 Search</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* QR Code Scanner Dialog */}
      <QRCodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleQRScan}
      />
    </div>
  );

  const renderAuth = () => (
    <div className="px-4 py-8 max-w-md mx-auto">
      <Card className="border-2">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-serif">登入以下載</CardTitle>
            <CardDescription className="text-base mt-2">
              {card?.title}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview thumbnail */}
          {imageUrl && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted relative">
              <img 
                src={imageUrl} 
                alt={card?.title}
                className="w-full h-full object-cover blur-sm opacity-70"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-12 h-12 text-white/80" />
              </div>
            </div>
          )}

          {/* Google Sign In */}
          <Button
            variant="outline"
            size="lg"
            className="w-full h-12 text-base border-2 hover:bg-muted/50"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {isGoogleLoading ? '連接中...' : '使用 Google 登入'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">或</span>
            </div>
          </div>

          {/* Guest form */}
          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guestName" className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                姓名 Name
              </Label>
              <Input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="請輸入您的姓名"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestEmail" className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                電子郵件 Email
              </Label>
              <Input
                id="guestEmail"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-11"
                required
              />
            </div>

            <Button type="submit" variant="gold" size="lg" className="w-full">
              繼續下載 Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  const renderDownload = () => (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <Card className="border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif">{card?.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Image preview */}
          {imageUrl && (
            <div className="rounded-lg overflow-hidden bg-muted">
              <img 
                src={imageUrl} 
                alt={card?.title}
                className="w-full h-auto"
              />
            </div>
          )}

          <Button
            variant="gold"
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleDownload}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />下載中...</>
            ) : (
              <><Download className="w-5 h-5 mr-2" />下載圖片 Download</>
            )}
          </Button>

        </CardContent>
      </Card>
    </div>
  );

  return (
    <FeatureGate 
      featureKey="we_share" 
      title="信息圖卡維護中"
      description="信息圖卡功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header 
          variant="compact"
          title="信息摘要卡片"
          subtitle="Message Card"
        />
        
        <main className="container mx-auto max-w-4xl">
          {step === 'initializing' && renderInitializing()}
          {step === 'enter-code' && renderEnterCode()}
          {step === 'auth' && renderAuth()}
          {step === 'download' && renderDownload()}
        </main>
      </div>
    </FeatureGate>
  );
};

export default MessageCardPage;
