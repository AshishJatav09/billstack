import api from "../../api/axios";

export const registerRequest = async (payload) => {
  const response = await api.post("/auth/register", payload);
  return response.data.data;
};

export const loginRequest = async (payload) => {
  const response = await api.post("/auth/login", payload);
  return response.data.data;
};

export const logoutRequest = async () => {
  await api.post("/auth/logout");
};

export const currentSessionRequest = async () => {
  const response = await api.get("/auth/me");
  return response.data.data;
};

export const updateBusinessSetupRequest = async (payload) => {
  const response = await api.put("/business/setup", payload, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data.data;
};

export const listPlansRequest = async () => {
  const response = await api.get("/plans");
  return response.data.data;
};

export const currentPlanRequest = async () => {
  const response = await api.get("/plans/current");
  return response.data.data;
};

export const updateBusinessPlanRequest = async (planCode) => {
  const response = await api.put("/business/plan", { planCode });
  return response.data.data;
};

export const listCustomersRequest = async (params) => {
  const response = await api.get("/customers", { params });
  return response.data.data;
};

export const createCustomerRequest = async (payload) => {
  const response = await api.post("/customers", payload);
  return response.data.data;
};

export const updateCustomerRequest = async (customerId, payload) => {
  const response = await api.put(`/customers/${customerId}`, payload);
  return response.data.data;
};

export const deleteCustomerRequest = async (customerId) => {
  await api.delete(`/customers/${customerId}`);
};

export const listProductsRequest = async (params) => {
  const response = await api.get("/products", { params });
  return response.data.data;
};

export const createProductRequest = async (payload) => {
  const response = await api.post("/products", payload);
  return response.data.data;
};

export const updateProductRequest = async (productId, payload) => {
  const response = await api.put(`/products/${productId}`, payload);
  return response.data.data;
};

export const deleteProductRequest = async (productId) => {
  await api.delete(`/products/${productId}`);
};

export const listProductMovementsRequest = async (productId, params) => {
  const response = await api.get(`/products/${productId}/movements`, { params });
  return response.data.data;
};

export const createProductMovementRequest = async (productId, payload) => {
  const response = await api.post(`/products/${productId}/movements`, payload);
  return response.data.data;
};

export const listSuppliersRequest = async (params) => {
  const response = await api.get("/suppliers", { params });
  return response.data.data;
};

export const createSupplierRequest = async (payload) => {
  const response = await api.post("/suppliers", payload);
  return response.data.data;
};

export const updateSupplierRequest = async (supplierId, payload) => {
  const response = await api.put(`/suppliers/${supplierId}`, payload);
  return response.data.data;
};

export const deleteSupplierRequest = async (supplierId) => {
  await api.delete(`/suppliers/${supplierId}`);
};

export const listPurchasesRequest = async (params) => {
  const response = await api.get("/purchases", { params });
  return response.data.data;
};

export const createPurchaseRequest = async (payload) => {
  const response = await api.post("/purchases", payload);
  return response.data.data;
};

export const listInvoicesRequest = async (params) => {
  const response = await api.get("/invoices", { params });
  return response.data.data;
};

export const createInvoiceRequest = async (payload) => {
  const response = await api.post("/invoices", payload);
  return response.data.data;
};

export const updateInvoiceRequest = async (invoiceId, payload) => {
  const response = await api.put(`/invoices/${invoiceId}`, payload);
  return response.data.data;
};

export const cancelInvoiceRequest = async (invoiceId) => {
  await api.post(`/invoices/${invoiceId}/cancel`);
};

export const downloadInvoicePdfRequest = async (invoiceId, download = false) => {
  const response = await api.get(`/invoices/${invoiceId}/pdf`, {
    params: { download },
    responseType: "blob",
  });
  return response.data;
};

export const emailInvoiceRequest = async (invoiceId, toEmail) => {
  await api.post(`/invoices/${invoiceId}/share/email`, { toEmail });
};

export const dashboardSummaryRequest = async () => {
  const response = await api.get("/dashboard/summary");
  return response.data.data;
};

export const reportsSummaryRequest = async () => {
  const response = await api.get("/reports/summary");
  return response.data.data;
};

export const currentSubscriptionRequest = async () => {
  const response = await api.get("/billing/subscription");
  return response.data.data;
};

export const createSubscriptionRequest = async (payload) => {
  const response = await api.post("/billing/subscription", payload);
  return response.data.data;
};

export const verifySubscriptionPaymentRequest = async (payload) => {
  const response = await api.post("/billing/subscription/verify", payload);
  return response.data.data;
};

export const changeSubscriptionPlanRequest = async (payload) => {
  const response = await api.post("/billing/subscription/change-plan", payload);
  return response.data.data;
};
