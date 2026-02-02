import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy, Share2, Image, Check, X, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Verse {
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ScriptureViewerProps {
  verses: Verse[];
  className?: string;
}

const BACKGROUND_PRESETS = [
  { id: 'gradient1', name: '晨曦', style: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient2', name: '夕陽', style: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'gradient3', name: '大海', style: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'gradient4', name: '森林', style: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { id: 'gradient5', name: '天空', style: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { id: 'gradient6', name: '星夜', style: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)' },
];

const TEXT_POSITIONS = [
  { id: 'top-left', name: '左上', align: 'items-start justify-start', textAlign: 'text-left' },
  { id: 'top-center', name: '上', align: 'items-start justify-center', textAlign: 'text-center' },
  { id: 'top-right', name: '右上', align: 'items-start justify-end', textAlign: 'text-right' },
  { id: 'center-left', name: '左', align: 'items-center justify-start', textAlign: 'text-left' },
  { id: 'center', name: '中', align: 'items-center justify-center', textAlign: 'text-center' },
  { id: 'center-right', name: '右', align: 'items-center justify-end', textAlign: 'text-right' },
  { id: 'bottom-left', name: '左下', align: 'items-end justify-start', textAlign: 'text-left' },
  { id: 'bottom-center', name: '下', align: 'items-end justify-center', textAlign: 'text-center' },
  { id: 'bottom-right', name: '右下', align: 'items-end justify-end', textAlign: 'text-right' },
];

const ASPECT_RATIOS = [
  { id: 'square', name: '正方形', ratio: 'aspect-square', width: 400, height: 400 },
  { id: 'portrait', name: '直式 3:4', ratio: 'aspect-[3/4]', width: 400, height: 533 },
  { id: 'story', name: '限時動態 9:16', ratio: 'aspect-[9/16]', width: 360, height: 640 },
  { id: 'landscape', name: '橫式 4:3', ratio: 'aspect-[4/3]', width: 480, height: 360 },
  { id: 'wide', name: '寬螢幕 16:9', ratio: 'aspect-[16/9]', width: 480, height: 270 },
];

const FONT_SIZES = [
  { id: 'sm', name: '小', verse: 'text-base', ref: 'text-sm', message: 'text-sm' },
  { id: 'md', name: '中', verse: 'text-lg', ref: 'text-base', message: 'text-base' },
  { id: 'lg', name: '大', verse: 'text-xl', ref: 'text-lg', message: 'text-lg' },
  { id: 'xl', name: '特大', verse: 'text-2xl', ref: 'text-xl', message: 'text-xl' },
];

export const ScriptureViewer = ({ verses, className = '' }: ScriptureViewerProps) => {
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardBackground, setCardBackground] = useState(BACKGROUND_PRESETS[0].style);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [personalMessage, setPersonalMessage] = useState('');
  const [textPosition, setTextPosition] = useState(TEXT_POSITIONS[4]);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[1]);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getVerseKey = (v: Verse) => `${v.bookName}-${v.chapter}-${v.verse}`;

  const toggleVerseSelection = (v: Verse) => {
    const key = getVerseKey(v);
    setSelectedVerses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedVerses(new Set());
  };

  const getSelectedVersesList = () => {
    return verses.filter(v => selectedVerses.has(getVerseKey(v)));
  };

  const formatVerseReference = (versesList: Verse[]) => {
    if (versesList.length === 0) return '';
    const first = versesList[0];
    const last = versesList[versesList.length - 1];
    if (versesList.length === 1) {
      return `${first.bookName} ${first.chapter}:${first.verse}`;
    }
    return `${first.bookName} ${first.chapter}:${first.verse}-${last.verse}`;
  };

  const formatVersesText = (versesList: Verse[]) => {
    const text = versesList.map(v => v.text).join(' ');
    const ref = formatVerseReference(versesList);
    return `${text}\n— ${ref}`;
  };

  const handleCopySelected = async () => {
    const selected = getSelectedVersesList();
    if (selected.length === 0) {
      toast({ title: '請先選擇經文', variant: 'destructive' });
      return;
    }
    try {
      await navigator.clipboard.writeText(formatVersesText(selected));
      setCopied(true);
      toast({ title: '已複製', description: `已複製 ${selected.length} 節經文` });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: '複製失敗', variant: 'destructive' });
    }
  };

  const handleShareSelected = async () => {
    const selected = getSelectedVersesList();
    if (selected.length === 0) {
      toast({ title: '請先選擇經文', variant: 'destructive' });
      return;
    }
    const text = formatVersesText(selected);
    if (navigator.share) {
      try {
        await navigator.share({ title: formatVerseReference(selected), text });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(text);
          toast({ title: '已複製到剪貼簿' });
        }
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: '已複製到剪貼簿' });
    }
  };

  const handleOpenCardCreator = () => {
    const selected = getSelectedVersesList();
    if (selected.length === 0) {
      toast({ title: '請先選擇經文', variant: 'destructive' });
      return;
    }
    setShowCardModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement('a');
      link.download = `verse-card-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: '下載成功', description: '圖片已儲存' });
    } catch (err) {
      toast({ title: '下載失敗', variant: 'destructive' });
    }
  };

  const handleShareCard = async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], 'verse-card.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: '經文卡片' });
              return;
            } catch (err) {
              if ((err as Error).name === 'AbortError') return;
            }
          }
        }
        const link = document.createElement('a');
        link.download = `verse-card-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast({ title: '已下載圖片' });
      }, 'image/png');
    } catch (err) {
      toast({ title: '分享失敗', variant: 'destructive' });
    }
  };

  const selectedList = getSelectedVersesList();
  const hasSelection = selectedList.length > 0;

  return (
    <div className={className}>
      {hasSelection && (
        <div className="sticky top-0 z-[100] bg-background/95 backdrop-blur border-b border-border p-2 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">已選 {selectedList.length} 節</span>
          <Button variant="outline" size="sm" onClick={handleCopySelected} data-testid="button-copy-selected">
            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
            複製
          </Button>
          <Button variant="outline" size="sm" onClick={handleShareSelected} data-testid="button-share-selected">
            <Share2 className="w-3 h-3 mr-1" />
            分享
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenCardCreator} data-testid="button-create-card">
            <Image className="w-3 h-3 mr-1" />
            圖文卡
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection} data-testid="button-clear-selection">
            <X className="w-3 h-3 mr-1" />
            取消選取
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {verses.map((v) => {
          const key = getVerseKey(v);
          const isSelected = selectedVerses.has(key);
          return (
            <div
              key={key}
              className={`flex gap-2 p-2 rounded cursor-pointer transition-colors ${
                isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'
              }`}
              onClick={() => toggleVerseSelection(v)}
              data-testid={`verse-${v.chapter}-${v.verse}`}
            >
              {isSelected && <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />}
              <span className="text-primary font-medium min-w-[1.5rem]">{v.verse}</span>
              <span className="text-sm leading-relaxed">{v.text}</span>
            </div>
          );
        })}
      </div>

      <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>製作經文圖卡</DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div
                ref={cardRef}
                className={`relative ${aspectRatio.ratio} w-full max-w-md mx-auto rounded-lg overflow-hidden`}
                style={{
                  background: customImage ? undefined : cardBackground,
                }}
              >
                {customImage && (
                  <img
                    src={customImage}
                    alt="背景"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {customImage && <div className="absolute inset-0 bg-black/40" />}
                <div className={`relative h-full flex flex-col ${textPosition.align} p-6`}>
                  <div className={`${textPosition.textAlign} max-w-full`}>
                    <p className={`${fontSize.verse} text-white font-medium leading-relaxed mb-3 drop-shadow-lg`}>
                      {selectedList.map(v => v.text).join(' ')}
                    </p>
                    <p className={`${fontSize.ref} text-white/90 drop-shadow`}>
                      — {formatVerseReference(selectedList)}
                    </p>
                    {personalMessage && (
                      <p className={`${fontSize.message} text-white/80 mt-4 italic drop-shadow`}>
                        {personalMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">背景樣式</label>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        cardBackground === preset.style && !customImage
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent'
                      }`}
                      style={{ background: preset.style }}
                      onClick={() => { setCardBackground(preset.style); setCustomImage(null); }}
                      title={preset.name}
                      data-testid={`button-bg-${preset.id}`}
                    />
                  ))}
                  <button
                    className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center bg-muted ${
                      customImage ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    title="上傳圖片"
                    data-testid="button-upload-bg"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">比例</label>
                <div className="flex flex-wrap gap-1">
                  {ASPECT_RATIOS.map((ratio) => (
                    <Button
                      key={ratio.id}
                      variant={aspectRatio.id === ratio.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAspectRatio(ratio)}
                      data-testid={`button-ratio-${ratio.id}`}
                    >
                      {ratio.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">文字大小</label>
                <div className="flex flex-wrap gap-1">
                  {FONT_SIZES.map((size) => (
                    <Button
                      key={size.id}
                      variant={fontSize.id === size.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFontSize(size)}
                      data-testid={`button-size-${size.id}`}
                    >
                      {size.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">文字位置</label>
                <div className="grid grid-cols-3 gap-1 max-w-[150px]">
                  {TEXT_POSITIONS.map((pos) => (
                    <Button
                      key={pos.id}
                      variant={textPosition.id === pos.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextPosition(pos)}
                      data-testid={`button-pos-${pos.id}`}
                    >
                      {pos.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">個人寄語（選填）</label>
                <Input
                  placeholder="寫下你的祝福..."
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  data-testid="input-personal-message"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleDownloadCard} className="flex-1" data-testid="button-download-card">
                  <Download className="w-4 h-4 mr-2" />
                  下載
                </Button>
                <Button onClick={handleShareCard} variant="outline" className="flex-1" data-testid="button-share-card">
                  <Share2 className="w-4 h-4 mr-2" />
                  分享
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScriptureViewer;
