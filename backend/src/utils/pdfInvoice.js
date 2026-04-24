const fs = require("fs");
const path = require("path");
const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");

pdfMake.vfs = pdfFonts;

const formatCurrency = (value) => Number(value || 0).toFixed(2);
const formatDate = (value) => new Date(value).toLocaleDateString("en-IN");

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

const buildTaxBreakdownRows = (lineItems) => {
  const rows = {};

  lineItems.forEach((item) => {
    const key = Number(item.tax || 0).toFixed(2);
    rows[key] = (rows[key] || 0) + Number(item.tax || 0);
  });

  return Object.entries(rows).map(([rateKey, amount]) => [
    `${rateKey}`,
    formatCurrency(amount),
  ]);
};

const buildInvoicePdfDefinition = ({ invoice, business }) => {
  const logoDataUrl = loadLogoDataUrl(business.logoUrl);
  const taxRows = buildTaxBreakdownRows(invoice.lineItems);

  return {
    pageSize: "A4",
    pageMargins: [32, 32, 32, 40],
    content: [
      {
        columns: [
          logoDataUrl
            ? {
                image: logoDataUrl,
                width: 90,
                fit: [90, 90],
              }
            : {
                text: business.name,
                style: "businessTitle",
              },
          {
            width: "*",
            stack: [
              { text: business.name, style: "businessTitle", alignment: "right" },
              { text: business.address || "", alignment: "right", style: "muted" },
              { text: business.email || business.billingEmail || "", alignment: "right", style: "muted" },
              { text: business.phone || "", alignment: "right", style: "muted" },
              { text: business.gstTaxId ? `GST: ${business.gstTaxId}` : "", alignment: "right", style: "muted" },
            ],
          },
        ],
      },
      {
        margin: [0, 20, 0, 10],
        columns: [
          {
            width: "*",
            stack: [
              { text: "Bill To", style: "sectionTitle" },
              { text: invoice.customerDetails.name, bold: true },
              { text: invoice.customerDetails.address || "", style: "muted" },
              { text: invoice.customerDetails.email || "", style: "muted" },
              { text: invoice.customerDetails.phone || "", style: "muted" },
              { text: invoice.customerDetails.gstNumber ? `GST: ${invoice.customerDetails.gstNumber}` : "", style: "muted" },
            ],
          },
          {
            width: 220,
            table: {
              widths: ["*", "*"],
              body: [
                ["Invoice Number", invoice.invoiceNumber],
                ["Invoice Date", formatDate(invoice.invoiceDate)],
                ["Due Date", formatDate(invoice.dueDate)],
                ["Payment Status", invoice.paymentStatus.toUpperCase()],
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", 42, 55, 48, 52, 65],
          body: [
            ["Item", "Qty", "Rate", "Tax", "Discount", "Total"],
            ...invoice.lineItems.map((item) => [
              item.productName,
              String(item.quantity),
              formatCurrency(item.rate),
              formatCurrency(item.tax),
              formatCurrency(item.discount),
              formatCurrency(item.itemTotal),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
      {
        margin: [0, 16, 0, 0],
        columns: [
          {
            width: "*",
            stack: [
              { text: "Tax Breakdown", style: "sectionTitle" },
              taxRows.length
                ? {
                    table: {
                      widths: ["*", "*"],
                      body: [["Tax Amount", "Value"], ...taxRows],
                    },
                    layout: "lightHorizontalLines",
                  }
                : { text: "No tax applied", style: "muted" },
              { text: "Bank Details", style: "sectionTitle", margin: [0, 14, 0, 6] },
              { text: business.bankDetails?.accountName ? `Account Name: ${business.bankDetails.accountName}` : "", style: "muted" },
              { text: business.bankDetails?.bankName ? `Bank: ${business.bankDetails.bankName}` : "", style: "muted" },
              { text: business.bankDetails?.accountNumber ? `Account Number: ${business.bankDetails.accountNumber}` : "", style: "muted" },
              { text: business.bankDetails?.ifscCode ? `IFSC: ${business.bankDetails.ifscCode}` : "", style: "muted" },
              { text: business.bankDetails?.upiId ? `UPI: ${business.bankDetails.upiId}` : "", style: "muted" },
            ],
          },
          {
            width: 220,
            table: {
              widths: ["*", "*"],
              body: [
                ["Subtotal", formatCurrency(invoice.subtotal)],
                ["Tax", formatCurrency(invoice.totalTax)],
                ["Discount", formatCurrency(invoice.totalDiscount)],
                ["Shipping", formatCurrency(invoice.shippingCharges)],
                ["Round Off", formatCurrency(invoice.roundOff)],
                ["Grand Total", formatCurrency(invoice.grandTotal)],
                ["Amount Paid", formatCurrency(invoice.amountPaid)],
                ["Balance Due", formatCurrency(invoice.balanceDue)],
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
      },
      {
        margin: [0, 16, 0, 0],
        stack: [
          { text: "Notes", style: "sectionTitle" },
          { text: invoice.notes || "No notes", style: "muted" },
          { text: "Terms and Conditions", style: "sectionTitle", margin: [0, 14, 0, 6] },
          { text: invoice.termsAndConditions || business.invoiceTerms || "No terms and conditions", style: "muted" },
        ],
      },
    ],
    styles: {
      businessTitle: {
        fontSize: 18,
        bold: true,
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 6],
      },
      muted: {
        color: "#475569",
        margin: [0, 0, 0, 2],
      },
    },
    defaultStyle: {
      fontSize: 10,
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
