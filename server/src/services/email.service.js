import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter = null;
const testInbox = [];

function getTransporter() {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  }
  return transporter;
}

export function getTestEmailInbox() {
  return testInbox;
}

export function clearTestEmailInbox() {
  testInbox.length = 0;
}

export async function sendMail({ to, subject, text, html, meta = {} }) {
  const mailOptions = {
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  };

  if (!env.isProd) {
    testInbox.push({ ...mailOptions, meta, sentAt: new Date() });
    if (testInbox.length > 100) testInbox.shift();
  }

  try {
    const info = await getTransporter().sendMail(mailOptions);
    if (env.isDev) {
      logger.info({ to, subject, meta }, 'Email dispatched (dev transport)');
    }
    return info;
  } catch (err) {
    logger.warn({ err, to, subject }, 'Failed to dispatch email');
    return null;
  }
}

export async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: 'Verify your FinLedger email address',
    text: `Hi ${name}, verify your email by visiting: ${verifyUrl}`,
    html: `<p>Hi ${name},</p><p>Verify your email by clicking <a href="${verifyUrl}">Verify Email</a>.</p>`,
    meta: { type: 'VERIFY_EMAIL', token, verifyUrl },
  });
}

export async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: 'Reset your FinLedger password',
    text: `Hi ${name}, reset your password using this link: ${resetUrl}`,
    html: `<p>Hi ${name},</p><p>Reset your password <a href="${resetUrl}">here</a>. Expires in 1 hour.</p>`,
    meta: { type: 'PASSWORD_RESET', token, resetUrl },
  });
}

export async function sendWorkspaceInviteEmail({ to, workspaceName, inviterName, role, token }) {
  const inviteUrl = `${env.CLIENT_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: `You are invited to ${workspaceName} on FinLedger`,
    text: `${inviterName} invited you to join ${workspaceName} as ${role}. Accept: ${inviteUrl}`,
    html: `<p>${inviterName} invited you to join <strong>${workspaceName}</strong> as <strong>${role}</strong>.</p><p><a href="${inviteUrl}">Accept Invitation</a></p>`,
    meta: { type: 'WORKSPACE_INVITE', token, inviteUrl },
  });
}
