const Business = require("../models/Business");
const BusinessSubscription = require("../models/BusinessSubscription");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { signSuperAdminToken } = require("../services/super-admin.service");
const { getPlanByCode, serializeBusinessWithPlan } = require("../utils/businessPlan");
const {
  buildPaginatedResponse,
  buildPagination,
  buildSearchFilter,
  buildSort,
} = require("../utils/queryFeatures");

const planMonthlyValue = {
  free: 0,
  basic: 999,
  pro: 2499,
  enterprise: 9999,
};
const validPlanCodes = Object.keys(planMonthlyValue);

const listBusinessSortFields = ["name", "planCode", "createdAt"];

const superAdminLogin = asyncHandler(async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (
    email !== (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase() ||
    password !== (process.env.SUPER_ADMIN_PASSWORD || "")
  ) {
    throw new AppError("Invalid super admin credentials", 401);
  }

  const accessToken = signSuperAdminToken({
    role: "super_admin",
    email,
  });

  res.status(200).json({
    message: "Super admin login successful",
    data: {
      accessToken,
      email,
    },
  });
});

const getSuperAdminOverview = asyncHandler(async (_req, res) => {
  const [businesses, totalUsers, activeSubscriptions, expiredSubscriptions, revenueAnalytics] =
    await Promise.all([
      Business.find({}).sort("-createdAt"),
      User.countDocuments({}),
      BusinessSubscription.countDocuments({
        planCode: { $ne: "free" },
        status: { $in: ["active", "authenticated"] },
      }),
      BusinessSubscription.countDocuments({
        status: { $in: ["expired", "cancelled", "completed"] },
      }),
      BusinessSubscription.aggregate([
        {
          $match: {
            planCode: { $ne: "free" },
          },
        },
        {
          $project: {
            planCode: 1,
            currentStart: 1,
          },
        },
      ]),
    ]);

  const totalBusinesses = businesses.length;
  const trialUsers = businesses.filter((business) => business.planCode === "free").length;
  const monthlyRecurringRevenue = businesses.reduce(
    (sum, business) => sum + (planMonthlyValue[business.planCode] || 0),
    0
  );

  const monthBuckets = {};
  revenueAnalytics.forEach((item) => {
    const date = item.currentStart ? new Date(item.currentStart) : new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthBuckets[key] = (monthBuckets[key] || 0) + (planMonthlyValue[item.planCode] || 0);
  });

  const revenueChart = Object.entries(monthBuckets)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, revenue]) => ({ month, revenue }));

  res.status(200).json({
    message: "Super admin overview fetched successfully",
    data: {
      metrics: {
        totalBusinesses,
        totalUsers,
        activeSubscriptions,
        monthlyRecurringRevenue,
        trialUsers,
        expiredSubscriptions,
      },
      revenueChart,
    },
  });
});

const listBusinesses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const sort = buildSort(req.query.sortBy, req.query.sortOrder, listBusinessSortFields, "-createdAt");
  const searchFilter = buildSearchFilter(req.query.search, ["name", "slug", "email", "billingEmail"]);

  const filters = {
    ...searchFilter,
  };

  if (req.query.planCode) {
    filters.planCode = req.query.planCode;
  }

  if (req.query.isDisabled === "true") {
    filters.isDisabled = true;
  }

  if (req.query.isDisabled === "false") {
    filters.isDisabled = false;
  }

  const [items, total] = await Promise.all([
    Business.find(filters).sort(sort).skip(skip).limit(limit),
    Business.countDocuments(filters),
  ]);

  const businessIds = items.map((business) => business._id);
  const subscriptions = await BusinessSubscription.find({
    businessId: { $in: businessIds },
  });
  const subscriptionMap = new Map(
    subscriptions.map((subscription) => [subscription.businessId.toString(), subscription])
  );

  res.status(200).json({
    message: "Businesses fetched successfully",
    data: buildPaginatedResponse({
      items: items.map((business) =>
        serializeBusinessWithPlan(
          business,
          subscriptionMap.get(business._id.toString()) || null
        )
      ),
      total,
      page,
      limit,
    }),
  });
});

const toggleBusinessStatus = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  business.isDisabled = !business.isDisabled;
  await business.save();

  const subscription = await BusinessSubscription.findOne({ businessId: business._id });

  res.status(200).json({
    message: `Business ${business.isDisabled ? "disabled" : "enabled"} successfully`,
    data: serializeBusinessWithPlan(business, subscription),
  });
});

const updateBusinessPlanBySuperAdmin = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  const planCode = String(req.body.planCode || "").trim().toLowerCase();
  if (!validPlanCodes.includes(planCode)) {
    throw new AppError("Invalid plan code", 400);
  }

  business.planCode = planCode;
  await business.save();

  let subscription = await BusinessSubscription.findOne({ businessId: business._id });
  if (!subscription) {
    subscription = await BusinessSubscription.create({
      businessId: business._id,
      planCode,
      status: planCode === "free" ? "active" : "inactive",
    });
  } else {
    subscription.planCode = planCode;
    if (planCode === "free") {
      subscription.status = "active";
    }
    await subscription.save();
  }

  res.status(200).json({
    message: "Business plan updated successfully",
    data: serializeBusinessWithPlan(business, subscription),
  });
});

module.exports = {
  getSuperAdminOverview,
  listBusinesses,
  superAdminLogin,
  toggleBusinessStatus,
  updateBusinessPlanBySuperAdmin,
};
