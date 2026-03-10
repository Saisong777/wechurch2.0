// Export utilities for AI report viewer (Markdown & PDF/Print/PPTX)

import { GroupReport } from './parse';
import PptxGenJS from 'pptxgenjs';

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
  
  if (section.contributions) {
    lines.push(`**👤 個人貢獻摘要（Personal Contributions）：**\n${section.contributions}\n`);
  }

  // New format fields
  if (section.topic) {
    lines.push(`**📖 本次查經主題：**\n${section.topic}\n`);
  }
  if (section.theology) {
    lines.push(`**💡 神學亮光：**\n${section.theology}\n`);
  }
  if (section.highlights) {
    lines.push(`**⭐ 亮光語錄：**\n${section.highlights}\n`);
  }
  if (section.divergence) {
    lines.push(`**🔀 觀點分歧：**\n${section.divergence}\n`);
  }
  if (section.soulGym) {
    lines.push(`**🏋️ SoulGym 微操練：**\n${section.soulGym}\n`);
  }
  if (section.summary) {
    lines.push(`**📝 一句話總結：**\n${section.summary}\n`);
  }

  // If no structured content, fall back to raw
  const hasStructured = section.contributions || section.themes || section.observations || section.insights || section.applications
    || section.topic || section.theology || section.highlights || section.divergence || section.soulGym || section.summary;
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
      
      .section.contributions {
        background: #faf5ff;
        border-left-color: #a855f7;
      }
      .section.contributions h3 { color: #9333ea; }

      .section.topic { border-left-color: #22c55e; }
      .section.topic h3 { color: #16a34a; }

      .section.theology {
        background: #fffbeb;
        border-left-color: #eab308;
      }
      .section.theology h3 { color: #ca8a04; }

      .section.highlights {
        background: #fffbeb;
        border-left-color: #f59e0b;
      }
      .section.highlights h3 { color: #d97706; }

      .section.divergence {
        background: #fff7ed;
        border-left-color: #f97316;
      }
      .section.divergence h3 { color: #ea580c; }

      .section.soulGym {
        background: #faf5ff;
        border-left-color: #a855f7;
      }
      .section.soulGym h3 { color: #9333ea; }

      .section.summary {
        background: #eef2ff;
        border-left-color: #6366f1;
      }
      .section.summary h3 { color: #4f46e5; }
      
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
    const isNewFmt = !!(section.topic || section.theology || section.highlights || section.divergence || section.soulGym || section.summary);
    const hasStructuredContent = section.contributions || section.themes || section.observations || section.insights || section.applications
      || section.topic || section.theology || section.highlights || section.divergence || section.soulGym || section.summary;

    const renderSection = (cls: string, title: string, content?: string) =>
      content ? `<div class="section ${cls}"><h3>${title}</h3><div class="section-content">${content}</div></div>` : '';

    return `
      <div class="group-section">
        ${section.groupInfo ? `<div class="group-header"><h2>📚 ${section.groupInfo}</h2></div>` : ''}
        ${(section.members || section.verse) ? `
          <div class="group-meta">
            ${section.members ? `<p><strong>👥 組員：</strong>${section.members}</p>` : ''}
            ${section.verse ? `<p><strong>📖 經文：</strong>${section.verse}</p>` : ''}
          </div>
        ` : ''}
        ${hasStructuredContent ? (isNewFmt ? `
          ${renderSection('topic', '📖 本次查經主題', section.topic)}
          ${renderSection('observations', '🔍 共同觀察', section.observations)}
          ${renderSection('theology', '💡 神學亮光', section.theology)}
          ${renderSection('applications', '🎯 共同應用', section.applications)}
          ${renderSection('highlights', '⭐ 亮光語錄', section.highlights)}
          ${renderSection('divergence', '🔀 觀點分歧', section.divergence)}
          ${renderSection('soulGym', '🏋️ SoulGym 微操練', section.soulGym)}
          ${renderSection('summary', '📝 一句話總結', section.summary)}
        ` : `
          ${renderSection('themes', '📖 主題 Themes', section.themes)}
          ${renderSection('observations', '🔍 事實發現 Observations', section.observations)}
          ${renderSection('insights', '💡 獨特亮光 Unique Insights', section.insights)}
          ${renderSection('applications', '🎯 如何應用 Applications', section.applications)}
          ${renderSection('contributions', '👤 個人貢獻摘要', section.contributions)}
        `) : `<div class="section"><div class="section-content">${section.raw}</div></div>`}
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

// Generate PowerPoint-style HTML for presentation export
// One slide per group with all sections combined, matching report format colors
export function generatePPTHTML(sections: GroupReport[], verseReference?: string): string {
  const slides: string[] = [];
  
  const groupReports = sections.filter(s => s.groupNumber > 0).sort((a, b) => a.groupNumber - b.groupNumber);
  const overallReport = sections.find(s => s.groupNumber === 0);
  
  // Title slide
  slides.push(`
    <div class="slide title-slide">
      <div class="slide-content">
        <h1 class="main-title">查經分析報告</h1>
        <h2 class="subtitle">${verseReference || '靈魂健身房'}</h2>
        <p class="date">${new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  `);

  // Helper to generate content boxes for a section
  function generateSlideBoxes(s: GroupReport): string {
    const isNewFmt = !!(s.topic || s.theology || s.highlights || s.divergence || s.soulGym || s.summary);
    const box = (cls: string, emoji: string, label: string, content?: string) =>
      content ? `<div class="content-box ${cls}"><h3 class="box-title">${emoji} ${label}</h3><div class="box-content">${formatForSlide(content, 5)}</div></div>` : '';

    if (isNewFmt) {
      return `
        <div class="content-grid">
          ${box('themes-box', '📖', '主題', s.topic)}
          ${box('observations-box', '🔍', '共同觀察', s.observations)}
          ${box('insights-box', '💡', '神學亮光', s.theology)}
          ${box('applications-box', '🎯', '共同應用', s.applications)}
        </div>
        <div class="content-grid" style="margin-top:0.5rem">
          ${box('insights-box', '⭐', '亮光語錄', s.highlights)}
          ${box('applications-box', '🔀', '觀點分歧', s.divergence)}
          ${box('themes-box', '🏋️', 'SoulGym', s.soulGym)}
          ${box('observations-box', '📝', '總結', s.summary)}
        </div>`;
    }
    return `
      <div class="content-grid">
        ${box('themes-box', '📖', '主題', s.themes)}
        ${box('observations-box', '🔍', '事實發現', s.observations)}
        ${box('insights-box', '💡', '獨特亮光', s.insights)}
        ${box('applications-box', '🎯', '如何應用', s.applications)}
      </div>
      ${s.contributions ? `<div class="contributions-section"><h3 class="contributions-title">👤 個人貢獻摘要</h3><div class="contributions-content">${formatForSlide(s.contributions, 4)}</div></div>` : ''}`;
  }

  // Overall report slide
  if (overallReport) {
    slides.push(`
      <div class="slide content-slide overall-slide">
        <div class="slide-content">
          <div class="slide-header">
            <h2 class="slide-title overall-title">📊 全會眾綜合分析</h2>
          </div>
          ${generateSlideBoxes(overallReport)}
        </div>
      </div>
    `);
  }

  // Individual group slides
  for (const section of groupReports) {
    slides.push(`
      <div class="slide content-slide group-slide">
        <div class="slide-content">
          <div class="slide-header">
            <h2 class="slide-title">第 ${section.groupNumber} 組</h2>
            ${section.members ? `<span class="members-badge">${section.members}</span>` : ''}
          </div>
          ${generateSlideBoxes(section)}
        </div>
      </div>
    `);
  }

  // Thank you slide
  slides.push(`
    <div class="slide title-slide">
      <div class="slide-content">
        <h1 class="main-title">感謝參與</h1>
        <p class="subtitle">願神的話語常存在我們心中</p>
      </div>
    </div>
  `);

  const styles = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');
      
      * { box-sizing: border-box; margin: 0; padding: 0; }
      
      body {
        font-family: 'Noto Sans TC', sans-serif;
        background: #1a1a2e;
        color: #333;
      }
      
      .slide {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        page-break-after: always;
        position: relative;
        overflow: hidden;
      }
      
      .slide-content {
        width: 95%;
        max-width: 1400px;
        z-index: 1;
      }
      
      /* Title Slide */
      .title-slide {
        background: linear-gradient(135deg, #16a085 0%, #1abc9c 50%, #2ecc71 100%);
        color: white;
        text-align: center;
      }
      
      .main-title {
        font-size: 4rem;
        font-weight: 700;
        margin-bottom: 1rem;
        text-shadow: 2px 2px 8px rgba(0,0,0,0.2);
      }
      
      .subtitle {
        font-size: 2rem;
        opacity: 0.9;
      }
      
      .date {
        margin-top: 2rem;
        font-size: 1.2rem;
        opacity: 0.7;
      }
      
      /* Content Slide (Group and Overall) */
      .content-slide {
        background: #f8fafc;
        padding: 2rem;
      }
      
      .slide-header {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
      }
      
      .slide-title {
        font-size: 2rem;
        font-weight: 700;
        color: #16a085;
        margin: 0;
      }
      
      .overall-title {
        color: #7c3aed;
        font-size: 2.2rem;
      }
      
      .members-badge {
        font-size: 0.95rem;
        color: #64748b;
        background: #e2e8f0;
        padding: 0.4rem 1rem;
        border-radius: 1rem;
      }
      
      /* Content Grid - 2x2 layout */
      .content-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      
      .content-box {
        background: white;
        border-radius: 0.75rem;
        padding: 1rem 1.25rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-left: 4px solid;
      }
      
      /* Color scheme matching report format */
      .themes-box {
        border-color: #22c55e;
      }
      .themes-box .box-title {
        color: #16a34a;
      }
      
      .observations-box {
        border-color: #14b8a6;
      }
      .observations-box .box-title {
        color: #0d9488;
      }
      
      .insights-box {
        border-color: #f59e0b;
        background: linear-gradient(135deg, #fffbeb 0%, #fff 100%);
      }
      .insights-box .box-title {
        color: #d97706;
      }
      
      .applications-box {
        border-color: #3b82f6;
        background: linear-gradient(135deg, #eff6ff 0%, #fff 100%);
      }
      .applications-box .box-title {
        color: #2563eb;
      }
      
      .box-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
      }
      
      .box-content {
        font-size: 0.9rem;
        line-height: 1.6;
        color: #374151;
        white-space: pre-wrap;
      }
      
      /* Contributions Section */
      .contributions-section {
        background: linear-gradient(135deg, #faf5ff 0%, #fff 100%);
        border-radius: 0.75rem;
        padding: 1rem 1.25rem;
        border-left: 4px solid #a855f7;
      }
      
      .contributions-title {
        font-size: 1rem;
        font-weight: 600;
        color: #9333ea;
        margin-bottom: 0.5rem;
      }
      
      .contributions-content {
        font-size: 0.85rem;
        line-height: 1.5;
        color: #4b5563;
        white-space: pre-wrap;
      }
      
      /* Overall slide special styling */
      .overall-slide {
        background: linear-gradient(135deg, #f5f3ff 0%, #faf5ff 50%, #f8fafc 100%);
      }
      
      /* Navigation hint */
      .nav-hint {
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        font-size: 0.8rem;
        color: #94a3b8;
        background: rgba(255,255,255,0.9);
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
      }
      
      /* Slide counter */
      .slide-counter {
        position: fixed;
        bottom: 1rem;
        left: 1rem;
        font-size: 0.9rem;
        color: #64748b;
        background: rgba(255,255,255,0.9);
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
      }
      
      @media print {
        .slide {
          page-break-after: always;
          page-break-inside: avoid;
        }
        .nav-hint, .slide-counter { display: none; }
      }
    </style>
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>查經報告簡報 - ${verseReference || '靈魂健身房'}</title>
        ${styles}
      </head>
      <body>
        ${slides.join('\n')}
        <div class="nav-hint">← → 或點擊切換頁面</div>
        <div class="slide-counter"></div>
        <script>
          let currentSlide = 0;
          const slides = document.querySelectorAll('.slide');
          const counter = document.querySelector('.slide-counter');
          
          function showSlide(n) {
            slides.forEach((s, i) => {
              s.style.display = i === n ? 'flex' : 'none';
            });
            counter.textContent = (n + 1) + ' / ' + slides.length;
          }
          
          document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
              currentSlide = Math.min(currentSlide + 1, slides.length - 1);
              showSlide(currentSlide);
            } else if (e.key === 'ArrowLeft') {
              currentSlide = Math.max(currentSlide - 1, 0);
              showSlide(currentSlide);
            }
          });
          
          document.body.addEventListener('click', () => {
            currentSlide = Math.min(currentSlide + 1, slides.length - 1);
            showSlide(currentSlide);
          });
          
          showSlide(0);
        </script>
      </body>
    </html>
  `;
}

// Format content for slide display (trim and limit)
function formatForSlide(content: string, maxLines: number = 8): string {
  if (!content) return '';
  
  // Clean up markdown and limit length
  const cleaned = content
    .replace(/\*\*/g, '')
    .replace(/^[-•]\s*/gm, '• ')
    .trim();
  
  // Limit to reasonable length for a slide
  const lines = cleaned.split('\n').slice(0, maxLines);
  return lines.join('\n');
}

// Generate real PPTX file - one group per slide
export async function generatePPTX(sections: GroupReport[], verseReference?: string): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = `查經報告 - ${verseReference || '靈魂健身房'}`;
  pptx.author = '靈魂健身房';

  const groupReports = sections.filter(s => s.groupNumber > 0).sort((a, b) => a.groupNumber - b.groupNumber);

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.addText('查經分析報告', {
    x: 0.5, y: 2, w: 9, h: 1.2,
    fontSize: 44, bold: true, color: '16A085',
    align: 'center', fontFace: 'Microsoft JhengHei'
  });
  titleSlide.addText(verseReference || '靈魂健身房', {
    x: 0.5, y: 3.2, w: 9, h: 0.6,
    fontSize: 24, color: '666666',
    align: 'center', fontFace: 'Microsoft JhengHei'
  });
  titleSlide.addText(new Date().toLocaleDateString('zh-TW'), {
    x: 0.5, y: 4, w: 9, h: 0.5,
    fontSize: 16, color: '999999',
    align: 'center', fontFace: 'Microsoft JhengHei'
  });

  // One slide per group - all content on one page
  for (const section of groupReports) {
    const slide = pptx.addSlide();
    const isNewFmt = !!(section.topic || section.theology || section.highlights || section.divergence || section.soulGym || section.summary);

    // Group header
    slide.addText(`第 ${section.groupNumber} 組`, {
      x: 0.3, y: 0.2, w: 3, h: 0.5,
      fontSize: 24, bold: true, color: '16A085',
      fontFace: 'Microsoft JhengHei'
    });

    if (section.members) {
      slide.addText(`組員：${section.members}`, {
        x: 0.3, y: 0.7, w: 9.4, h: 0.35,
        fontSize: 11, color: '666666',
        fontFace: 'Microsoft JhengHei'
      });
    }

    const leftX = 0.3;
    const rightX = 5.1;
    const boxW = 4.5;

    // Helper to add content box
    const addBox = (x: number, y: number, h: number, title: string, content: string, color: string) => {
      slide.addText(title, {
        x, y, w: boxW, h: 0.3,
        fontSize: 12, bold: true, color,
        fontFace: 'Microsoft JhengHei'
      });
      slide.addText(cleanContent(content, 100), {
        x, y: y + 0.3, w: boxW, h: h - 0.35,
        fontSize: 9, color: '333333', valign: 'top',
        fontFace: 'Microsoft JhengHei'
      });
    };

    if (isNewFmt) {
      // New format: 4 rows x 2 columns, smaller boxes
      const boxH = 1.05;
      let yPos = 1.15;
      if (section.topic) addBox(leftX, yPos, boxH, '📖 主題', section.topic, '16A34A');
      if (section.observations) addBox(rightX, yPos, boxH, '🔍 共同觀察', section.observations, '0D9488');
      yPos += boxH + 0.1;
      if (section.theology) addBox(leftX, yPos, boxH, '💡 神學亮光', section.theology, 'CA8A04');
      if (section.applications) addBox(rightX, yPos, boxH, '🎯 共同應用', section.applications, '2563EB');
      yPos += boxH + 0.1;
      if (section.highlights) addBox(leftX, yPos, boxH, '⭐ 亮光語錄', section.highlights, 'D97706');
      if (section.divergence) addBox(rightX, yPos, boxH, '🔀 觀點分歧', section.divergence, 'EA580C');
      yPos += boxH + 0.1;
      if (section.soulGym) addBox(leftX, yPos, boxH, '🏋️ SoulGym', section.soulGym, '9333EA');
      if (section.summary) addBox(rightX, yPos, boxH, '📝 總結', section.summary, '4F46E5');
    } else {
      // Old format: 2x2 grid
      const boxH = 1.8;
      let yPos = 1.15;
      if (section.themes) addBox(leftX, yPos, boxH, '📖 主題', section.themes, '16A34A');
      if (section.observations) addBox(rightX, yPos, boxH, '🔍 事實發現', section.observations, '0D9488');
      yPos += boxH + 0.15;
      if (section.insights) addBox(leftX, yPos, boxH, '💡 獨特亮光', section.insights, 'D97706');
      if (section.applications) addBox(rightX, yPos, boxH, '🎯 如何應用', section.applications, '2563EB');
      if (section.contributions) {
        slide.addText('👤 個人貢獻摘要', {
          x: 0.3, y: 4.65, w: 9.4, h: 0.3,
          fontSize: 11, bold: true, color: '9333EA',
          fontFace: 'Microsoft JhengHei'
        });
        slide.addText(cleanContent(section.contributions, 200), {
          x: 0.3, y: 4.95, w: 9.4, h: 0.5,
          fontSize: 9, color: '555555', valign: 'top',
          fontFace: 'Microsoft JhengHei'
        });
      }
    }
  }

  // Thank you slide
  const endSlide = pptx.addSlide();
  endSlide.addText('感謝參與', {
    x: 0.5, y: 2.3, w: 9, h: 1,
    fontSize: 44, bold: true, color: '16A085',
    align: 'center', fontFace: 'Microsoft JhengHei'
  });
  endSlide.addText('願神的話語常存在我們心中', {
    x: 0.5, y: 3.4, w: 9, h: 0.6,
    fontSize: 20, color: '666666',
    align: 'center', fontFace: 'Microsoft JhengHei'
  });

  // Download the file with .pptx extension
  const filename = `查經報告-${verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.pptx`;
  await pptx.writeFile({ fileName: filename });
}

// Clean content for slide (remove markdown, limit length)
function cleanContent(content: string, maxLen: number): string {
  if (!content) return '';
  const cleaned = content
    .replace(/\*\*/g, '')
    .replace(/^[-•]\s*/gm, '• ')
    .trim();
  if (cleaned.length > maxLen) {
    return cleaned.substring(0, maxLen) + '...';
  }
  return cleaned;
}
