export interface DevotionalSection {
  title: string;
  body: string;
  panel: 'devotion' | 'prayer';
}

// Only explicit, line-start headings are formatting boundaries. Unknown prose stays intact.
export function devotionalSections(text: string): DevotionalSection[] {
  const heading = /^[ \t]*(每日重點|今日重點|真理導航|生活練習|今日禱告|今日金句卡|今日金句)[ \t]*[：:][ \t]*/gm;
  const matches = [...text.matchAll(heading)];
  if (!matches.length) return text.trim() ? [{ title: '靈修短文', body: text, panel: 'devotion' }] : [];
  const sections: DevotionalSection[] = [];
  const intro = text.slice(0, matches[0].index);
  if (intro.trim()) sections.push({ title: '靈修短文', body: intro, panel: 'devotion' });
  matches.forEach((match, index) => {
    const title = match[1];
    sections.push({
      title,
      body: text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length),
      panel: ['今日禱告', '今日金句卡', '今日金句'].includes(title) ? 'prayer' : 'devotion',
    });
  });
  return sections;
}
