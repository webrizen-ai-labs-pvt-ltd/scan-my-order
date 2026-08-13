const nodemailer = require("nodemailer");
const path = require("path");

const LOGO_PATH = path.join(__dirname, "../../../packages/assets/logo.png");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.mailtrap.io",
  port: parseInt(process.env.SMTP_PORT || "2525", 10),
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

function getEmailWrapper(contentHtml) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 12px;">
      <div style="text-align: center; padding-bottom: 24px; border-bottom: 1px solid #27272a;">
        <img src="cid:scanmyorderlogo" alt="Scan My Order Logo" width="140" style="max-width: 140px; height: auto; display: inline-block;" />
      </div>
      <div style="padding: 24px 0;">
        ${contentHtml}
      </div>
      <div style="text-align: center; padding-top: 24px; border-top: 1px solid #27272a; color: #71717a; font-size: 12px; line-height: 1.5;">
        <p style="margin: 0;">Scan My Order — Multi-Platform Restaurant POS & QR Dining Ecosystem</p>
        <p style="margin: 4px 0 0 0;">© ${new Date().getFullYear()} Webrizen AI Labs Pvt Ltd. All rights reserved.</p>
      </div>
    </div>
  `;
}

async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.ORIGIN || "http://localhost:5173"}/reset-password?token=${resetToken}`;

  const bodyHtml = `
    <h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin-top: 0;">Reset Your Password</h2>
    <p style="color: #a1a1aa; line-height: 1.6; font-size: 14px;">You requested a password reset for your <strong>Scan My Order</strong> account.</p>
    <p style="color: #a1a1aa; line-height: 1.6; font-size: 14px;">Click the button below to set up a new password. This link is valid for 1 hour:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" target="_blank" style="padding: 12px 28px; background-color: #ffffff; color: #09090b; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">Reset Password</a>
    </div>
    <p style="color: #71717a; font-size: 13px; line-height: 1.5;">If you did not request this password reset, you can safely ignore this email.</p>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Scan My Order" <noreply@scanmyorder.com>',
    to: email,
    subject: "Password Reset Request - Scan My Order",
    html: getEmailWrapper(bodyHtml),
    attachments: [
      {
        filename: "logo.png",
        path: LOGO_PATH,
        cid: "scanmyorderlogo",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    return false;
  }
}

async function sendWelcomeEmail(email, name) {
  const bodyHtml = `
    <h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin-top: 0;">Welcome to Scan My Order, ${name}!</h2>
    <p style="color: #a1a1aa; line-height: 1.6; font-size: 14px;">Thank you for registering with Scan My Order.</p>
    <p style="color: #a1a1aa; line-height: 1.6; font-size: 14px;">Your account is ready to manage your dining, POS, and kitchen operations seamlessy.</p>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Scan My Order" <noreply@scanmyorder.com>',
    to: email,
    subject: "Welcome to Scan My Order",
    html: getEmailWrapper(bodyHtml),
    attachments: [
      {
        filename: "logo.png",
        path: LOGO_PATH,
        cid: "scanmyorderlogo",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error("Failed to send welcome email:", err);
    return false;
  }
}

module.exports = {
  transporter,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
