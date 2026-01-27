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
  
  if (section.contributions) {
    lines.push(`**👤 個人貢獻摘要（Personal Contributions）：**\n${section.contributions}\n`);
  }
  
  // If no structured content, fall back to raw
  const hasStructured = section.contributions || section.themes || section.observations || section.insights || section.applications;
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
    const hasStructuredContent = section.contributions || section.themes || section.observations || section.insights || section.applications;
    
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
          
          ${section.contributions ? `
            <div class="section contributions">
              <h3>👤 個人貢獻摘要 Personal Contributions</h3>
              <div class="section-content">${section.contributions}</div>
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

// Generate PowerPoint-style HTML for presentation export
export function generatePPTHTML(sections: GroupReport[], verseReference?: string): string {
  const slides: string[] = [];
  
  // Title slide
  slides.push(`
    <div class="slide title-slide">
      <div class="slide-content">
        <h1 class="main-title">🧠 查經分析報告</h1>
        <h2 class="subtitle">${verseReference || '靈魂健身房'}</h2>
        <p class="date">${new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  `);

  // Overview slide if multiple groups
  const groupReports = sections.filter(s => s.groupNumber > 0);
  const overallReport = sections.find(s => s.groupNumber === 0);
  
  if (groupReports.length > 1) {
    slides.push(`
      <div class="slide overview-slide">
        <div class="slide-content">
          <h2 class="slide-title">📊 總覽</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-number">${groupReports.length}</span>
              <span class="stat-label">小組</span>
            </div>
            <div class="stat-card">
              <span class="stat-number">${groupReports.reduce((sum, g) => sum + (g.members?.split(/[,，、]/).filter(Boolean).length || 0), 0)}</span>
              <span class="stat-label">參與人數</span>
            </div>
          </div>
          <div class="group-list">
            ${groupReports.map(g => `<span class="group-badge">第 ${g.groupNumber} 組</span>`).join('')}
          </div>
        </div>
      </div>
    `);
  }

  // Overall summary slide
  if (overallReport) {
    if (overallReport.themes) {
      slides.push(`
        <div class="slide section-slide themes-slide">
          <div class="slide-content">
            <h2 class="slide-title">🎯 整體主題</h2>
            <div class="section-content">${formatForSlide(overallReport.themes)}</div>
          </div>
        </div>
      `);
    }
    if (overallReport.insights) {
      slides.push(`
        <div class="slide section-slide insights-slide">
          <div class="slide-content">
            <h2 class="slide-title">💡 精選亮光</h2>
            <div class="section-content">${formatForSlide(overallReport.insights)}</div>
          </div>
        </div>
      `);
    }
  }

  // Individual group slides
  for (const section of groupReports) {
    // Group title slide
    slides.push(`
      <div class="slide group-title-slide">
        <div class="slide-content">
          <h2 class="slide-title">👥 第 ${section.groupNumber} 組</h2>
          ${section.members ? `<p class="members">${section.members}</p>` : ''}
        </div>
      </div>
    `);

    // Group content slides
    if (section.themes) {
      slides.push(`
        <div class="slide section-slide themes-slide">
          <div class="slide-content">
            <div class="slide-header">
              <span class="group-indicator">第 ${section.groupNumber} 組</span>
              <h2 class="slide-title">📖 主題</h2>
            </div>
            <div class="section-content">${formatForSlide(section.themes)}</div>
          </div>
        </div>
      `);
    }

    if (section.insights) {
      slides.push(`
        <div class="slide section-slide insights-slide">
          <div class="slide-content">
            <div class="slide-header">
              <span class="group-indicator">第 ${section.groupNumber} 組</span>
              <h2 class="slide-title">💡 亮光</h2>
            </div>
            <div class="section-content">${formatForSlide(section.insights)}</div>
          </div>
        </div>
      `);
    }

    if (section.applications) {
      slides.push(`
        <div class="slide section-slide applications-slide">
          <div class="slide-content">
            <div class="slide-header">
              <span class="group-indicator">第 ${section.groupNumber} 組</span>
              <h2 class="slide-title">✍️ 應用</h2>
            </div>
            <div class="section-content">${formatForSlide(section.applications)}</div>
          </div>
        </div>
      `);
    }
  }

  // Thank you slide
  slides.push(`
    <div class="slide title-slide">
      <div class="slide-content">
        <h1 class="main-title">🙏 感謝參與</h1>
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
        width: 90%;
        max-width: 1000px;
        text-align: center;
        z-index: 1;
      }
      
      /* Title Slide */
      .title-slide {
        background: linear-gradient(135deg, #16a085 0%, #1abc9c 50%, #2ecc71 100%);
        color: white;
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
      
      /* Overview Slide */
      .overview-slide {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .slide-title {
        font-size: 2.5rem;
        margin-bottom: 2rem;
      }
      
      .stats-grid {
        display: flex;
        justify-content: center;
        gap: 3rem;
        margin-bottom: 2rem;
      }
      
      .stat-card {
        background: rgba(255,255,255,0.2);
        border-radius: 1rem;
        padding: 2rem 3rem;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .stat-number {
        font-size: 4rem;
        font-weight: 700;
      }
      
      .stat-label {
        font-size: 1.2rem;
        opacity: 0.9;
      }
      
      .group-list {
        display: flex;
        justify-content: center;
        gap: 1rem;
        flex-wrap: wrap;
      }
      
      .group-badge {
        background: rgba(255,255,255,0.2);
        padding: 0.5rem 1.5rem;
        border-radius: 2rem;
        font-size: 1rem;
      }
      
      /* Section Slides */
      .section-slide {
        background: #ffffff;
        color: #1a1a2e;
      }
      
      .section-slide .slide-content {
        text-align: left;
      }
      
      .slide-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      
      .group-indicator {
        background: #16a085;
        color: white;
        padding: 0.3rem 1rem;
        border-radius: 1rem;
        font-size: 0.9rem;
      }
      
      .section-content {
        font-size: 1.5rem;
        line-height: 2;
        white-space: pre-wrap;
        max-height: 60vh;
        overflow: hidden;
      }
      
      .themes-slide .slide-title { color: #16a34a; }
      .themes-slide { border-left: 8px solid #22c55e; }
      
      .insights-slide .slide-title { color: #d97706; }
      .insights-slide { border-left: 8px solid #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #fff 100%); }
      
      .applications-slide .slide-title { color: #2563eb; }
      .applications-slide { border-left: 8px solid #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #fff 100%); }
      
      /* Group Title Slide */
      .group-title-slide {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: white;
      }
      
      .group-title-slide .slide-title {
        font-size: 3rem;
      }
      
      .members {
        margin-top: 1rem;
        font-size: 1.3rem;
        opacity: 0.8;
      }
      
      @media print {
        .slide {
          page-break-after: always;
          page-break-inside: avoid;
        }
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
        <script>
          // Add keyboard navigation
          let currentSlide = 0;
          const slides = document.querySelectorAll('.slide');
          
          function showSlide(n) {
            slides.forEach((s, i) => {
              s.style.display = i === n ? 'flex' : 'none';
            });
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
          
          // Click to advance
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
function formatForSlide(content: string): string {
  if (!content) return '';
  
  // Clean up markdown and limit length
  const cleaned = content
    .replace(/\*\*/g, '')
    .replace(/^[-•]\s*/gm, '• ')
    .trim();
  
  // Limit to reasonable length for a slide
  const lines = cleaned.split('\n').slice(0, 8);
  return lines.join('\n');
}
