import { Resend } from 'resend';

// Resend integration using Replit connector
// Reference: connection:conn_resend_01KGF9YPHTDQ9CJCH6XWM8SGHQ

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  const data = await response.json() as { items?: any[] };
  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  
  // Use verified wechurch.online domain for sending emails
  // The domain must be verified at https://resend.com/domains
  const validFromEmail = 'WeChurch <noreply@wechurch.online>';
  
  console.log('[Resend] Using from address:', validFromEmail);
  
  return {
    client: new Resend(apiKey),
    fromEmail: validFromEmail
  };
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const { client, fromEmail } = await getResendClient();
  
  console.log('[Resend] Sending email from:', options.from || fromEmail, 'to:', options.to);
  
  const result = await client.emails.send({
    from: options.from || fromEmail,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  });
  
  console.log('[Resend] Send result:', JSON.stringify(result));
  
  // Check if there's an error in the response
  if ('error' in result && result.error) {
    throw new Error((result.error as any).message || 'Failed to send email');
  }
  
  return result;
}

export interface BulkEmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string;
}

export async function sendBulkEmail(
  recipients: BulkEmailRecipient[],
  subject: string,
  body: string,
  isHtml: boolean = true,
  attachments?: EmailAttachment[]
) {
  const { client, fromEmail } = await getResendClient();
  
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  console.log('[Resend] Bulk sending to', recipients.length, 'recipients from:', fromEmail);
  
  const resendAttachments = attachments?.map(a => ({
    filename: a.filename,
    content: Buffer.from(a.content, 'base64'),
  }));
  
  for (const recipient of recipients) {
    try {
      const sendResult = await client.emails.send({
        from: fromEmail,
        to: recipient.email,
        subject: subject,
        ...(isHtml ? { html: body } : { text: body }),
        ...(resendAttachments && resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
      });
      
      console.log('[Resend] Sent to', recipient.email, ':', JSON.stringify(sendResult));
      
      if ('error' in sendResult && sendResult.error) {
        throw new Error((sendResult.error as any).message || 'Unknown error');
      }
      
      results.sent++;
    } catch (error: any) {
      console.error('[Resend] Failed to send to', recipient.email, ':', error.message);
      results.failed++;
      results.errors.push(`${recipient.email}: ${error.message}`);
    }
  }
  
  return results;
}
