import 'dotenv/config';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';

const db = new Database('cards.db');
const email = 'ezbreaksbaseball@gmail.com'; // Target email for testing

async function sendReset() {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  
  if (!user) {
    console.error(`User with email ${email} not found in database.`);
    return;
  }

  const resetToken = Math.random().toString(36).substring(2, 15);
  const expiry = new Date(Date.now() + 3600000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?').run(resetToken, expiry, user.id);

  console.log(`Token generated for ${email}: ${resetToken}`);

  // Base URL for the reset link
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const resetLink = `${normalizedBaseUrl}/?token=${resetToken}`;

  // Email Transporter Configuration
  let transporter;
  const user_smtp = process.env.SMTP_USER;
  const pass_smtp = process.env.SMTP_PASS;
  const host_smtp = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port_smtp = parseInt(process.env.SMTP_PORT || '587');

  if (user_smtp && pass_smtp) {
    const config: any = {
      host: host_smtp,
      port: port_smtp,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: user_smtp,
        pass: pass_smtp,
      },
    };

    if (host_smtp.includes('gmail.com')) {
      console.log('💡 Using Gmail service configuration');
      delete config.host;
      delete config.port;
      delete config.secure;
      config.service = 'gmail';
    }

    transporter = nodemailer.createTransport(config);
  } else {
    console.error('❌ No SMTP credentials found in environment variables (SMTP_USER, SMTP_PASS).');
    console.log('Please configure your Gmail secrets in the AI Studio Settings.');
    db.close();
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'rawverdictsupport@gmail.com',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5;">Reset Your Password</h2>
          <p>You requested a password reset for your RawVerdict account.</p>
          <p>Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #64748b; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">RawVerdict Card Collection Manager</p>
        </div>
      `
    });
    
    console.log('Email sent: ' + info.response);
    console.log('Direct Reset Link: ' + resetLink);
  } catch (error) {
    console.error('Error sending email:', error);
  } finally {
    db.close();
  }
}

sendReset();
