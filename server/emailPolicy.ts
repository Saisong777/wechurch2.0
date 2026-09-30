import { mailbox, type EmailProviderStatus } from '@shared/email';
import { isTestDeployment } from './deploymentSafety';

export function senderAddress(value: string | undefined) {
  const raw = value?.trim() || '';
  if (/[\r\n]/.test(raw)) return null;
  const match = raw.match(/^([^<>]+)<([^<>]+)>$/);
  return mailbox.safeParse(match ? match[2].trim() : raw).success ? raw : null;
}

export function emailProviderStatus(env: NodeJS.ProcessEnv = process.env): EmailProviderStatus {
  const configured = !!env.RESEND_API_KEY?.trim() && !!senderAddress(env.RESEND_FROM_EMAIL)
    && mailbox.safeParse(env.RESEND_REPLY_TO?.trim()).success;
  const reason = isTestDeployment(env) && env.STAGING_CONTROLLED_EMAIL_ENABLED !== '1' ? 'staging' : env.DISABLE_OUTBOUND_EMAIL === '1' ? 'disabled' : configured ? 'ready' : 'not_configured';
  const messages = {
    ready: '寄信服務已設定，送達結果仍以收件匣為準。',
    staging: 'B 測試站只提供預覽，不會寄出郵件。',
    disabled: '目前暫停寄送郵件，可預覽內容。',
    not_configured: '寄信服務尚未完成設定，目前僅提供預覽。',
  };
  return { configured, canSend: reason === 'ready', remindersEnabled: reason === 'ready' && env.DAILY_EMAIL_SCHEDULER_ENABLED === '1', mode: configured ? 'resend_api_key' : 'preview_only', reason, message: messages[reason] };
}

export function emailAppUrl(route = '/', env: NodeJS.ProcessEnv = process.env) {
  const raw = env.PUBLIC_BASE_URL || env.PUBLIC_APP_URL || env.APP_URL;
  if (!raw && isTestDeployment(env)) throw new Error('EMAIL_APP_URL_NOT_CONFIGURED');
  const origin = new URL(raw || 'https://wechurch.online');
  if (origin.username || origin.password || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Error('EMAIL_APP_URL_INVALID');
  const url = new URL(route, origin.origin);
  if (url.origin !== origin.origin || url.username || url.password) throw new Error('EMAIL_LINK_MUST_BE_SAME_ORIGIN');
  return url.href;
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function dailyEmailDue(preference: { dailyFollowEnabled: boolean; dailyFollowTime: string; timezone: string; lastDailyFollowSentAt: Date | string | null }, now = new Date()) {
  if (!preference.dailyFollowEnabled || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preference.dailyFollowTime)) return false;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: preference.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const parts = (date: Date) => Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
    const current = parts(now);
    if (`${current.hour}:${current.minute}` < preference.dailyFollowTime) return false;
    if (preference.lastDailyFollowSentAt) {
      const lastDate = new Date(preference.lastDailyFollowSentAt);
      if (lastDate >= now) return false;
      const last = parts(lastDate);
      if (`${last.year}-${last.month}-${last.day}` === `${current.year}-${current.month}-${current.day}`) return false;
    }
    return true;
  } catch { return false; }
}
