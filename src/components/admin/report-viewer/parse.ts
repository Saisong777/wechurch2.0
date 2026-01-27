// Report parsing utilities for AI report viewer

export interface GroupReport {
  groupNumber: number;
  groupInfo?: string;
  members?: string;
  verse?: string;
  themes?: string;
  observations?: string;
  insights?: string;
  applications?: string;
  raw: string;
}

// Clean markdown formatting - remove ** and handle list items
export function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold **text**
    .replace(/^\s*\*\s+/gm, '• ')        // Replace * at line start with bullet
    .replace(/^\s*-\s+/gm, '• ')         // Replace - at line start with bullet
    .trim();
}

// Score a section to determine quality (for deduplication)
function getScore(s: Partial<GroupReport>): number {
  const len = (v?: string) => (v ? v.trim().length : 0);
  // Prefer structured sections heavily; raw-only headers will score low.
  return (
    len(s.themes) +
    len(s.observations) +
    len(s.insights) +
    len(s.applications) +
    Math.min(len(s.raw), 400) +
    (s.members ? 50 : 0) +
    (s.verse ? 20 : 0)
  );
}

// Parse report content into structured sections
export function parseReportContent(content: string): GroupReport[] {
  const sections: GroupReport[] = [];
  const groupIndex = new Map<number, number>();

  // Split by group separators if multiple groups
  const groupReports = content.split(/={40,}/);
  
  for (const groupReport of groupReports) {
    if (!groupReport.trim()) continue;
    
    const section: Partial<GroupReport> = {};
    
    // Extract group number
    const groupMatch = groupReport.match(/第\s*(\d+)\s*組(?:報告)?/);
    if (groupMatch) {
      const groupNum = parseInt(groupMatch[1], 10);
      section.groupNumber = groupNum;
      section.groupInfo = `第 ${groupMatch[1]} 組`;
    }
    
    // Extract members - handle bold syntax in value
    const membersMatch = groupReport.match(/(?:\*\*)?組員(?:\*\*)?[：:]\s*(?:\*\*)?\s*([^\n]+)/);
    if (membersMatch) {
      section.members = cleanMarkdown(membersMatch[1]);
    }
    
    // Extract verse - handle bold syntax in value
    const verseMatch = groupReport.match(/(?:\*\*)?查經經文(?:\*\*)?[：:]\s*(?:\*\*)?\s*([^\n]+)/);
    if (verseMatch) {
      section.verse = cleanMarkdown(verseMatch[1]);
    }
    
    // Extract themes - handle formats like "**📖 主題（Themes）：**" or "📖 主題 Themes："
    const themesMatch = groupReport.match(/(?:\*\*)?📖?\s*主題[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?🔍|(?:\*\*)?💡|(?:\*\*)?🎯|---|ℹ️|$)/i);
    if (themesMatch) {
      section.themes = cleanMarkdown(themesMatch[1]);
    }
    
    // Extract observations - handle formats like "**🔍 事實發現（Observations）：**"
    const obsMatch = groupReport.match(/(?:\*\*)?🔍?\s*事實發現[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?💡|(?:\*\*)?🎯|---|ℹ️|$)/i);
    if (obsMatch) {
      section.observations = cleanMarkdown(obsMatch[1]);
    }
    
    // Extract insights - handle formats like "**💡 獨特亮光（Unique Insights）：**"
    const insightsMatch = groupReport.match(/(?:\*\*)?💡?\s*獨特亮光[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?🎯|---|ℹ️|$)/i);
    if (insightsMatch) {
      section.insights = cleanMarkdown(insightsMatch[1]);
    }
    
    // Extract applications - handle formats like "**🎯 如何應用（Applications）：**"
    const appMatch = groupReport.match(/(?:\*\*)?🎯?\s*如何應用[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=---|ℹ️|$)/i);
    if (appMatch) {
      section.applications = cleanMarkdown(appMatch[1]);
    }
    
    // Store raw content as fallback - also cleaned
    section.raw = cleanMarkdown(groupReport);

    // If this chunk is just the injected header (e.g. "第 4 組報告") it will have a very low score.
    // We still allow it in temporarily, but will replace it with a richer chunk if we later parse one.
    if (section.groupNumber && section.groupNumber > 0) {
      const idx = groupIndex.get(section.groupNumber);
      if (idx === undefined) {
        groupIndex.set(section.groupNumber, sections.length);
        sections.push(section as GroupReport);
      } else {
        const existing = sections[idx];
        if (getScore(section) > getScore(existing)) {
          sections[idx] = section as GroupReport;
        }
      }
    } else if (section.raw && section.raw.length > 50) {
      // For overall reports or ungrouped content - only if substantial
      sections.push({ groupNumber: 0, raw: section.raw, ...section });
    }
  }
  
  return sections.length > 0 ? sections : [{ groupNumber: 0, raw: cleanMarkdown(content) }];
}
