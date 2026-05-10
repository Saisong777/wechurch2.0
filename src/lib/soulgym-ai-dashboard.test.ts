import { describe, expect, it } from 'vitest';
import { formatReportDataDashboard } from '../../server/prompts/devotional-analysis';

describe('formatReportDataDashboard', () => {
  it('summarizes field completion and insight category distribution', () => {
    const dashboard = formatReportDataDashboard(
      [
        {
          name: 'A',
          groupNumber: 1,
          observation: '看見葡萄樹與枝子的關係',
          coreInsightNote: JSON.stringify({ PROMISE: '住在主裡面會結果子' }),
          actionPlan: '每天禱告十分鐘',
        },
        {
          name: 'B',
          groupNumber: 2,
          observation: '',
          coreInsightNote: JSON.stringify({ COMMAND: '要常在主裡面' }),
        },
      ],
      { reportType: 'overall', model: 'gemini-2.5-flash' }
    );

    expect(dashboard).toContain('筆記數：2');
    expect(dashboard).toContain('有效筆記：2/2（100%）');
    expect(dashboard).toContain('經文觀察：1/2（50%）');
    expect(dashboard).toContain('應許 Promise：1');
    expect(dashboard).toContain('命令 Command：1');
    expect(dashboard).toContain('第 1 組：1');
    expect(dashboard).toContain('第 2 組：1');
  });
});
