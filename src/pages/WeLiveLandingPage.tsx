import { Dumbbell, BookMarked, QrCode, ClipboardList } from 'lucide-react';
import { FeatureGate } from '@/components/ui/feature-gate';
import { FeaturePortalPage, FeaturePortalAction } from '@/components/product/FeaturePortalPage';

const actions: FeaturePortalAction[] = [
  {
    id: 'study',
    title: '加入查經',
    subtitle: '輸入代碼或掃 QR 開始',
    icon: QrCode,
    href: '/user/study',
    tone: 'bg-primary/15',
    iconTone: 'text-primary',
    badge: '現場使用',
    testId: 'link-feature-study',
  },
  {
    id: 'notebook',
    title: '打開查經筆記',
    subtitle: '個人紀錄、小組整理與會後回顧',
    icon: BookMarked,
    href: '/user/notebook',
    tone: 'bg-amber-500/15',
    iconTone: 'text-amber-600',
    badge: '會後整理',
    testId: 'link-feature-notebook',
  },
  {
    id: 'admin',
    title: '主持 SoulGym',
    subtitle: '建立查經、邀請成員、分組、查看 AI 成果',
    icon: ClipboardList,
    href: '/admin',
    tone: 'bg-secondary/15',
    iconTone: 'text-secondary',
    badge: '帶領者',
    testId: 'link-feature-admin',
  },
];

export const WeLiveLandingPage = () => {
  return (
    <FeatureGate
      featureKeys={['we_live']}
      title="靈魂健身房維護中"
      description="Soul Gym 功能目前暫時關閉，請稍後再試"
    >
      <FeaturePortalPage
        title="SoulGym"
        subtitle="靈魂健身房"
        eyebrow="Bible study flow"
        description="從加入、分組、分享、查經到 AI 整理，讓一場查經班可以穩定地走完，也留下可以回看的屬靈成果。"
        icon={Dumbbell}
        iconTone="bg-primary/15 text-primary"
        actions={actions}
        moments={[
          { label: '進場', value: '代碼、QR Code、手機加入' },
          { label: '現場', value: '分組、抽卡、三步驟查經' },
          { label: '會後', value: '小組摘要、大組總結、個人筆記' },
        ]}
      />
    </FeatureGate>
  );
};

export default WeLiveLandingPage;
