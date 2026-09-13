import { describe, expect, it } from 'vitest';
import { formatScriptureText } from './scriptureDisplay';

describe('Scripture display spacing', () => {
  it('joins spaced Chinese characters and punctuation', () => {
    expect(formatScriptureText('雅 各 啊 ， 創 造 你 的 耶 和 華')).toBe('雅各啊，創造你的耶和華');
  });
  it('preserves verse numbers, paragraphs and English word spacing', () => {
    expect(formatScriptureText('1 雅 各\n2 God is love.\n神 是 愛')).toBe('1 雅各\n2 God is love.\n神是愛');
  });
  it('does not change already typeset text or mixed-language boundaries', () => {
    const text = '神是愛。 John 3:16\n在 Christ 裡';
    expect(formatScriptureText(text)).toBe(text);
  });
});
