import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend {
  if (_resend) return _resend
  _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

interface EmailParams {
  customerName: string
  jobId: string
  summary: string
  urgencyLevel: string
  recipientEmail?: string
}

export async function sendCompletionEmail({
  customerName,
  jobId,
  summary,
  urgencyLevel,
  recipientEmail,
}: EmailParams) {
  const to = recipientEmail || process.env.NOTIFICATION_EMAIL
  if (!to) {
    console.warn('[email] No recipient email configured — skipping notification')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const reportLink = `${appUrl}/jobs/${jobId}`

  const urgencyColor =
    urgencyLevel === 'critical' ? '#dc2626' :
    urgencyLevel === 'high'     ? '#ea580c' :
    urgencyLevel === 'medium'   ? '#ca8a04' :
                                  '#16a34a'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">🏠 Roof Analysis Complete</h1>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:32px 24px;">
        <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hello,</p>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;">
          The roof analysis for <strong>${customerName}</strong> (Job ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;">${jobId}</code>) has been completed.
        </p>

        <!-- Urgency Badge -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="background:${urgencyColor}15;border:1px solid ${urgencyColor}40;border-radius:8px;padding:12px 16px;">
              <p style="margin:0;font-size:13px;color:${urgencyColor};font-weight:600;">
                ⚡ URGENCY LEVEL: ${urgencyLevel.toUpperCase()}
              </p>
            </td>
          </tr>
        </table>

        <!-- Summary -->
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;">Summary</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${summary}</p>
        </div>

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align:center;padding:8px 0;">
              <a href="${reportLink}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
                View Full Report →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Roof Auto — Automated Roofing Analysis</p>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    await getResend().emails.send({
      from: 'Roof Auto <onboarding@resend.dev>',
      to,
      subject: `✅ Roof Analysis Complete — ${customerName} (${urgencyLevel.toUpperCase()})`,
      html,
    })
    console.log(`[email] Notification sent to ${to}`)
  } catch (err) {
    console.error('[email] Failed to send notification:', err)
  }
}
