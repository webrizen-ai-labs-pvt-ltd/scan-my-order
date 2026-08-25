const nodemailer = require("nodemailer");
const { env } = require("../config/env");

let transporter;

function getMailer() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: {
        user: env.email.user,
        pass: env.email.pass
      }
    });
  }

  return transporter;
}

function sendMail({ from = env.email.from, to, subject, text, html, ...options }) {
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
