import axios from "axios";
import { superAdminStore } from "../../store/superAdminStore";

const superAdminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

superAdminApi.interceptors.request.use((config) => {
  const accessToken = superAdminStore.getState().accessToken;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

export const superAdminLoginRequest = async (payload) => {
  const response = await superAdminApi.post("/super-admin/login", payload);
  return response.data.data;
};

export const superAdminOverviewRequest = async () => {
  const response = await superAdminApi.get("/super-admin/overview");
  return response.data.data;
};

export const superAdminBusinessesRequest = async (params) => {
  const response = await superAdminApi.get("/super-admin/businesses", { params });
  return response.data.data;
};

export const superAdminToggleBusinessStatusRequest = async (businessId) => {
  const response = await superAdminApi.post(`/super-admin/businesses/${businessId}/toggle-status`);
  return response.data.data;
};

export const superAdminUpdateBusinessPlanRequest = async (businessId, planCode) => {
  const response = await superAdminApi.post(`/super-admin/businesses/${businessId}/plan`, {
    planCode,
  });
  return response.data.data;
};

export const superAdminListPlansRequest = async () => {
  const response = await superAdminApi.get("/plans");
  return response.data.data;
};
