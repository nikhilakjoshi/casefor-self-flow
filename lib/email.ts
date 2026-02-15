import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`

  await resend.emails.send({
    from: 'CaseFor <onboarding@resend.dev>',
    to: email,
    subject: 'Reset your password',
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  })
}

export async function sendShareInvitationEmail({
  to,
  inviterName,
  documentName,
  caseName,
  permission,
  token,
}: {
  to: string
  inviterName: string
  documentName: string
  caseName: string
  permission: string
  token: string
}) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shared/invite/${token}`
  const permLabel = permission === 'VIEW' ? 'view' : permission === 'EDIT' ? 'edit' : 'full access'

  await resend.emails.send({
    from: 'CaseFor <onboarding@resend.dev>',
    to,
    subject: `${inviterName} shared "${documentName}" with you`,
    html: `
      <p><strong>${inviterName}</strong> invited you to ${permLabel} a document.</p>
      <p>Document: <strong>${documentName}</strong></p>
      <p>Case: ${caseName}</p>
      <p><a href="${inviteUrl}">Open document</a></p>
    `,
  })
}
