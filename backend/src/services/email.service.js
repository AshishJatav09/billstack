const nodemailer = require("nodemailer");

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
};

const buildFromAddress = () => {
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const fromName = String(process.env.EMAIL_FROM_NAME || "").trim();
  return fromName && fromEmail ? `"${fromName.replace(/"/g, "")}" <${fromEmail}>` : fromEmail;
};

const commonMailFields = () => ({
  from: buildFromAddress(),
  replyTo: process.env.EMAIL_REPLY_TO || undefined,
});

const sendInvoiceEmail = async ({
  to,
  subject,
  html,
  pdfBuffer,
  filename,
}) => {
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("SMTP is not configured");
  }

  return transporter.sendMail({
    ...commonMailFields(),
    to,
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer,
      },
    ],
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("SMTP is not configured");
  }

  return transporter.sendMail({
    ...commonMailFields(),
    to,
    subject,
    html,
    text,
  });
};

module.exports = {
  sendEmail,
  sendInvoiceEmail,
};
