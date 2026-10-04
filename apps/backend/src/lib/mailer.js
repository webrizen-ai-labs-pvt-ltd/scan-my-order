const nodemailer = require("nodemailer");
const { env } = require("../config/env");

let transporter;

function getMailer() {
  if (!transporter) {
    const port = Number(env.email.port) || 465;
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port,
      secure: port === 465,
      // Force IPv4 to prevent ENETUNREACH errors on platforms without IPv6 outbound routing (Render, Docker, etc.)
      family: 4,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      auth: {
        user: env.email.user,
        pass: env.email.pass
      }
    });
  }

  return transporter;
}

function sendMail({ from = env.email.from, to, subject, text, html, ...options }) {
  if (!env.email.host || !env.email.user) {
    console.warn("[Mailer] Skipping email: SMTP_HOST or SMTP_USER is not configured.");
    return Promise.resolve(null);
  }

  return getMailer().sendMail({
    from,
    to,
    subject,
    text,
    html,
    ...options
  });
}

module.exports = {
  getMailer,
  sendMail
};

