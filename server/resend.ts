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
  
  // Use the verified from_email from Resend settings
  // If not configured or using unverified domain (like gmail.com), use Resend's test address
  let validFromEmail = fromEmail;
  
  // Check if the fromEmail is from an unverified common email provider
  const unverifiedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'qq.com', '163.com'];
  const emailDomain = fromEmail?.split('@')[1]?.toLowerCase();
  
  if (!fromEmail || unverifiedDomains.includes(emailDomain)) {
    // Use Resend's test address for development/testing
    validFromEmail = 'WeChurch <onboarding@resend.dev>';
    console.log('[Resend] Using Resend test address instead of:', fromEmail);
  }
  
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

export async function sendBulkEmail(
  recipients: BulkEmailRecipient[],
  subject: string,
  body: string,
  isHtml: boolean = true
) {
  const { client, fromEmail } = await getResendClient();
  
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  console.log('[Resend] Bulk sending to', recipients.length, 'recipients from:', fromEmail);
  
  for (const recipient of recipients) {
    try {
      const sendResult = await client.emails.send({
        from: fromEmail,
        to: recipient.email,
        subject: subject,
        ...(isHtml ? { html: body } : { text: body })
      });
      
      console.log('[Resend] Sent to', recipient.email, ':', JSON.stringify(sendResult));
      
      // Check for error in response
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
