import { Castle, LayoutList } from 'lucide-react';
import type { HomeMode } from '@/hooks/useHomeMode';
import './castle-home.css';

export function HomeModeSwitch({ mode, onChange }: { mode: HomeMode; onChange: (mode: HomeMode) => void }) {
  return <div className="home-mode-bar">
    <p>用你喜歡的方式，回到教會。</p>
    <div className="home-mode-switch" role="group" aria-label="首頁顯示模式">
      <button type="button" aria-pressed={mode === 'traditional'} onClick={() => onChange('traditional')}><LayoutList aria-hidden="true" size={16} />傳統模式</button>
      <button type="button" aria-pressed={mode === 'castle'} onClick={() => onChange('castle')}><Castle aria-hidden="true" size={16} />城堡模式<span>遊戲化</span></button>
    </div>
  </div>;
}
