// Export utilities for AI report viewer (Markdown & PDF/Print)

import { GroupReport } from './parse';

// Generate structured Markdown from a parsed section (for downloads)
export function generateSectionMarkdown(section: GroupReport, verseReference?: string): string {
  const lines: string[] = [];
  
  lines.push('### 小組查經整合文件\n');
  
  if (section.groupInfo) {
    lines.push(`**組別：** ${section.groupInfo}\n`);
  }
  
  if (section.members) {
    lines.push(`**組員：** ${section.members}\n`);
  }
  
  if (section.verse || verseReference) {
    lines.push(`**查經經文：** ${section.verse || verseReference}\n`);
  }
  
  lines.push('---\n');
  
  if (section.themes) {
    lines.push(`**📖 主題（Themes）：**\n${section.themes}\n`);
  }
  
  if (section.observations) {
    lines.push(`**🔍 事實發現（Observations）：**\n${section.observations}\n`);
  }
  
  if (section.insights) {
    lines.push(`**💡 獨特亮光（Unique Insights）：**\n${section.insights}\n`);
  }
  
  if (section.applications) {
    lines.push(`**🎯 如何應用（Applications）：**\n${section.applications}\n`);
  }
  
  // If no structured content, fall back to raw
  const hasStructured = section.themes || section.observations || section.insights || section.applications;
  if (!hasStructured && section.raw) {
    lines.push(section.raw);
  }
  
  return lines.join('\n');
}

// Generate print-ready HTML for a single group or all groups
export function generatePrintHTML(sections: GroupReport[], verseReference?: string, singleGroup?: number): string {
  const filteredSections = singleGroup !== undefined 
    ? sections.filter(s => s.groupNumber === singleGroup)
    : sections;

  const styles = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&display=swap');
      
      * { box-sizing: border-box; }
      
      body {
        font-family: 'Noto Serif TC', serif;
        line-height: 1.9;
        color: #1a1a2e;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
        background: #fff;
      }
      
      .print-header {
        text-align: center;
        margin-bottom: 36px;
        padding-bottom: 28px;
        border-bottom: 3px solid #16a085;
      }
      
      .print-header h1 {
        font-size: 26px;
        color: #16a085;
        margin: 0 0 12px 0;
        letter-spacing: 2px;
      }
      
      .print-header p {
        font-size: 15px;
        color: #666;
        margin: 0;
      }
      
      .group-section {
        margin-bottom: 48px;
        page-break-inside: avoid;
      }
      
      .group-header {
        background: linear-gradient(135deg, #16a085 0%, #1abc9c 100%);
        color: white;
        padding: 18px 28px;
        border-radius: 10px 10px 0 0;
        margin-bottom: 0;
      }
      
      .group-header h2 {
        margin: 0;
        font-size: 20px;
        letter-spacing: 1px;
      }
      
      .group-meta {
        background: #f0fdf4;
        padding: 18px 28px;
        border: 1px solid #e0f2f1;
        border-top: none;
        border-radius: 0 0 0 0;
      }
      
      .group-meta p {
        margin: 6px 0;
        font-size: 14px;
        color: #555;
      }
      
      .section {
        margin: 24px 0;
        padding: 22px 28px;
        background: #fafafa;
        border-left: 5px solid #16a085;
        border-radius: 0 10px 10px 0;
      }
      
      .section h3 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 14px 0;
        font-size: 17px;
        color: #16a085;
        font-weight: 600;
      }
      
      .section-content {
        font-size: 15px;
        color: #333;
        white-space: pre-wrap;
        line-height: 1.9;
      }
      
      .section.themes { border-left-color: #22c55e; }
      .section.themes h3 { color: #16a34a; }
      
      .section.observations { border-left-color: #16a085; }
      .section.observations h3 { color: #0d9488; }
      
      .section.insights {
        background: #fffbeb;
        border-left-color: #f59e0b;
      }
      .section.insights h3 { color: #d97706; }
      
      .section.applications {
        background: #eff6ff;
        border-left-color: #3b82f6;
      }
      .section.applications h3 { color: #2563eb; }
      
      .footer {
        margin-top: 48px;
        padding-top: 24px;
        border-top: 2px solid #e0e0e0;
        text-align: center;
        font-size: 13px;
        color: #999;
      }
      
      @media print {
        body { padding: 24px; }
        .group-section { page-break-inside: avoid; }
        .print-header { page-break-after: avoid; }
      }
    </style>
  `;
  
  const groupsHTML = filteredSections.map(section => {
    const hasStructuredContent = section.themes || section.observations || section.insights || section.applications;
    
    return `
      <div class="group-section">
        ${section.groupInfo ? `
          <div class="group-header">
            <h2>📚 ${section.groupInfo}</h2>
          </div>
        ` : ''}
        
        ${(section.members || section.verse) ? `
          <div class="group-meta">
            ${section.members ? `<p><strong>👥 組員：</strong>${section.members}</p>` : ''}
            ${section.verse ? `<p><strong>📖 經文：</strong>${section.verse}</p>` : ''}
          </div>
        ` : ''}
        
        ${hasStructuredContent ? `
          ${section.themes ? `
            <div class="section themes">
              <h3>📖 主題 Themes</h3>
              <div class="section-content">${section.themes}</div>
            </div>
          ` : ''}
          
          ${section.observations ? `
            <div class="section observations">
              <h3>🔍 事實發現 Observations</h3>
              <div class="section-content">${section.observations}</div>
            </div>
          ` : ''}
          
          ${section.insights ? `
            <div class="section insights">
              <h3>💡 獨特亮光 Unique Insights</h3>
              <div class="section-content">${section.insights}</div>
            </div>
          ` : ''}
          
          ${section.applications ? `
            <div class="section applications">
              <h3>🎯 如何應用 Applications</h3>
              <div class="section-content">${section.applications}</div>
            </div>
          ` : ''}
        ` : `
          <div class="section">
            <div class="section-content">${section.raw}</div>
          </div>
        `}
      </div>
    `;
  }).join('');
  
  const title = singleGroup !== undefined 
    ? `第 ${singleGroup} 組查經報告`
    : '共同查經分析報告';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${verseReference || '靈魂健身房'}</title>
        ${styles}
      </head>
      <body>
        <div class="print-header">
          <h1>🧠 ${title}</h1>
          <p>${verseReference || ''} | ${new Date().toLocaleDateString('zh-TW')}</p>
        </div>
        ${groupsHTML}
        <div class="footer">
          <p>此報告由 靈魂健身房 AI 分析助理 生成</p>
          <p>${new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
      </body>
    </html>
  `;
}

// Download a blob as a file
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Open print window with HTML content
export function openPrintWindow(html: string, autoPrint = true): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  
  if (autoPrint) {
    // Wait for fonts to load
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
