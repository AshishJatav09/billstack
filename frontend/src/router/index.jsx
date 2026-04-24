import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "../app/AppLayout";
import AuthLayout from "../components/layout/AuthLayout";
import DashboardLayout from "../components/layout/DashboardLayout";
import GuestRoute from "../components/ui/GuestRoute";
import ProtectedRoute from "../components/ui/ProtectedRoute";
import SuperAdminGuestRoute from "../components/ui/SuperAdminGuestRoute";
import SuperAdminRoute from "../components/ui/SuperAdminRoute";
import ForgotPasswordPage from "../features/auth/pages/ForgotPasswordPage";
import LoginPage from "../features/auth/pages/LoginPage";
import OnboardingPage from "../features/auth/pages/OnboardingPage";
import RegisterPage from "../features/auth/pages/RegisterPage";
import BusinessSettingsPage from "../features/dashboard/pages/BusinessSettingsPage";
import CustomersPage from "../features/dashboard/pages/CustomersPage";
import DashboardHomePage from "../features/dashboard/pages/DashboardHomePage";
import InvoicesPage from "../features/dashboard/pages/InvoicesPage";
import ProductsPage from "../features/dashboard/pages/ProductsPage";
import PurchasesPage from "../features/dashboard/pages/PurchasesPage";
import ReportsPage from "../features/dashboard/pages/ReportsPage";
import SuppliersPage from "../features/dashboard/pages/SuppliersPage";
import SuperAdminDashboardPage from "../features/super-admin/pages/SuperAdminDashboardPage";
import SuperAdminLoginPage from "../features/super-admin/pages/SuperAdminLoginPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: "login", element: <LoginPage /> },
              { path: "register", element: <RegisterPage /> },
              { path: "forgot-password", element: <ForgotPasswordPage /> },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute requireOnboardingComplete={false} />,
        children: [{ path: "onboarding", element: <OnboardingPage /> }],
      },
      {
        element: <SuperAdminGuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [{ path: "super-admin/login", element: <SuperAdminLoginPage /> }],
          },
        ],
      },
      {
        element: <SuperAdminRoute />,
        children: [{ path: "super-admin", element: <SuperAdminDashboardPage /> }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "dashboard",
            element: <DashboardLayout />,
            children: [
              { index: true, element: <DashboardHomePage /> },
              {
                path: "invoices",
                element: <InvoicesPage />,
              },
              {
                path: "customers",
                element: <CustomersPage />,
              },
              {
                path: "products",
                element: <ProductsPage />,
              },
              {
                path: "suppliers",
                element: <SuppliersPage />,
              },
              {
                path: "purchases",
                element: <PurchasesPage />,
              },
              {
                path: "reports",
                element: <ReportsPage />,
              },
              {
                path: "settings",
                element: <BusinessSettingsPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);
