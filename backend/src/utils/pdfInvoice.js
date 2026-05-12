const fs = require("fs");
const path = require("path");
const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");

pdfMake.vfs = pdfFonts;

const formatCurrency = (value) => Number(value || 0).toFixed(2);
const formatDate = (value) => new Date(value).toLocaleDateString("en-IN");
const compact = (value) => String(value || "").trim();

const loadLogoDataUrl = (logoUrl) => {
  if (!logoUrl) {
    return null;
  }

  const relativePath = logoUrl.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const extension = path.extname(absolutePath).slice(1) || "png";
  const base64 = fs.readFileSync(absolutePath).toString("base64");
  return `data:image/${extension};base64,${base64}`;
};

const detailRow = (label, value, bold = false) => [
  { text: label, style: "labelCell" },
  { text: value, style: bold ? "valueCellBold" : "valueCell" },
];

const buildBusinessLines = (business) =>
  [
    compact(business.address),
    compact(business.email || business.billingEmail),
    compact(business.phone),
    business.gstTaxId ? `GST: ${business.gstTaxId}` : "",
  ].filter(Boolean);

const buildCustomerLines = (invoice) =>
  [
    compact(invoice.customerDetails.address),
    compact(invoice.customerDetails.email),
    compact(invoice.customerDetails.phone),
    invoice.customerDetails.gstNumber ? `GST: ${invoice.customerDetails.gstNumber}` : "",
  ].filter(Boolean);

const buildBankLines = (business) =>
  [
    business.bankDetails?.accountName ? `Account Name: ${business.bankDetails.accountName}` : "",
    business.bankDetails?.bankName ? `Bank: ${business.bankDetails.bankName}` : "",
    business.bankDetails?.accountNumber ? `Account Number: ${business.bankDetails.accountNumber}` : "",
    business.bankDetails?.ifscCode ? `IFSC: ${business.bankDetails.ifscCode}` : "",
    business.bankDetails?.upiId ? `UPI: ${business.bankDetails.upiId}` : "",
  ].filter(Boolean);

const defaultTerms = [
  "Payment is due by the due date mentioned on this invoice.",
  "Please report any billing discrepancy within 7 days of the invoice issue date.",
  "Goods once sold or services once delivered will be treated as accepted unless otherwise agreed.",
  "Delayed payments may affect future deliveries, service continuation, or credit terms.",
];

const numberToWordsBelowThousand = (value) => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (value === 0) {
    return "";
  }

  if (value < 20) {
    return ones[value];
  }

  if (value < 100) {
    return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ""}`;
  }

  return `${ones[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${numberToWordsBelowThousand(value % 100)}` : ""}`;
};

const numberToWordsIndian = (value) => {
  const amount = Math.floor(Number(value || 0));

  if (!amount) {
    return "Zero";
  }

  const parts = [];
  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const remainder = amount % 1000;

  if (crore) {
    parts.push(`${numberToWordsBelowThousand(crore)} Crore`);
  }

  if (lakh) {
    parts.push(`${numberToWordsBelowThousand(lakh)} Lakh`);
  }

  if (thousand) {
    parts.push(`${numberToWordsBelowThousand(thousand)} Thousand`);
  }

  if (remainder) {
    parts.push(numberToWordsBelowThousand(remainder));
  }

  return parts.join(" ").trim();
};

const amountToWordsInr = (value) => {
  const numericValue = Number(value || 0);
  const rupees = Math.floor(numericValue);
  const paise = Math.round((numericValue - rupees) * 100);

  return `${numberToWordsIndian(rupees)} Rupees${paise ? ` and ${numberToWordsIndian(paise)} Paise` : ""} Only`;
};

const buildInvoicePdfDefinition = ({ invoice, business }) => {
  const logoDataUrl = loadLogoDataUrl(business.logoUrl);
  const businessLines = buildBusinessLines(business);
  const customerLines = buildCustomerLines(invoice);
  const bankLines = buildBankLines(business);
  const paymentStatus = String(invoice.paymentStatus || "unpaid").toUpperCase();
  const balanceDueInWords = amountToWordsInr(invoice.balanceDue);

  return {
    pageSize: "A4",
    pageMargins: [28, 28, 28, 34],
    content: [
      {
        margin: [0, 0, 0, 18],
        columns: [
          {
            width: "*",
            columns: [
              logoDataUrl
                ? {
                    image: logoDataUrl,
                    width: 70,
                    fit: [70, 70],
                    margin: [0, 0, 14, 0],
                  }
                : {
                    width: 0,
                    text: "",
                  },
              {
                width: "*",
                stack: [
                  { text: "TAX INVOICE", style: "invoiceTitle" },
                  { text: business.name, style: "businessTitle" },
                  ...businessLines.map((line) => ({ text: line, style: "muted" })),
                ],
              },
            ],
          },
        ],
      },
      {
        margin: [0, 0, 0, 16],
        columns: [
          {
            width: "*",
            margin: [0, 0, 10, 0],
            stack: [
              { text: "Bill To", style: "eyebrowLabel" },
              { text: compact(invoice.customerDetails.name), style: "partyName" },
              ...(customerLines.length
                ? customerLines.map((line) => ({ text: line, style: "muted" }))
                : [{ text: "Customer details not provided", style: "muted" }]),
            ],
          },
          {
            width: 220,
            alignment: "right",
            stack: [
              { text: "Invoice Info", style: "eyebrowLabelRight" },
              { text: `Invoice Number: ${invoice.invoiceNumber}`, style: "mutedRight" },
              { text: `Issue Date: ${formatDate(invoice.invoiceDate)}`, style: "mutedRight" },
              { text: `Due Date: ${formatDate(invoice.dueDate)}`, style: "mutedRight" },
              { text: `Payment Status: ${paymentStatus}`, style: "mutedRight" },
            ],
          },
        ],
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", 34, 52, 52, 58, 48, 58],
          body: [
            [
              { text: "Item", style: "tableHeader" },
              { text: "Qty", style: "tableHeader", alignment: "center" },
              { text: "Rate", style: "tableHeader", alignment: "right" },
              { text: "Disc.", style: "tableHeader", alignment: "right" },
              { text: "Taxable", style: "tableHeader", alignment: "right" },
              { text: "Tax", style: "tableHeader", alignment: "right" },
              { text: "Total", style: "tableHeader", alignment: "right" },
            ],
            ...invoice.lineItems.map((item) => [
              {
                stack: [
                  { text: item.productName, style: "itemName" },
                  {
                    text: `Tax ${formatCurrency(item.taxRate)}% | ${
                      item.discountType === "amount"
                        ? `Discount INR ${formatCurrency(item.discountAmount || item.discount)}`
                        : `Discount ${formatCurrency(item.discountValue)}%`
                    }`,
                    style: "itemMeta",
                  },
                ],
              },
              { text: String(item.quantity), alignment: "center" },
              { text: formatCurrency(item.rate), alignment: "right" },
              { text: formatCurrency(item.discountAmount || item.discount), alignment: "right" },
              { text: formatCurrency(item.taxableAmount || item.lineBase || item.itemTotal), alignment: "right" },
              { text: formatCurrency(item.taxAmount || item.tax), alignment: "right" },
              { text: formatCurrency(item.itemTotal), alignment: "right" },
            ]),
          ],
        },
        layout: {
          hLineColor: (i) => (i === 1 ? "#111827" : "#d7dee7"),
          vLineWidth: () => 0,
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : i === 1 ? 1.4 : 0.8),
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
      },
      {
        margin: [0, 16, 0, 0],
        columns: [
          {
            width: "*",
            stack: [
              { text: "Bank Details", style: "sectionTitle", margin: [0, 0, 0, 6] },
              ...(bankLines.length
                ? bankLines.map((line) => ({ text: line, style: "muted" }))
                : [{ text: "No bank details provided", style: "muted" }]),
            ],
          },
          {
            width: 240,
            stack: [
              { text: "Amount Summary", style: "sectionTitle" },
              {
                margin: [0, 4, 0, 0],
                table: {
                  widths: ["*", "auto"],
                  body: [
                    detailRow("Subtotal", formatCurrency(invoice.subtotal)),
                    detailRow("Tax", formatCurrency(invoice.totalTax)),
                    detailRow("Discount", formatCurrency(invoice.totalDiscount)),
                    detailRow("Shipping", formatCurrency(invoice.shippingCharges)),
                    detailRow("Round Off", formatCurrency(invoice.roundOff)),
                    detailRow("Grand Total", formatCurrency(invoice.grandTotal), true),
                    detailRow("Amount Paid", formatCurrency(invoice.amountPaid)),
                    detailRow("Balance Due", formatCurrency(invoice.balanceDue), true),
                  ],
                },
                layout: {
                  hLineColor: () => "#d7dee7",
                  vLineWidth: () => 0,
                  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 1),
                  paddingLeft: () => 0,
                  paddingRight: () => 0,
                  paddingTop: () => 6,
                  paddingBottom: () => 6,
                },
              },
              {
                text: `Amount in words: ${balanceDueInWords}`,
                style: "amountWords",
                margin: [0, 8, 0, 0],
              },
            ],
          },
        ],
      },
      {
        margin: [0, 16, 0, 0],
        stack: [
          { text: "Terms and Conditions", style: "eyebrowLabel" },
          ...(
            compact(invoice.termsAndConditions) || compact(business.invoiceTerms)
              ? [{ text: compact(invoice.termsAndConditions) || compact(business.invoiceTerms), style: "mutedBlock" }]
              : defaultTerms.map((line) => ({
                  text: `- ${line}`,
                  style: "mutedBlock",
                }))
          ),
        ],
      },
    ],
    styles: {
      invoiceTitle: {
        fontSize: 10,
        bold: true,
        color: "#2563eb",
        margin: [0, 0, 0, 6],
        characterSpacing: 1.4,
      },
      businessTitle: {
        fontSize: 18,
        bold: true,
      },
      eyebrowLabel: {
        fontSize: 9,
        bold: true,
        color: "#2563eb",
        margin: [0, 0, 0, 8],
        characterSpacing: 1,
      },
      eyebrowLabelRight: {
        fontSize: 9,
        bold: true,
        color: "#2563eb",
        margin: [0, 0, 0, 8],
        characterSpacing: 1,
        alignment: "right",
      },
      partyName: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 4],
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 6],
      },
      tableHeader: {
        bold: true,
        color: "#0f172a",
      },
      itemName: {
        bold: true,
      },
      itemMeta: {
        fontSize: 8.5,
        color: "#64748b",
        margin: [0, 3, 0, 0],
      },
      labelCell: {
        color: "#334155",
      },
      valueCell: {
        alignment: "right",
        color: "#0f172a",
      },
      valueCellBold: {
        alignment: "right",
        bold: true,
        color: "#0f172a",
      },
      muted: {
        color: "#475569",
        margin: [0, 0, 0, 2],
      },
      mutedRight: {
        color: "#475569",
        margin: [0, 0, 0, 2],
        alignment: "right",
      },
      mutedBlock: {
        color: "#475569",
        lineHeight: 1.3,
      },
      amountWords: {
        fontSize: 9,
        bold: true,
        color: "#334155",
        lineHeight: 1.3,
      },
    },
    defaultStyle: {
      fontSize: 9.5,
      color: "#0f172a",
    },
  };
};

const generateInvoicePdfBuffer = ({ invoice, business }) =>
  new Promise((resolve, reject) => {
    const definition = buildInvoicePdfDefinition({ invoice, business });
    const pdfDoc = pdfMake.createPdf(definition);

    pdfDoc.getBuffer((buffer) => {
      resolve(Buffer.from(buffer));
    });
    pdfDoc.getBase64((_data) => {});
  }).catch((error) => {
    throw error;
  });

module.exports = {
  generateInvoicePdfBuffer,
};
