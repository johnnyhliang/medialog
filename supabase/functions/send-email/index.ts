const RESEND_URL = 'https://api.resend.com/emails'
const FROM = 'medialog <noreply@YOURDOMAIN.COM>' // replace with your verified Resend domain

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Build the auth verification URL from the hook payload.
// Supabase expects: /auth/v1/verify?token=<token_hash>&type=<type>&redirect_to=<url>
function buildVerifyUrl(siteUrl: string, tokenHash: string, type: string, redirectTo: string): string {
  const base = siteUrl.replace(/\/$/, '')
  return `${base}/auth/v1/verify?token=${tokenHash}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`
}

function templateMagicLink(verifyUrl: string): { subject: string; html: string } {
  return {
    subject: 'sign in to medialog',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:48px auto;padding:0 24px;">
    <tr><td>
      <p style="font-size:22px;font-weight:700;color:#1C1A15;margin:0 0 8px;letter-spacing:-.03em;">medialog.</p>
      <p style="font-size:14px;color:#7A7264;margin:0 0 32px;line-height:1.6;">click the button below to sign in. this link expires in 1 hour.</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:11px 24px;background:#3D5A4A;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">sign in to medialog →</a>
      <p style="font-size:12px;color:#A89E92;margin:24px 0 0;line-height:1.6;">if you didn't request this, you can safely ignore it.</p>
      <p style="font-size:11px;color:#C9C4B8;margin:8px 0 0;">or copy this link: <span style="word-break:break-all;">${verifyUrl}</span></p>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

function templateSignup(verifyUrl: string): { subject: string; html: string } {
  return {
    subject: 'confirm your medialog account',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:48px auto;padding:0 24px;">
    <tr><td>
      <p style="font-size:22px;font-weight:700;color:#1C1A15;margin:0 0 8px;letter-spacing:-.03em;">medialog.</p>
      <p style="font-size:14px;color:#7A7264;margin:0 0 32px;line-height:1.6;">click below to confirm your account and get started.</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:11px 24px;background:#3D5A4A;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">confirm account →</a>
      <p style="font-size:12px;color:#A89E92;margin:24px 0 0;line-height:1.6;">if you didn't create an account, you can safely ignore this.</p>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

function templateRecovery(verifyUrl: string): { subject: string; html: string } {
  return {
    subject: 'reset your medialog password',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:48px auto;padding:0 24px;">
    <tr><td>
      <p style="font-size:22px;font-weight:700;color:#1C1A15;margin:0 0 8px;letter-spacing:-.03em;">medialog.</p>
      <p style="font-size:14px;color:#7A7264;margin:0 0 32px;line-height:1.6;">click below to reset your password. this link expires in 1 hour.</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:11px 24px;background:#3D5A4A;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">reset password →</a>
      <p style="font-size:12px;color:#A89E92;margin:24px 0 0;line-height:1.6;">if you didn't request a password reset, you can safely ignore this.</p>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

function templateEmailChange(verifyUrl: string): { subject: string; html: string } {
  return {
    subject: 'confirm your new medialog email',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:48px auto;padding:0 24px;">
    <tr><td>
      <p style="font-size:22px;font-weight:700;color:#1C1A15;margin:0 0 8px;letter-spacing:-.03em;">medialog.</p>
      <p style="font-size:14px;color:#7A7264;margin:0 0 32px;line-height:1.6;">click below to confirm your new email address.</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:11px 24px;background:#3D5A4A;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">confirm new email →</a>
      <p style="font-size:12px;color:#A89E92;margin:24px 0 0;line-height:1.6;">if you didn't request this change, contact support immediately.</p>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

Deno.serve(async (req: Request) => {
  const hookSecret = Deno.env.get('EMAIL_HOOK_SECRET')
  const resendKey = Deno.env.get('RESEND_API_KEY')

  // Verify hook secret if configured
  if (hookSecret) {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (token !== hookSecret) return json({ error: 'unauthorized' }, 401)
  }

  if (!resendKey) return json({ error: 'RESEND_API_KEY not set' }, 500)

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const user = payload.user as { email?: string } | undefined
  const emailData = payload.email_data as {
    token?: string
    token_hash?: string
    redirect_to?: string
    email_action_type?: string
    site_url?: string
    token_hash_new?: string
  } | undefined

  const toEmail = user?.email
  const tokenHash = emailData?.token_hash ?? emailData?.token ?? ''
  const type = emailData?.email_action_type ?? 'magiclink'
  const redirectTo = emailData?.redirect_to ?? emailData?.site_url ?? ''
  const siteUrl = emailData?.site_url ?? ''

  if (!toEmail) return json({ error: 'missing user email' }, 400)

  // For email_change, use token_hash_new for the new address confirmation
  const hash = type === 'email_change' && emailData?.token_hash_new
    ? emailData.token_hash_new
    : tokenHash

  const verifyUrl = buildVerifyUrl(siteUrl, hash, type, redirectTo)

  let template: { subject: string; html: string }
  if (type === 'signup') template = templateSignup(verifyUrl)
  else if (type === 'recovery') template = templateRecovery(verifyUrl)
  else if (type === 'email_change') template = templateEmailChange(verifyUrl)
  else template = templateMagicLink(verifyUrl) // magiclink + fallback

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [toEmail],
      subject: template.subject,
      html: template.html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Resend error:', res.status, body)
    return json({ error: 'email delivery failed', detail: body }, 502)
  }

  // Supabase Send Email Hook requires an empty JSON object on success
  return json({})
})
