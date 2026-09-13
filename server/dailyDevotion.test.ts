import { describe, expect, it } from 'vitest';
import { parseMorningBriefHtml } from './dailyDevotion';

describe('parseMorningBriefHtml', () => {
  it('maps the morning brief HTML into WeChurch daily devotion data', () => {
    const html = `
      <main>
        <header>
          <h1>先愛神，再愛人，然後工作</h1>
          <p class="subtitle">2026-05-16 · 以西結書 13:1-23 · 愛神，愛人</p>
        </header>
        <section class="devotion">
          <h2>01 先對齊神</h2>
          <h3>辨識虛假的平安，重建真實的信仰牆垣</h3>
          <div class="verse">「平安！其實沒有平安。」（以西結書 13:10）</div>
          <div class="devotional-content">
            <div class="devotional-block"><h3 class="devotional-heading">今日重點</h3><p>辨識虛假的平安。</p></div>
            <div class="devotional-block"><h3 class="devotional-heading">真理導航</h3><p>回到神話語的檢驗下。</p></div>
          </div>
          <h3>今日經文</h3>
          <div class="scripture">13:1 耶和華的話臨到我說：<br>13:2 人子啊，你要說預言。</div>
        </section>
        <section class="love-god"><h2>02 今日愛神</h2><p>主啊，求祢使我誠實。</p></section>
        <section class="love-people"><h2>03 今日愛人</h2><p>採取一個具體修補行動。</p></section>
        <section class="command">
          <h2>04 今日工作指令</h2>
          <ul>
            <li><span class="mark">1</span><span>先完成讀經與禱告。</span></li>
          </ul>
        </section>
        <section class="flow">
          <h2>05 7:00 啟動流程</h2>
          <div class="step"><strong>讀經</strong><span class="muted">先讀以西結書。</span></div>
        </section>
        <footer>Source: local_snapshot row 17 · Status: published</footer>
      </main>
    `;

    const result = parseMorningBriefHtml(html, '2026-05-16');

    expect(result.date).toBe('2026-05-16');
    expect(result.dayNumber).toBe(17);
    expect(result.scriptureReference).toBe('以西結書 13:1-23');
    expect(result.themes).toEqual(['愛神', '愛人']);
    expect(result.devotionalTitle).toBe('辨識虛假的平安，重建真實的信仰牆垣');
    expect(result.devotionalText).toBe('回到神話語的檢驗下。');
    expect(result.previewVerses).toEqual([
      { verse: 1, text: '13:1 耶和華的話臨到我說：' },
      { verse: 2, text: '13:2 人子啊，你要說預言。' },
    ]);
    expect(result.prayer).toBe('主啊，求祢使我誠實。');
    expect(result.loveAction).toBe('採取一個具體修補行動。');
    expect(result.workCommands).toEqual(['先完成讀經與禱告。']);
    expect(result.startupSteps).toEqual([{ label: '讀經', text: '先讀以西結書。' }]);
  });
});
