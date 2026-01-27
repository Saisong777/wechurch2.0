import { describe, it, expect } from 'vitest';
import { parseReportContent, cleanMarkdown, GroupReport } from './parse';

describe('cleanMarkdown', () => {
  it('should remove bold markdown syntax', () => {
    expect(cleanMarkdown('**bold text**')).toBe('bold text');
    expect(cleanMarkdown('Some **bold** in middle')).toBe('Some bold in middle');
  });

  it('should convert asterisk lists to bullets', () => {
    expect(cleanMarkdown('* item one\n* item two')).toBe('• item one\n• item two');
  });

  it('should convert dash lists to bullets', () => {
    expect(cleanMarkdown('- item one\n- item two')).toBe('• item one\n• item two');
  });

  it('should handle empty or null input', () => {
    expect(cleanMarkdown('')).toBe('');
    expect(cleanMarkdown(null as unknown as string)).toBe('');
  });

  it('should trim whitespace', () => {
    expect(cleanMarkdown('  text with spaces  ')).toBe('text with spaces');
  });
});

describe('parseReportContent', () => {
  describe('single group reports', () => {
    it('should parse a complete structured report', () => {
      const content = `
第 1 組報告

**組員：** 王弟兄、李姊妹、張弟兄

**查經經文：** 約翰福音 3:16

**📖 主題（Themes）：**
神的愛與救恩

**🔍 事實發現（Observations）：**
• 神愛世人
• 叫一切信他的人得永生

**💡 獨特亮光（Unique Insights）：**
王弟兄提到：神的愛是主動的

**🎯 如何應用（Applications）：**
分享福音給身邊的人
      `;

      const result = parseReportContent(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].groupNumber).toBe(1);
      expect(result[0].members).toBe('王弟兄、李姊妹、張弟兄');
      expect(result[0].verse).toBe('約翰福音 3:16');
      expect(result[0].themes).toContain('神的愛與救恩');
      expect(result[0].observations).toContain('神愛世人');
      expect(result[0].insights).toContain('王弟兄提到');
      expect(result[0].applications).toContain('分享福音');
    });

    it('should handle reports without emoji prefixes', () => {
      const content = `
第 2 組報告

組員： 陳弟兄、林姊妹

主題（Themes）：
信心的重要性

事實發現（Observations）：
信心是得救的關鍵
      `;

      const result = parseReportContent(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].groupNumber).toBe(2);
      expect(result[0].members).toBe('陳弟兄、林姊妹');
    });

    it('should handle reports with bold section headers', () => {
      const content = `
第 3 組報告

**組員：** 王弟兄、李姊妹

**📖 主題（Themes）：**
恩典與真理是我們今天學習的重點

**🔍 事實發現（Observations）：**
耶穌是道路、真理、生命
      `;

      const result = parseReportContent(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].themes).toContain('恩典與真理');
      expect(result[0].observations).toContain('耶穌是道路');
    });
  });

  describe('multiple group reports', () => {
    it('should parse multiple groups separated by equals signs', () => {
      const content = `
第 1 組報告

**組員：** 王弟兄

**📖 主題（Themes）：**
主題一

========================================

第 2 組報告

**組員：** 李姊妹

**📖 主題（Themes）：**
主題二

========================================

第 3 組報告

**組員：** 張弟兄

**📖 主題（Themes）：**
主題三
      `;

      const result = parseReportContent(content);
      
      expect(result).toHaveLength(3);
      expect(result[0].groupNumber).toBe(1);
      expect(result[0].members).toBe('王弟兄');
      expect(result[1].groupNumber).toBe(2);
      expect(result[1].members).toBe('李姊妹');
      expect(result[2].groupNumber).toBe(3);
      expect(result[2].members).toBe('張弟兄');
    });

    it('should deduplicate groups and keep the richer content', () => {
      const content = `
第 1 組報告

========================================

第 1 組報告

**組員：** 王弟兄、李姊妹

**📖 主題（Themes）：**
神的愛

**🔍 事實發現（Observations）：**
神愛世人

**💡 獨特亮光（Unique Insights）：**
獨特的亮光

**🎯 如何應用（Applications）：**
實際應用
      `;

      const result = parseReportContent(content);
      
      // Should deduplicate and keep the richer version
      expect(result).toHaveLength(1);
      expect(result[0].groupNumber).toBe(1);
      expect(result[0].members).toBe('王弟兄、李姊妹');
      expect(result[0].themes).toContain('神的愛');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = parseReportContent('');
      
      expect(result).toHaveLength(1);
      expect(result[0].groupNumber).toBe(0);
      expect(result[0].raw).toBe('');
    });

    it('should handle content without group numbers', () => {
      const content = `
這是一份沒有分組的報告

**📖 主題（Themes）：**
一些主題內容
      `;

      const result = parseReportContent(content);
      
      // Should still capture the content as ungrouped
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle Chinese colon variants', () => {
      const content = `
第 4 組報告

組員： 使用全形冒號
查經經文：約翰福音 1:1

📖 主題：
主題內容
      `;

      const result = parseReportContent(content);
      
      expect(result[0].groupNumber).toBe(4);
      expect(result[0].members).toBe('使用全形冒號');
    });

    it('should handle reports with info section at end', () => {
      const content = `
第 5 組報告

**📖 主題（Themes）：**
神的信實

**🔍 事實發現（Observations）：**
觀察內容

---
ℹ️ 此報告由 AI 生成
      `;

      const result = parseReportContent(content);
      
      expect(result[0].themes).toContain('神的信實');
      expect(result[0].observations).toContain('觀察內容');
      // Info section should be excluded from observations
      expect(result[0].observations).not.toContain('AI 生成');
    });

    it('should preserve raw content as fallback', () => {
      const content = `
第 6 組報告

**組員：** 王弟兄、李姊妹、張弟兄

這是一份沒有標準格式的報告內容，但是有足夠的長度讓解析器認為它是有意義的內容
只有純文字沒有特別的結構化欄位
      `;

      const result = parseReportContent(content);
      
      expect(result[0].groupNumber).toBe(6);
      expect(result[0].raw).toContain('沒有標準格式');
    });

    it('should handle group numbers with various spacing', () => {
      // Each variant needs enough content to pass the score threshold
      const contentVariants = [
        '第1組報告\n\n**組員：** 王弟兄、李姊妹\n\n**📖 主題：**\n主題內容',
        '第 1 組報告\n\n**組員：** 王弟兄、李姊妹\n\n**📖 主題：**\n主題內容',
        '第  1  組報告\n\n**組員：** 王弟兄、李姊妹\n\n**📖 主題：**\n主題內容',
        '第1組\n\n**組員：** 王弟兄、李姊妹\n\n**📖 主題：**\n主題內容',
      ];

      contentVariants.forEach(content => {
        const result = parseReportContent(content);
        expect(result[0].groupNumber).toBe(1);
      });
    });

    it('should handle Chinese numeral group numbers', () => {
      const content = `
**組別：** 第一組
**組員：** 松小貓、陳俊傑
**已分析筆記數：** 2/2
**查經經文：** 太 3:1-4

---

**📖 主題：**
• 松小貓：test
• 陳俊傑：信心的飛躍

**🔍 事實發現：**
• 陳俊傑：發現神的信實貫穿整個故事
      `;

      const result = parseReportContent(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].groupNumber).toBe(1);
      expect(result[0].groupInfo).toBe('第 1 組');
      expect(result[0].members).toBe('松小貓、陳俊傑');
    });
  });

  describe('markdown cleaning in parsed fields', () => {
    it('should clean bold syntax from all fields', () => {
      const content = `
第 1 組報告

**組員：** **王弟兄**、**李姊妹**

**📖 主題（Themes）：**
**神的愛** 與 **恩典**

**🔍 事實發現（Observations）：**
* **重要發現一**
* **重要發現二**
      `;

      const result = parseReportContent(content);
      
      expect(result[0].members).toBe('王弟兄、李姊妹');
      expect(result[0].themes).not.toContain('**');
      expect(result[0].observations).not.toContain('**');
    });

    it('should convert list markers to bullets', () => {
      const content = `
第 1 組報告

**📖 主題（Themes）：**
* 主題一
- 主題二
* 主題三
      `;

      const result = parseReportContent(content);
      
      expect(result[0].themes).toContain('• 主題一');
      expect(result[0].themes).toContain('• 主題二');
      expect(result[0].themes).toContain('• 主題三');
    });
  });
});
