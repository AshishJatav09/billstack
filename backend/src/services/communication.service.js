const mongoose = require("mongoose");
const os = require("os");

const Customer = require("../models/Customer");
const Invoice = require("../models/Invoice");
const MessageDelivery = require("../models/MessageDelivery");
const MessageTemplate = require("../models/MessageTemplate");
const ReminderRule = require("../models/ReminderRule");
const ScheduledReminder = require("../models/ScheduledReminder");
const AppError = require("../utils/appError");
const { log } = require("../utils/logger");
const { sendEmail } = require("./email.service");
const { applyFinancialRead } = require("./financial-read.service");
const { getWhatsAppProviderStatus, sendWhatsAppMessage } = require("./whatsapp-provider.service");

const CHANNELS = ["WHATSAPP", "EMAIL", "SMS", "IN_APP"];
const DELIVERY_STATES = ["QUEUED", "SCHEDULED", "PROCESSING", "SENT", "DELIVERED", "READ", "FAILED", "CANCELLED", "SKIPPED"];
const ALLOWED_TEMPLATE_VARS = new Set(["customer_name", "invoice_number", "invoice_amount", "outstanding_amount", "due_date", "business_name", "payment_link"]);

const DEFAULT_TEMPLATES = [
  ["INVOICE_CREATED", "Invoice Created", "Invoice {{invoice_number}} from {{business_name}} is ready. Amount: {{invoice_amount}}."],
  ["INVOICE_DUE_SOON", "Invoice Due Soon", "Hi {{customer_name}}, invoice {{invoice_number}} is due on {{due_date}}. Outstanding: {{outstanding_amount}}."],
  ["DUE_TODAY", "Due Today", "Hi {{customer_name}}, invoice {{invoice_number}} is due today. Outstanding: {{outstanding_amount}}."],
  ["PAYMENT_OVERDUE", "Payment Overdue", "Hi {{customer_name}}, invoice {{invoice_number}} is overdue. Outstanding: {{outstanding_amount}}."],
  ["PAYMENT_RECEIVED", "Payment Received", "Payment received for invoice {{invoice_number}}. Thank you."],
  ["QUOTATION", "Quotation", "Quotation from {{business_name}} is ready for review."],
  ["CREDIT_NOTE", "Credit Note", "Credit note from {{business_name}} has been issued."],
];
const REMINDER_LOCK_TTL_MS = Math.max(Number(process.env.REMINDER_LOCK_TTL_MS || 5 * 60 * 1000), 60000);
const REMINDER_WORKER_ID = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;

const normalizeChannel = (channel) => {
  const value = String(channel || "").toUpperCase();
  if (!CHANNELS.includes(value)) throw new AppError("Invalid communication channel", 400);
  return value;
};

const renderTemplate = (templateBody, variables = {}) =>
  String(templateBody || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    if (!ALLOWED_TEMPLATE_VARS.has(key)) return "";
    return String(variables[key] ?? "");
  });

const ensureDefaultTemplates = async ({ businessId, createdBy, session }) => {
  const rows = [];
  for (const [category, name, body] of DEFAULT_TEMPLATES) {
    for (const channel of ["WHATSAPP", "EMAIL"]) {
      const code = `${category}_${channel}`;
      const update = await MessageTemplate.findOneAndUpdate(
        { businessId, code, channel },
        {
          $setOnInsert: {
            businessId,
            code,
            channel,
            name,
            body,
            subject: name,
            category,
            variables: Array.from(ALLOWED_TEMPLATE_VARS),
            createdBy,
          },
        },
        { upsert: true, new: true, session }
      );
      rows.push(update);
    }
  }
  return rows;
};

const getInvoiceContext = async ({ businessId, invoiceId, session }) => {
  const invoice = await Invoice.findOne({ _id: invoiceId, businessId })
    .populate("customerId", "name email phone")
    .session(session);
  if (!invoice) throw new AppError("Invoice not found", 404);
  const derived = await applyFinancialRead({ businessId, sourceType: "INVOICE", document: invoice });
  const customer = invoice.customerId;
  return { invoice: derived, customer };
};

const buildVariables = ({ businessName = "BillStack", invoice, customer }) => ({
  customer_name: customer?.name || invoice.customerDetails?.name || "Customer",
  invoice_number: invoice.invoiceNumber,
  invoice_amount: Number(invoice.grandTotal || 0).toFixed(2),
  outstanding_amount: Number(invoice.balanceDue || 0).toFixed(2),
  due_date: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "",
  business_name: businessName,
  payment_link: "",
});

const findTemplate = async ({ businessId, channel, category, templateId, session }) => {
  if (templateId) {
    const template = await MessageTemplate.findOne({ _id: templateId, businessId, channel }).session(session);
    if (!template) throw new AppError("Message template not found", 404);
    return template;
  }
  return MessageTemplate.findOne({ businessId, channel, category, isActive: true }).session(session);
};

const createDelivery = async ({ businessId, customerId, invoiceId, channel, template, content, recipient, sourceKey, status = "QUEUED", failureReason = "", reminderJobId = null, createdBy, session }) => {
  const row = await MessageDelivery.findOneAndUpdate(
    { businessId, sourceKey },
    {
      $setOnInsert: {
        businessId,
        customerId,
        invoiceId,
        channel,
        templateId: template?._id || null,
        subject: template?.subject || "",
        content,
        recipient,
        sourceKey,
        reminderJobId,
        status,
        failureReason,
        provider: channel === "WHATSAPP" ? getWhatsAppProviderStatus().provider : channel,
        usageTimestamp: ["SENT", "DELIVERED", "READ"].includes(status) ? new Date() : null,
        createdBy,
      },
    },
    { upsert: true, new: true, session }
  );
  return row;
};

const scheduleWorkflowMessage = async ({ businessId, customerId = null, channel = "EMAIL", scheduledFor, subject, content, recipient = "", sourceKey, metadata = {}, createdBy, session }) => {
  const normalizedChannel = normalizeChannel(channel);
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime())) throw new AppError("Workflow reminder schedule date is invalid", 400);
  if (!sourceKey) throw new AppError("Workflow reminder source key is required", 400);
  return createDelivery({
    businessId,
    customerId,
    invoiceId: null,
    channel: normalizedChannel,
    template: subject ? { subject } : null,
    content,
    recipient,
    sourceKey,
    status: "SCHEDULED",
    createdBy,
    session,
  }).then(async (delivery) => {
    if (!delivery.metadata?.workflowType) {
      delivery.metadata = { ...metadata, scheduledFor: when };
      await delivery.save({ session });
    }
    return delivery;
  });
};

const dispatchDelivery = async ({ delivery, session }) => {
  if (delivery.status === "SENT") return delivery;
  try {
    if (delivery.channel === "WHATSAPP") {
      const providerResult = await sendWhatsAppMessage({ to: delivery.recipient, body: delivery.content, sourceKey: delivery.sourceKey });
      delivery.providerMessageId = providerResult.providerMessageId || delivery.providerMessageId;
      delivery.providerReference = providerResult.providerReference ? JSON.stringify(providerResult.providerReference) : delivery.providerReference;
      if (providerResult.status) delivery.status = providerResult.status;
    } else if (delivery.channel === "EMAIL") {
      await sendEmail({ to: delivery.recipient, subject: delivery.subject || "BillStack reminder", text: delivery.content, html: `<p>${delivery.content}</p>` });
    } else if (delivery.channel === "SMS") {
      throw new AppError("SMS provider is not configured", 503);
    }
    if (["QUEUED", "SCHEDULED", "PROCESSING"].includes(delivery.status)) delivery.status = "SENT";
    delivery.sentAt = new Date();
    delivery.usageTimestamp = delivery.sentAt;
    delivery.failureReason = "";
  } catch (error) {
    delivery.status = "FAILED";
    delivery.failureReason = error.message;
    log("warn", "Communication delivery failed", {
      channel: delivery.channel,
      provider: delivery.provider,
      sourceKey: delivery.sourceKey,
      error: error.message,
    });
  }
  await delivery.save({ session });
  return delivery;
};

const scheduleReminder = async ({ businessId, invoiceId, channel, scheduledFor, templateId, ruleId = null, createdBy, session }) => {
  const normalizedChannel = normalizeChannel(channel);
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime())) throw new AppError("Reminder schedule date is invalid", 400);
  const { invoice, customer } = await getInvoiceContext({ businessId, invoiceId, session });
  if (Number(invoice.balanceDue || 0) <= 0) throw new AppError("Invoice has no outstanding amount", 400);
  const sourceKey = `REMINDER:${invoice._id}:${normalizedChannel}:${when.toISOString()}:${ruleId || "MANUAL"}`;
  const reminder = await ScheduledReminder.findOneAndUpdate(
    { businessId, sourceKey },
    {
      $setOnInsert: {
        businessId,
        invoiceId: invoice._id,
        customerId: customer?._id || invoice.customerId,
        ruleId,
        templateId,
        channel: normalizedChannel,
        scheduledFor: when,
        outstandingAmountSnapshot: invoice.balanceDue,
        sourceKey,
        createdBy,
      },
    },
    { upsert: true, new: true, session }
  );
  return reminder;
};

const sendInvoiceMessage = async ({ businessId, invoiceId, channel, category = "INVOICE_CREATED", templateId, createdBy, session }) => {
  const normalizedChannel = normalizeChannel(channel);
  const { invoice, customer } = await getInvoiceContext({ businessId, invoiceId, session });
  const template = await findTemplate({ businessId, channel: normalizedChannel, category, templateId, session });
  if (!template) throw new AppError("Message template is not configured", 404);
  const content = renderTemplate(template.body, buildVariables({ invoice, customer }));
  const recipient = normalizedChannel === "EMAIL" ? customer?.email || invoice.customerDetails?.email || "" : customer?.phone || invoice.customerDetails?.phone || "";
  const sourceKey = `SEND:${invoice._id}:${normalizedChannel}:${category}`;
  const delivery = await createDelivery({ businessId, customerId: customer?._id || invoice.customerId, invoiceId: invoice._id, channel: normalizedChannel, template, content, recipient, sourceKey, createdBy, session });
  return dispatchDelivery({ delivery, session });
};

const processDueReminder = async ({ reminder, session }) => {
  const { invoice, customer } = await getInvoiceContext({ businessId: reminder.businessId, invoiceId: reminder.invoiceId, session });
  if (Number(invoice.balanceDue || 0) <= 0) {
    reminder.status = "SKIPPED";
    reminder.cancellationReason = "Invoice no longer has outstanding amount";
    reminder.lockedAt = null;
    reminder.lockedBy = "";
    await reminder.save({ session });
    return reminder;
  }
  const template = await findTemplate({ businessId: reminder.businessId, channel: reminder.channel, category: "PAYMENT_OVERDUE", templateId: reminder.templateId, session });
  if (!template) throw new AppError("Message template is not configured", 404);
  reminder.outstandingAmountSnapshot = invoice.balanceDue;
  const content = renderTemplate(template.body, buildVariables({ invoice, customer }));
  const recipient = reminder.channel === "EMAIL" ? customer?.email || invoice.customerDetails?.email || "" : customer?.phone || invoice.customerDetails?.phone || "";
  const delivery = await createDelivery({ businessId: reminder.businessId, customerId: customer?._id || invoice.customerId, invoiceId: invoice._id, channel: reminder.channel, template, content, recipient, sourceKey: `REMINDER_DELIVERY:${reminder._id}`, status: "QUEUED", reminderJobId: reminder._id, createdBy: reminder.createdBy, session });
  const sent = await dispatchDelivery({ delivery, session });
  reminder.status = sent.status === "SENT" ? "SENT" : "FAILED";
  reminder.sentAt = sent.sentAt;
  reminder.failureReason = sent.failureReason;
  reminder.retryCount += sent.status === "FAILED" ? 1 : 0;
  reminder.nextRetryAt = sent.status === "FAILED" ? new Date(Date.now() + Math.min(60, reminder.retryCount + 1) * 60000) : null;
  reminder.lockedAt = null;
  reminder.lockedBy = "";
  await reminder.save({ session });
  return reminder;
};

const processDueReminders = async ({ businessId, limit = 25 }) => {
  const processed = [];
  const safeLimit = Math.min(Number(limit || 25), 100);
  for (let index = 0; index < safeLimit; index += 1) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - REMINDER_LOCK_TTL_MS);
    const row = await ScheduledReminder.findOneAndUpdate(
      {
        businessId,
        $or: [
          { status: "SCHEDULED", scheduledFor: { $lte: now } },
          { status: "FAILED", nextRetryAt: { $lte: now } },
          { status: "PROCESSING", lockedAt: { $lte: staleBefore } },
        ],
      },
      {
        $set: {
          status: "PROCESSING",
          lockedAt: now,
          lockedBy: REMINDER_WORKER_ID,
          lastAttemptAt: now,
        },
      },
      { sort: { scheduledFor: 1 }, new: true }
    );
    if (!row) break;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        processed.push(await processDueReminder({ reminder: row, session }));
      });
    } catch (error) {
      await ScheduledReminder.updateOne(
        { _id: row._id, businessId, lockedBy: REMINDER_WORKER_ID, status: "PROCESSING" },
        {
          $set: {
            status: "FAILED",
            failureReason: error.message,
            nextRetryAt: new Date(Date.now() + 60000),
            lockedAt: null,
            lockedBy: "",
          },
          $inc: { retryCount: 1 },
        }
      );
      log("error", "Reminder processing failed after claim", { reminderId: row._id.toString(), error: error.message });
    } finally {
      session.endSession();
    }
  }
  return processed;
};

const processScheduledWorkflowDeliveries = async ({ businessId, limit = 25 }) => {
  const processed = [];
  const safeLimit = Math.min(Number(limit || 25), 100);
  for (let index = 0; index < safeLimit; index += 1) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - REMINDER_LOCK_TTL_MS);
    const row = await MessageDelivery.findOneAndUpdate(
      {
        businessId,
        invoiceId: null,
        $or: [
          { status: "SCHEDULED", "metadata.scheduledFor": { $lte: now } },
          { status: "FAILED", nextRetryAt: { $lte: now } },
          { status: "PROCESSING", lockedAt: { $lte: staleBefore } },
        ],
      },
      {
        $set: {
          status: "PROCESSING",
          lockedAt: now,
          lockedBy: REMINDER_WORKER_ID,
          lastAttemptAt: now,
        },
      },
      { sort: { "metadata.scheduledFor": 1 }, new: true }
    );
    if (!row) break;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const sent = await dispatchDelivery({ delivery: row, session });
        sent.lockedAt = null;
        sent.lockedBy = "";
        if (sent.status === "FAILED") {
          sent.retryCount += 1;
          sent.nextRetryAt = new Date(Date.now() + Math.min(60, sent.retryCount + 1) * 60000);
        }
        await sent.save({ session });
        processed.push(sent);
      });
    } catch (error) {
      await MessageDelivery.updateOne(
        { _id: row._id, businessId, lockedBy: REMINDER_WORKER_ID, status: "PROCESSING" },
        { $set: { status: "FAILED", failureReason: error.message, nextRetryAt: new Date(Date.now() + 60000), lockedAt: null, lockedBy: "" }, $inc: { retryCount: 1 } }
      );
      log("error", "Workflow delivery processing failed after claim", { deliveryId: row._id.toString(), error: error.message });
    } finally {
      session.endSession();
    }
  }
  return processed;
};

const createReminderRule = async ({ businessId, body, createdBy }) => {
  const channel = normalizeChannel(body.channel || body.channels?.[0] || "EMAIL");
  const sourceKey = body.sourceKey || `RULE:${body.trigger}:${body.offsetDays || 0}:${channel}`;
  const rule = await ReminderRule.findOneAndUpdate(
    { businessId, sourceKey },
    { $setOnInsert: { businessId, name: body.name || "Payment reminder", trigger: body.trigger || "BEFORE_DUE", offsetDays: Number(body.offsetDays || 0), channels: [channel], templateId: body.templateId || null, timezone: body.timezone || "Asia/Kolkata", sendTime: body.sendTime || "10:00", isEnabled: body.isEnabled !== false, sourceKey, createdBy } },
    { upsert: true, new: true }
  );
  if (rule.isEnabled) await materializeReminderRule({ businessId, rule, createdBy });
  return rule;
};

const scheduledDateForRule = ({ dueDate, trigger, offsetDays = 0, sendTime = "10:00" }) => {
  const date = new Date(dueDate);
  const days = trigger === "BEFORE_DUE" ? -Math.abs(Number(offsetDays || 0)) : trigger === "AFTER_DUE" || trigger === "RECURRING_OVERDUE" ? Math.abs(Number(offsetDays || 0)) : 0;
  date.setDate(date.getDate() + days);
  const [hours, minutes] = String(sendTime || "10:00").split(":").map((value) => Number(value || 0));
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

const materializeReminderRule = async ({ businessId, rule, createdBy }) => {
  const invoices = await Invoice.find({ businessId, status: { $ne: "cancelled" } }).populate("customerId", "name email phone");
  const created = [];
  for (const invoice of invoices) {
    const derived = await applyFinancialRead({ businessId, sourceType: "INVOICE", document: invoice });
    if (Number(derived.balanceDue || 0) <= 0) {
      await ScheduledReminder.updateMany({ businessId, invoiceId: invoice._id, ruleId: rule._id, status: "SCHEDULED" }, { $set: { status: "CANCELLED", cancellationReason: "Invoice has no outstanding amount" } });
      continue;
    }
    const scheduledFor = scheduledDateForRule({ dueDate: invoice.dueDate, trigger: rule.trigger, offsetDays: rule.offsetDays, sendTime: rule.sendTime });
    if (scheduledFor.getTime() < Date.now() && !["AFTER_DUE", "RECURRING_OVERDUE"].includes(rule.trigger)) continue;
    for (const channel of rule.channels || []) {
      const sourceKey = `REMINDER:${invoice._id}:${channel}:${scheduledFor.toISOString()}:${rule._id}`;
      const row = await ScheduledReminder.findOneAndUpdate(
        { businessId, sourceKey },
        { $setOnInsert: { businessId, invoiceId: invoice._id, customerId: invoice.customerId?._id || invoice.customerId, ruleId: rule._id, templateId: rule.templateId || null, channel, scheduledFor, timezone: rule.timezone, outstandingAmountSnapshot: derived.balanceDue, sourceKey, createdBy } },
        { upsert: true, new: true }
      );
      created.push(row);
    }
  }
  return created;
};

const updateDeliveryStatus = async ({ businessId, providerMessageId, status, failureReason = "" }) => {
  if (!DELIVERY_STATES.includes(status)) throw new AppError("Invalid delivery status", 400);
  const row = await MessageDelivery.findOne({ businessId, providerMessageId });
  if (!row) throw new AppError("Message delivery not found", 404);
  row.status = status;
  row.failureReason = failureReason;
  if (status === "DELIVERED") row.deliveredAt = new Date();
  if (status === "READ") row.readAt = new Date();
  await row.save();
  return row;
};

const updateProviderDeliveryStatus = async ({ providerMessageId, status, failureReason = "" }) => {
  if (!DELIVERY_STATES.includes(status)) throw new AppError("Invalid delivery status", 400);
  const row = await MessageDelivery.findOne({ providerMessageId });
  if (!row) throw new AppError("Message delivery not found", 404);
  return updateDeliveryStatus({ businessId: row.businessId, providerMessageId, status, failureReason });
};

module.exports = {
  CHANNELS,
  createReminderRule,
  ensureDefaultTemplates,
  getWhatsAppProviderStatus,
  processDueReminders,
  processScheduledWorkflowDeliveries,
  renderTemplate,
  scheduleWorkflowMessage,
  scheduleReminder,
  sendInvoiceMessage,
  updateDeliveryStatus,
  updateProviderDeliveryStatus,
};
