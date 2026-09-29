import { createHash, randomUUID } from 'node:crypto';
import { bulkEmailInput, mailbox } from '@shared/email';
import { assertOutboundEmailAllowed } from './deploymentSafety';
import { emailProviderStatus, senderAddress } from './emailPolicy';

export interface EmailAttachment { filename: string; content: string }
export interface BulkEmailRecipient { email: string; name?: string }
export interface SendEmailOptions {
  purpose?: 'staff' | 'self';
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  idempotencyKey?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(options: SendEmailOptions) {
  // B requires both an explicit deployment opt-in and a trusted caller purpose.
  assertOutboundEmailAllowed(options.purpose);
  if (!emailProviderStatus().configured) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  const to = (Array.isArray(options.to) ? options.to : [options.to]).map(value => mailbox.parse(value));
  if (to.length !== 1) throw new Error('EMAIL_ONE_RECIPIENT_REQUIRED');
  if (!options.subject.trim() || options.subject.length > 200 || /[\r\n]/.test(options.subject)) throw new Error('EMAIL_SUBJECT_INVALID');
  const payload = {
    from: senderAddress(process.env.RESEND_FROM_EMAIL)!, to, subject: options.subject,
    ...(options.html != null ? { html: options.html, text: options.text } : { text: options.text || '' }),
    reply_to: mailbox.parse(options.replyTo || process.env.RESEND_REPLY_TO),
    ...(options.attachments?.length ? { attachments: options.attachments } : {}),
  };
  const key = options.idempotencyKey || randomUUID();
  if (!/^[A-Za-z0-9_:/.-]{1,256}$/.test(key)) throw new Error('EMAIL_REQUEST_ID_INVALID');
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('EMAIL_SEND_UNCONFIRMED'); }
  if (!response.ok) throw new Error(response.status === 429 ? 'EMAIL_RATE_LIMITED' : response.status === 409 ? 'EMAIL_REQUEST_CONFLICT' : 'EMAIL_PROVIDER_REJECTED');
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (typeof result?.id !== 'string' || !result.id) throw new Error('EMAIL_SEND_UNCONFIRMED');
  // Provider acceptance is not proof of delivery. Never log addresses or provider bodies.
  return { data: { id: result.id }, error: null };
}

export async function sendBulkEmail(recipients: BulkEmailRecipient[], subject: string, body: string, isHtml = true, attachments?: EmailAttachment[], requestId: string = randomUUID()) {
  const input = bulkEmailInput.parse({ recipients, subject, body, isHtml, attachments, requestId });
  assertOutboundEmailAllowed('staff');
  if (!emailProviderStatus().configured) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  const unique = [...new Map(input.recipients.map(r => [r.email.toLowerCase(), r])).values()];
  const results = { sent: 0, failed: 0, errors: [] as string[], acceptedOnly: true };
  for (const [index, recipient] of unique.entries()) {
    if (index) await new Promise(resolve => setTimeout(resolve, 600));
    try {
      const id = createHash('sha256').update(recipient.email.toLowerCase()).digest('hex');
      await sendEmail({ purpose: 'staff', to: recipient.email, subject: input.subject, ...(input.isHtml ? { html: input.body } : { text: input.body }),
        attachments: input.attachments, idempotencyKey: `bulk/${requestId}/${id}` });
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push(`第 ${index + 1} 位：${error instanceof Error ? error.message : 'EMAIL_SEND_UNCONFIRMED'}`);
    }
  }
  return results;
}
