const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");

pdfMake.vfs = pdfFonts;

const money = (value) => Number(value || 0).toFixed(2);
const date = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "");
const compact = (value) => String(value || "").trim();

const buildQuotePdfDefinition = ({ quote, business }) => ({
  pageSize: "A4",
  pageMargins: [30, 30, 30, 34],
  content: [
    {
      columns: [
        { width: "*", stack: [{ text: "QUOTATION", style: "title" }, { text: business.name, style: "business" }, compact(business.email || business.billingEmail), compact(business.phone)].filter(Boolean) },
        { width: 180, stack: [{ text: quote.quoteNumber, style: "number" }, { text: `Date: ${date(quote.createdAt)}`, style: "rightMuted" }, quote.validUntil ? { text: `Valid until: ${date(quote.validUntil)}`, style: "rightMuted" } : null].filter(Boolean) },
      ],
      margin: [0, 0, 0, 20],
    },
    { text: "Customer", style: "section" },
    { text: [compact(quote.customerSnapshot?.name), compact(quote.customerSnapshot?.email), compact(quote.customerSnapshot?.phone)].filter(Boolean).join("\n") || "Customer", margin: [0, 0, 0, 16] },
    {
      table: {
        widths: ["*", 45, 65, 55, 75],
        body: [
          [{ text: "Item", style: "tableHeader" }, { text: "Qty", style: "tableHeader", alignment: "right" }, { text: "Rate", style: "tableHeader", alignment: "right" }, { text: "Tax", style: "tableHeader", alignment: "right" }, { text: "Total", style: "tableHeader", alignment: "right" }],
          ...(quote.lineItems || []).map((line) => [line.productName, { text: money(line.quantity), alignment: "right" }, { text: money(line.rate), alignment: "right" }, { text: money(line.tax), alignment: "right" }, { text: money(line.itemTotal), alignment: "right" }]),
        ],
      },
      layout: "lightHorizontalLines",
    },
    {
      margin: [0, 18, 0, 0],
      columns: [
        { width: "*", text: "This quotation is valid as per the commercial discussion and may be converted to an invoice after acceptance.", style: "muted" },
        {
          width: 190,
          table: {
            widths: ["*", 75],
            body: [
              ["Subtotal", { text: money(quote.subtotal), alignment: "right" }],
              ["Discount", { text: money(quote.totalDiscount), alignment: "right" }],
              ["Tax", { text: money(quote.totalTax), alignment: "right" }],
              [{ text: "Grand total", bold: true }, { text: money(quote.grandTotal), bold: true, alignment: "right" }],
            ],
          },
          layout: "noBorders",
        },
      ],
    },
  ],
  styles: {
    title: { fontSize: 22, bold: true, color: "#0f172a" },
    business: { fontSize: 12, bold: true, margin: [0, 4, 0, 4] },
    number: { fontSize: 13, bold: true, alignment: "right" },
    rightMuted: { alignment: "right", color: "#475569", margin: [0, 3, 0, 0] },
    section: { bold: true, color: "#2563eb", margin: [0, 0, 0, 6] },
    tableHeader: { bold: true, color: "#0f172a" },
    muted: { color: "#475569", lineHeight: 1.3 },
  },
  defaultStyle: { fontSize: 9.5, color: "#0f172a" },
});

const generateQuotePdfBuffer = ({ quote, business }) => new Promise((resolve) => {
  pdfMake.createPdf(buildQuotePdfDefinition({ quote, business })).getBuffer((buffer) => resolve(Buffer.from(buffer)));
});

module.exports = { generateQuotePdfBuffer };
