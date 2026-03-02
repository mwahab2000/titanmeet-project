import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import nodemailer from 'npm:nodemailer@6.9.10'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Configuration
const SITE_NAME = "TitanMeet"
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://qclaciklevavttipztrv.supabase.co'
const GMAIL_USER = 'events@titanmeet.com'

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Build the confirmation URL from Supabase hook data
function buildConfirmationUrl(emailData: any): string {
  const { token_hash, redirect_to, email_action_type } = emailData
  const type = email_action_type === 'signup' ? 'signup' : email_action_type
  const base = `${SUPABASE_URL}/auth/v1/verify`
  const params = new URLSearchParams({
    token: token_hash,
    type,
    redirect_to: redirect_to || 'https://titanmeet.com',
  })
  return `${base}?${params.toString()}`
}

// Create Gmail SMTP transporter
function createTransporter() {
  const appPassword = Deno.env.get('GMAIL_APP_PASSWORD')
  if (!appPassword) {
    throw new Error('GMAIL_APP_PASSWORD not configured')
  }
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: appPassword,
    },
  })
}

// Preview endpoint handler
async function handlePreview(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = {
    siteName: SITE_NAME,
    siteUrl: 'https://titanmeet.com',
    recipient: 'user@example.test',
    confirmationUrl: 'https://titanmeet.com',
    token: '123456',
    email: 'user@example.test',
    newEmail: 'new@example.test',
  }

  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))
  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Main webhook handler for Supabase Send Email hook
async function handleWebhook(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!hookSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET not configured')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Read raw payload for signature verification
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  // Verify webhook signature using standardwebhooks
  let data: { user: { email: string }; email_data: any }
  try {
    const wh = new Webhook(hookSecret)
    data = wh.verify(payload, headers) as typeof data
  } catch (error) {
    console.error('Webhook verification failed:', error)
    return new Response(
      JSON.stringify({ error: 'Invalid webhook signature' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { user, email_data } = data
  const emailType = email_data.email_action_type
  console.log('Received auth email hook', { emailType, email: user.email })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Build template props
  const confirmationUrl = buildConfirmationUrl(email_data)
  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: 'https://titanmeet.com',
    recipient: user.email,
    confirmationUrl,
    token: email_data.token,
    email: user.email,
    newEmail: email_data.token_new ? user.email : undefined,
  }

  // Render email HTML and plain text
  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })

  // Send via Gmail SMTP
  try {
    const transporter = createTransporter()
    const result = await transporter.sendMail({
      from: `${SITE_NAME} <${GMAIL_USER}>`,
      to: user.email,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
    })
    console.log('Email sent successfully via Gmail', { messageId: result.messageId, to: user.email })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email'
    console.error('Gmail SMTP error:', message)
    return new Response(
      JSON.stringify({ error: 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
