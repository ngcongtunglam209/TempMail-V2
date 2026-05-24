// Send a test message to the local LamMail SMTP listener.
// Usage:
//   node scripts/send-test.js <recipient@vietkieu.edu.pl>
// You must create the mailbox via the API first so RCPT TO is accepted.

import nodemailer from 'nodemailer';
import CONFIG from '../src/config.js';

const recipient = process.argv[2];
if (!recipient) {
  console.error('Usage: node scripts/send-test.js <recipient>');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: '127.0.0.1',
  port: CONFIG.smtp.port,
  secure: false,
  ignoreTLS: true,
});

const html = `
  <!doctype html>
  <html><body style="font-family:system-ui;padding:24px">
    <h1>Hello from LamMail send-test</h1>
    <p>Your verification code is <b>481923</b>.</p>
    <p>If you didn't request this, ignore this message.</p>
  </body></html>`;

const text = `Hello from LamMail send-test
Your verification code is 481923.
If you didn't request this, ignore this message.`;

try {
  const info = await transporter.sendMail({
    from: 'LamMail Tester <test@example.com>',
    to: recipient,
    subject: 'LamMail smoke test ' + new Date().toISOString(),
    html,
    text,
  });
  console.log('sent:', info.response, 'messageId:', info.messageId);
} catch (err) {
  console.error('send failed:', err.message);
  process.exit(1);
}
