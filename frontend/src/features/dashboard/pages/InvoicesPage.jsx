import { useEffect, useMemo, useState } from "react";
import {
  cancelInvoiceRequest,
  createInvoiceRequest,
  downloadInvoicePdfRequest,
  emailInvoiceRequest,
  listCustomersRequest,
  listInvoicesRequest,
  listProductsRequest,
  updateInvoiceRequest,
} from "../../auth/api";
import { uiStore } from "../../../store/uiStore";

const createLineItem = () => ({
  productId: "",
  quantity: 1,
  rate: 0,
  taxRate: 0,
  discountType: "percent",
  discountValue: 0,
});

const actionIcons = {
  edit: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M13.9 3.6a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L8 14.5l-3.5.6.6-3.5 8.8-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pdf: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M6 2.5h5l3 3V16a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 5 16V4A1.5 1.5 0 0 1 6.5 2.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 2.5V6h3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 10.5h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  print: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M6 7V3.5h8V7M6.5 14.5h7a1 1 0 0 0 1-1v-4a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v4a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12h8v5H6z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4 6 6 5 6-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M10 3a6.5 6.5 0 0 0-5.6 9.8L3.5 17l4.3-.8A6.5 6.5 0 1 0 10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8.3c.2 1.4 1.3 2.8 2.7 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  cancel: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m7.5 7.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const InvoiceActionButton = ({ label, icon, onClick, tone = "default" }) => {
  const toneClass =
    tone === "danger"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition ${toneClass}`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
};

const initialForm = {
  customerId: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  shippingCharges: 0,
  roundOff: 0,
  amountPaid: 0,
  notes: "",
  termsAndConditions: "",
  lineItems: [createLineItem()],
};

const InvoicesPage = () => {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    paymentStatus: "",
    status: "",
    sortBy: "invoiceDate",
    sortOrder: "desc",
  });
  const [result, setResult] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [customerOptionsError, setCustomerOptionsError] = useState("");
  const [productOptionsError, setProductOptionsError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const totals = useMemo(() => {
    const normalizedItems = form.lineItems.map((item) => {
      const quantity = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const lineBase = quantity * rate;
      const taxRate = Number(item.taxRate || 0);
      const discountType = item.discountType === "amount" ? "amount" : "percent";
      const discountValue = Number(item.discountValue || 0);
      const discountAmount =
        discountType === "percent"
          ? Math.min(lineBase, (lineBase * Math.max(discountValue, 0)) / 100)
          : Math.min(lineBase, Math.max(discountValue, 0));
      const taxableAmount = Math.max(lineBase - discountAmount, 0);
      const taxAmount = (taxableAmount * Math.max(taxRate, 0)) / 100;

      return {
        ...item,
        quantity,
        rate,
        taxRate,
        discountType,
        discountValue,
        lineBase,
        discountAmount,
        taxableAmount,
        taxAmount,
        itemTotal: taxableAmount + taxAmount,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineBase, 0);
    const totalTax = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalDiscount = normalizedItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const shippingCharges = Number(form.shippingCharges || 0);
    const roundOff = Number(form.roundOff || 0);
    const grandTotal = subtotal + totalTax - totalDiscount + shippingCharges + roundOff;
    const amountPaid = Number(form.amountPaid || 0);
    const balanceDue = Math.max(grandTotal - amountPaid, 0);

    return {
      normalizedItems,
      subtotal,
      totalTax,
      totalDiscount,
      shippingCharges,
      roundOff,
      grandTotal,
      amountPaid,
      balanceDue,
      paymentStatus:
        amountPaid >= grandTotal ? "paid" : amountPaid > 0 ? "partial" : "unpaid",
    };
  }, [form]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const data = await listInvoicesRequest(filters);
      setResult(data);
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to load invoices");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [filters.page, filters.limit, filters.paymentStatus, filters.status, filters.sortBy, filters.sortOrder]);

  useEffect(() => {
    const loadOptions = async () => {
      setCustomerOptionsError("");
      setProductOptionsError("");

      try {
        const customerData = await listCustomersRequest({
          page: 1,
          limit: 100,
          sortBy: "name",
          sortOrder: "asc",
        });
        setCustomers(customerData.items || []);
      } catch (error) {
        setCustomers([]);
        setCustomerOptionsError(
          error.response?.data?.message || "Unable to load customers for this invoice."
        );
      }

      try {
        const productData = await listProductsRequest({
          page: 1,
          limit: 100,
          sortBy: "name",
          sortOrder: "asc",
          status: "active",
        });
        setProducts(productData.items || []);
      } catch (error) {
        setProducts([]);
        setProductOptionsError(
          error.response?.data?.message || "Unable to load products for this invoice."
        );
      }
    };

    loadOptions();
  }, []);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, page: 1, [name]: value }));
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleLineItemChange = (index, field, value) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextItem = { ...item, [field]: value };

        if (field === "productId") {
          const selectedProduct = products.find((product) => product._id === value);
          if (selectedProduct) {
            nextItem.rate = selectedProduct.sellingPrice ?? 0;
            nextItem.taxRate = selectedProduct.taxRate ?? 0;
            nextItem.discountType = "percent";
            nextItem.discountValue = selectedProduct.discount ?? 0;
          }
        }

        return nextItem;
      }),
    }));
  };

  const addLineItem = () => {
    setForm((current) => ({
      ...current,
      lineItems: [...current.lineItems, createLineItem()],
    }));
  };

  const removeLineItem = (index) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetForm = () => {
    setEditingId("");
    setForm(initialForm);
    setErrors({});
    setServerError("");
  };

  const handleEdit = (invoice) => {
    setEditingId(invoice._id);
    setForm({
      customerId: invoice.customerId?._id || invoice.customerId || "",
      invoiceDate: new Date(invoice.invoiceDate).toISOString().slice(0, 10),
      dueDate: new Date(invoice.dueDate).toISOString().slice(0, 10),
      shippingCharges: invoice.shippingCharges ?? 0,
      roundOff: invoice.roundOff ?? 0,
      amountPaid: invoice.amountPaid ?? 0,
      notes: invoice.notes || "",
      termsAndConditions: invoice.termsAndConditions || "",
      lineItems: invoice.lineItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        rate: item.rate,
        taxRate: item.taxRate ?? 0,
        discountType: item.discountType || "amount",
        discountValue:
          item.discountValue !== undefined ? item.discountValue : item.discount ?? 0,
      })),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    setServerError("");

    try {
      if (editingId) {
        await updateInvoiceRequest(editingId, form);
      } else {
        await createInvoiceRequest(form);
      }

      uiStore.getState().pushToast({
        tone: "success",
        message: editingId ? "Invoice updated successfully." : "Invoice created successfully.",
      });
      resetForm();
      await loadInvoices();
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setServerError(error.response?.data?.message || "Unable to save invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelInvoice = async (invoiceId) => {
    try {
      await cancelInvoiceRequest(invoiceId);
      uiStore.getState().pushToast({
        tone: "success",
        message: "Invoice cancelled successfully.",
      });
      await loadInvoices();
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to cancel invoice");
    }
  };

  const openPdfBlob = (blob, shouldPrint = false, filename = "invoice.pdf") => {
    const url = URL.createObjectURL(blob);

    if (shouldPrint) {
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => printWindow.print();
      }
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDownloadPdf = async (invoice) => {
    try {
      const blob = await downloadInvoicePdfRequest(invoice._id, true);
      openPdfBlob(blob, false, `${invoice.invoiceNumber}.pdf`);
      uiStore.getState().pushToast({
        tone: "success",
        message: "Invoice PDF downloaded.",
      });
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to download invoice PDF");
    }
  };

  const handlePrintInvoice = async (invoice) => {
    try {
      const blob = await downloadInvoicePdfRequest(invoice._id, false);
      openPdfBlob(blob, true, `${invoice.invoiceNumber}.pdf`);
      uiStore.getState().pushToast({
        tone: "info",
        message: "Print view opened in a new tab.",
      });
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to print invoice");
    }
  };

  const handleEmailInvoice = async (invoice) => {
    const defaultEmail = invoice.customerId?.email || invoice.customerDetails?.email || "";
    const toEmail = window.prompt("Send invoice to email:", defaultEmail);

    if (!toEmail) {
      return;
    }

    try {
      await emailInvoiceRequest(invoice._id, toEmail);
      uiStore.getState().pushToast({
        tone: "success",
        message: "Invoice emailed successfully.",
      });
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to email invoice");
    }
  };

  const handleWhatsAppShare = (invoice) => {
    const message = [
      `Invoice ${invoice.invoiceNumber}`,
      `Customer: ${invoice.customerId?.name || invoice.customerDetails?.name || ""}`,
      `Total: ${invoice.grandTotal}`,
      `Due: ${new Date(invoice.dueDate).toLocaleDateString()}`,
      `Status: ${invoice.paymentStatus}`,
      `Please contact us for the PDF copy.`,
    ].join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-300">Invoices</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Invoice generation and stock deduction</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="">All payment status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select name="status" value={filters.status} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="">All invoice status</option>
              <option value="issued">Issued</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select name="sortBy" value={filters.sortBy} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="invoiceDate">Invoice date</option>
              <option value="dueDate">Due date</option>
              <option value="grandTotal">Grand total</option>
            </select>
            <select name="sortOrder" value={filters.sortOrder} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-semibold text-white">{editingId ? "Edit invoice" : "Create invoice"}</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Customer</span>
              <select name="customerId" value={form.customerId} onChange={handleFormChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
                <option value="">Select customer</option>
                {!customers.length ? <option value="" disabled>No customers available</option> : null}
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              {customerOptionsError ? (
                <span className="mt-2 block text-xs text-rose-400">{customerOptionsError}</span>
              ) : !customers.length ? (
                <span className="mt-2 block text-xs text-slate-400">
                  No customers found. Create a customer first from the Customers page.
                </span>
              ) : null}
              {errors.customerId ? <span className="mt-2 block text-xs text-rose-400">{errors.customerId}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Invoice date</span>
              <input type="date" name="invoiceDate" value={form.invoiceDate} onChange={handleFormChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Due date</span>
              <input type="date" name="dueDate" value={form.dueDate} onChange={handleFormChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
            </label>

            <div className="space-y-4 md:col-span-2">
              {form.lineItems.map((item, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm text-slate-300">Product</span>
                      <select value={item.productId} onChange={(event) => handleLineItemChange(index, "productId", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
                        <option value="">Select product</option>
                        {!products.length ? <option value="" disabled>No products available</option> : null}
                        {products.map((product) => (
                          <option key={product._id} value={product._id}>
                            {product.name} ({product.currentStock} in stock)
                          </option>
                        ))}
                      </select>
                      {productOptionsError ? (
                        <span className="mt-2 block text-xs text-rose-400">{productOptionsError}</span>
                      ) : !products.length ? (
                        <span className="mt-2 block text-xs text-slate-400">
                          No active products found. Create a product first from the Products page.
                        </span>
                      ) : null}
                      {errors[`lineItems.${index}.productId`] ? <span className="mt-2 block text-xs text-rose-400">{errors[`lineItems.${index}.productId`]}</span> : null}
                    </label>
                    {[
                      ["quantity", "Quantity"],
                      ["rate", "Rate"],
                      ["taxRate", "Tax rate (%)"],
                    ].map(([field, label]) => (
                      <label key={field} className="block">
                        <span className="mb-2 block text-sm text-slate-300">{label}</span>
                        <input value={item[field]} onChange={(event) => handleLineItemChange(index, field, event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                        {errors[`lineItems.${index}.${field}`] ? <span className="mt-2 block text-xs text-rose-400">{errors[`lineItems.${index}.${field}`]}</span> : null}
                      </label>
                    ))}
                    <label className="block">
                      <span className="mb-2 block text-sm text-slate-300">Discount type</span>
                      <select
                        value={item.discountType}
                        onChange={(event) => handleLineItemChange(index, "discountType", event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                      >
                        <option value="percent">Percent (%)</option>
                        <option value="amount">Amount</option>
                      </select>
                      {errors[`lineItems.${index}.discountType`] ? <span className="mt-2 block text-xs text-rose-400">{errors[`lineItems.${index}.discountType`]}</span> : null}
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm text-slate-300">
                        Discount {item.discountType === "amount" ? "amount" : "(%)"}
                      </span>
                      <input
                        value={item.discountValue}
                        onChange={(event) => handleLineItemChange(index, "discountValue", event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                      />
                      {errors[`lineItems.${index}.discountValue`] ? <span className="mt-2 block text-xs text-rose-400">{errors[`lineItems.${index}.discountValue`]}</span> : null}
                    </label>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-slate-400">
                    <p>Base: {totals.normalizedItems[index]?.lineBase?.toFixed(2) || "0.00"}</p>
                    <p>Discount: {totals.normalizedItems[index]?.discountAmount?.toFixed(2) || "0.00"}</p>
                    <p>Taxable amount: {totals.normalizedItems[index]?.taxableAmount?.toFixed(2) || "0.00"}</p>
                    <p>Tax: {totals.normalizedItems[index]?.taxAmount?.toFixed(2) || "0.00"}</p>
                    <p className="font-medium text-slate-300">Item total: {totals.normalizedItems[index]?.itemTotal?.toFixed(2) || "0.00"}</p>
                  </div>
                  {form.lineItems.length > 1 ? (
                    <button type="button" onClick={() => removeLineItem(index)} className="mt-3 rounded-xl border border-rose-500/40 px-4 py-2 text-sm text-rose-300">
                      Remove line
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="md:col-span-2">
              <button type="button" onClick={addLineItem} className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-200">
                Add line item
              </button>
            </div>

            {[
              ["shippingCharges", "Shipping charges"],
              ["roundOff", "Round off"],
              ["amountPaid", "Amount paid"],
            ].map(([name, label]) => (
              <label key={name} className="block">
                <span className="mb-2 block text-sm text-slate-300">{label}</span>
                <input name={name} value={form[name]} onChange={handleFormChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
              </label>
            ))}

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Notes</span>
              <textarea name="notes" rows="3" value={form.notes} onChange={handleFormChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Terms and conditions</span>
              <textarea name="termsAndConditions" rows="3" value={form.termsAndConditions} onChange={handleFormChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
            <p>Subtotal: {totals.subtotal.toFixed(2)}</p>
            <p>Tax: {totals.totalTax.toFixed(2)}</p>
            <p>Discount: {totals.totalDiscount.toFixed(2)}</p>
            <p>Shipping: {totals.shippingCharges.toFixed(2)}</p>
            <p>Round off: {totals.roundOff.toFixed(2)}</p>
            <p className="mt-2 text-base font-semibold text-white">Grand total: {totals.grandTotal.toFixed(2)}</p>
            <p>Balance due: {totals.balanceDue.toFixed(2)}</p>
            <p>Payment status: {totals.paymentStatus}</p>
          </div>

          {errors.lineItems ? <p className="mt-4 text-sm text-rose-400">{errors.lineItems}</p> : null}
          {serverError ? <p className="mt-4 text-sm text-rose-400">{serverError}</p> : null}

          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white">
              {isSaving ? "Saving..." : editingId ? "Update invoice" : "Create invoice"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-200">
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Invoice history</h3>
            <p className="text-sm text-slate-400">{result.pagination.total} total</p>
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading invoices...</p>
          ) : (
            <div className="space-y-3">
              {result.items.map((invoice) => (
                <div key={invoice._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-md">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-semibold text-white">{invoice.invoiceNumber}</p>
                          <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-brand-200">
                            {invoice.paymentStatus}
                          </span>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                            {invoice.status}
                          </span>
                        </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-300">
                        <p>Customer: {invoice.customerId?.name || invoice.customerDetails?.name}</p>
                        <p>Date: {new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                        <p>Total: {invoice.grandTotal}</p>
                        <p>Balance: {invoice.balanceDue}</p>
                        <p>Due date: {new Date(invoice.dueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    </div>
                    {invoice.status !== "cancelled" ? (
                      <div className="flex flex-wrap gap-2">
                        <InvoiceActionButton label="Edit" icon={actionIcons.edit} onClick={() => handleEdit(invoice)} />
                        <InvoiceActionButton label="PDF" icon={actionIcons.pdf} onClick={() => handleDownloadPdf(invoice)} />
                        <InvoiceActionButton label="Print" icon={actionIcons.print} onClick={() => handlePrintInvoice(invoice)} />
                        <InvoiceActionButton label="Email" icon={actionIcons.email} onClick={() => handleEmailInvoice(invoice)} />
                        <InvoiceActionButton label="WhatsApp" icon={actionIcons.whatsapp} onClick={() => handleWhatsAppShare(invoice)} />
                        <InvoiceActionButton label="Cancel invoice" icon={actionIcons.cancel} onClick={() => handleCancelInvoice(invoice._id)} tone="danger" />
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400">
                        <span className="shrink-0">{actionIcons.cancel}</span>
                        <span>Invoice cancelled</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!result.items.length ? <p className="text-sm text-slate-400">No invoices found.</p> : null}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">Previous</button>
            <p className="text-sm text-slate-400">Page {result.pagination.page} of {result.pagination.totalPages}</p>
            <button type="button" disabled={filters.page >= result.pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvoicesPage;
