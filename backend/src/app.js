const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");

const { buildCorsOptions } = require("./config/cors");
const { apiRateLimiter } = require("./middlewares/rate-limit.middleware");
const authRoutes = require("./routes/auth.routes");
const businessRoutes = require("./routes/business.routes");
const customerRoutes = require("./routes/customer.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const billingRoutes = require("./routes/billing.routes");
const featureRoutes = require("./routes/feature.routes");
const healthRoutes = require("./routes/health.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const planRoutes = require("./routes/plan.routes");
const productRoutes = require("./routes/product.routes");
const purchaseRoutes = require("./routes/purchase.routes");
const reportRoutes = require("./routes/report.routes");
const supplierRoutes = require("./routes/supplier.routes");
const superAdminRoutes = require("./routes/super-admin.routes");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();
const jsonParser = express.json({ limit: "1mb" });

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(buildCorsOptions()));
app.use(cookieParser());
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/billing/webhook")) {
    return next();
  }

  return jsonParser(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));
app.use("/api", apiRateLimiter);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/products", productRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/features", featureRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
