import { describe, expect, it, vi } from 'vitest';
import { createSecuritySignals, securitySummaryMessage } from './securitySignals';

describe('bounded security signals', () => {
  it('aggregates bursts once per minute without retaining request contents', () => {
    let now = 0;
    const emit = vi.fn();
    const monitor = createSecuritySignals(emit, () => now);
    for (let i = 0; i < 100000; i++) monitor.observe('GET', `/api/private/${i}?token=secret`, 403);
    expect(emit).not.toHaveBeenCalled();
    now = 60000; monitor.flush(); monitor.flush();
    expect(emit).toHaveBeenCalledTimes(1);
    const summary = emit.mock.calls[0][0];
    expect(summary.counts.forbidden).toBe(100000);
    expect(JSON.stringify(summary)).not.toMatch(/secret|private|token/);
    expect(securitySummaryMessage(summary)).toContain('不代表已被入侵');
    now = 120000; monitor.flush();
    expect(emit).toHaveBeenCalledTimes(1);
  });
  it('does not treat ordinary logged-out status polling as a failed login', () => {
    let now = 0;
    const emit = vi.fn();
    const monitor = createSecuritySignals(emit, () => now);
    for (let i = 0; i < 100; i++) monitor.observe('GET', '/api/auth/user', 401);
    for (let i = 0; i < 29; i++) monitor.observe('POST', '/api/auth/email-login', 401);
    now = 60000; monitor.flush();
    expect(emit).not.toHaveBeenCalled();
    for (let i = 0; i < 30; i++) monitor.observe('POST', '/api/auth/email-login', 401);
    now = 120000; monitor.flush();
    expect(emit.mock.calls[0][0].triggered).toEqual(['loginFailures']);
  });
  it('retains server and limit signals independently and rotates on a new request', () => {
    let now = 0;
    const emit = vi.fn();
    const monitor = createSecuritySignals(emit, () => now);
    for (let i = 0; i < 20; i++) { monitor.observe('GET', '/', 503); monitor.observe('POST', '/api/test', 429); }
    now = 60001; monitor.observe('GET', '/', 200);
    expect(emit.mock.calls[0][0].triggered).toEqual(['rateLimited', 'serverErrors']);
  });
});
