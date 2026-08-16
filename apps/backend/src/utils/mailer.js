const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const possibleLogoPaths = [
  path.resolve(__dirname, "../../../../packages/assets/logo-white.png"),
  path.resolve(process.cwd(), "../../packages/assets/logo-white.png"),
  path.resolve(process.cwd(), "../packages/assets/logo-white.png"),
  path.resolve(process.cwd(), "packages/assets/logo-white.png"),
  path.resolve(__dirname, "../../../../packages/assets/logo.png"),
  path.resolve(process.cwd(), "../../packages/assets/logo.png"),
];

const LOGO_PATH = possibleLogoPaths.find((p) => fs.existsSync(p)) || null;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.SMTP_PORT || "465", 10),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

function getEmailWrapper(contentHtml) {
  const logoSrc = LOGO_PATH ? 'cid:scanmyorderlogo' : 'https://raw.githubusercontent.com/webrizen/assets/main/logo.png';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scan My Order</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #09090b; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden;">
          
          <!-- Top Yellow Accent Bar -->
          <tr>
            <td height="4" style="background-color: #eab308; line-height: 4px; font-size: 1px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #27272a;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="44" valign="middle" style="padding-right: 12px;">
                    <img src="${logoSrc}" alt="Scan My Order" width="38" height="38" style="display: block; width: 38px; height: 38px; border-radius: 8px;" />
                  </td>
                  <td valign="middle">
                    <div style="font-size: 17px; font-weight: 700; color: #ffffff; line-height: 1.2; letter-spacing: -0.3px;">Scan My Order</div>
                    <div style="font-size: 11px; font-weight: 500; color: #a1a1aa; line-height: 1.3; margin-top: 2px;">Multi-Platform Restaurant POS & QR Dining</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #121215; border-top: 1px solid #27272a;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #71717a; font-size: 12px; line-height: 1.6;">
                    <p style="margin: 0 0 6px 0;">This email was sent automatically by the <strong>Scan My Order</strong> platform.</p>
                    <p style="margin: 0;">© ${new Date().getFullYear()} <strong>Webrizen AI Labs Pvt Ltd.</strong> All Rights Reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendPasswordResetEmail(email, resetOtp) {
  const bodyHtml = `
    <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.3px;">Password Reset Verification Code</h2>
    <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      Use the 6-digit verification OTP code below to reset the password for your <strong>Scan My Order</strong> account (<span style="color: #eab308; font-weight: 600;">${email}</span>):
    </p>

    <!-- 6-digit OTP Code Badge -->
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td align="center" style="background-color: #27272a; border: 1px solid #3f3f46; border-radius: 12px; padding: 18px 36px;">
          <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; font-weight: 800; color: #eab308; letter-spacing: 10px; display: inline-block;">
            ${resetOtp}
          </span>
        </td>
      </tr>
    </table>

    <p style="color: #a1a1aa; font-size: 13px; line-height: 1.5; margin: 0 0 20px 0;">
      This OTP code is valid for <strong>15 minutes</strong> across all Scan My Order applications.
    </p>

    <p style="color: #71717a; font-size: 12px; line-height: 1.5; margin: 0; padding-top: 16px; border-top: 1px dashed #27272a;">
      If you did not request a password reset code, please ignore this email — your account remains secure.
    </p>
  `;

  const attachments = LOGO_PATH
    ? [
        {
          filename: "logo-white.png",
          path: LOGO_PATH,
          cid: "scanmyorderlogo",
        },
      ]
    : [];

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Scan My Order" <hello@webrizen.com>',
    to: email,
    subject: `Your Password Reset OTP: ${resetOtp} - Scan My Order`,
    html: getEmailWrapper(bodyHtml),
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    throw err;
  }
}

async function sendWelcomeEmail(email, name) {
  const bodyHtml = `
    <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.3px;">Welcome to Scan My Order, ${name}!</h2>
    <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 14px 0;">
      Thank you for registering with <strong>Scan My Order</strong>.
    </p>
    <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0;">
      Your account is ready to manage your dining, POS, and kitchen operations seamlessly.
    </p>
  `;

  const attachments = LOGO_PATH
    ? [
        {
          filename: "logo-white.png",
          path: LOGO_PATH,
          cid: "scanmyorderlogo",
        },
      ]
    : [];

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Scan My Order" <hello@webrizen.com>',
    to: email,
    subject: "Welcome to Scan My Order",
    html: getEmailWrapper(bodyHtml),
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.error("Failed to send welcome email:", err);
    throw err;
  }
}

async function sendSubscriptionPaymentEmail({ toEmail, ownerName, storeName, planName, amount, interval, checkoutUrl }) {
  const bodyHtml = `
    <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.3px;">Subscription Payment Invoice - PhonePe Checkout</h2>
    <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
      Hello <strong>${ownerName}</strong>,
    </p>
    <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      An administrator has generated a subscription payment invoice for your restaurant establishment <strong>${storeName}</strong>.
    </p>

    <!-- Subscription Invoice Summary Card -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #27272a; border: 1px solid #3f3f46; border-radius: 12px; margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Subscription Plan</td>
              <td align="right" style="color: #ffffff; font-size: 14px; font-weight: 700;">${planName} (${interval})</td>
            </tr>
            <tr>
              <td style="padding-top: 12px; color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Restaurant Store</td>
              <td align="right" style="padding-top: 12px; color: #ffffff; font-size: 14px; font-weight: 600;">${storeName}</td>
            </tr>
            <tr>
              <td style="padding-top: 12px; color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Total Payable Amount</td>
              <td align="right" style="padding-top: 12px; color: #eab308; font-size: 18px; font-weight: 800;">₹${amount}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- PhonePe CTA Button -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px 0;">
      <tr>
        <td align="center">
          <a href="${checkoutUrl}" target="_blank" style="background-color: #eab308; color: #09090b; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block; letter-spacing: -0.2px;">
            Pay with PhonePe Secure Checkout &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="color: #71717a; font-size: 12px; line-height: 1.5; margin: 0; padding-top: 16px; border-top: 1px dashed #27272a;">
      Or copy & paste this link in your browser: <br/>
      <a href="${checkoutUrl}" style="color: #eab308; word-break: break-all;">${checkoutUrl}</a>
    </p>
  `;

  const attachments = LOGO_PATH
    ? [
        {
          filename: "logo-white.png",
          path: LOGO_PATH,
          cid: "scanmyorderlogo",
        },
      ]
    : [];

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Scan My Order" <hello@webrizen.com>',
    to: toEmail,
    subject: `PhonePe Subscription Checkout: ₹${amount} for ${storeName} - Scan My Order`,
    html: getEmailWrapper(bodyHtml),
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.error("Failed to send subscription payment email:", err);
    throw err;
  }
}

module.exports = {
  transporter,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSubscriptionPaymentEmail,
};
