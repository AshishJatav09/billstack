const { DEPLOYMENT_MODES } = require("../constants/modules");
const { updateBusinessProfile } = require("./module.service");

const parseCsv = (value, fallback = []) => {
  const parsed = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
};

const SELF_HOSTED_REAL_ESTATE_DEFAULT_NEEDS = [
  "QUOTATIONS",
  "COMMUNICATIONS",
  "RECURRING_BILLING",
  "APPOINTMENTS",
  "GST",
  "EXPENSES",
];

const getSelfHostedDefaultProfilePayload = () => ({
  industryCode: process.env.BILLSTACK_SELF_HOSTED_INDUSTRY_CODE || "REAL_ESTATE",
  playerTypeCode: process.env.BILLSTACK_SELF_HOSTED_PLAYER_TYPE_CODE || "BROKER",
  businessModel: process.env.BILLSTACK_SELF_HOSTED_BUSINESS_MODEL || "SERVICE",
  selectedNeeds: parseCsv(process.env.BILLSTACK_SELF_HOSTED_SELECTED_NEEDS, SELF_HOSTED_REAL_ESTATE_DEFAULT_NEEDS),
  selectedModules: parseCsv(process.env.BILLSTACK_SELF_HOSTED_SELECTED_MODULES, []),
  businessSize: process.env.BILLSTACK_SELF_HOSTED_BUSINESS_SIZE || "SMALL",
  numberOfUsers: Number(process.env.BILLSTACK_SELF_HOSTED_USERS || 1),
  numberOfLocations: Number(process.env.BILLSTACK_SELF_HOSTED_LOCATIONS || 1),
  gstRegistered: process.env.BILLSTACK_SELF_HOSTED_GST_REGISTERED === "true",
});

const needsSelfHostedProfile = (business) =>
  business?.deploymentMode === DEPLOYMENT_MODES.SELF_HOSTED &&
  (
    business.onboardingCompleted !== true ||
    business.businessProfile?.onboardingStatus !== "COMPLETED" ||
    !business.businessProfile?.industryCode ||
    !Array.isArray(business.businessProfile?.recommendedModules) ||
    business.businessProfile.recommendedModules.length === 0
  );

const ensureSelfHostedBusinessProfile = async (business) => {
  if (!needsSelfHostedProfile(business)) {
    return business;
  }

  return updateBusinessProfile({
    businessId: business._id,
    payload: getSelfHostedDefaultProfilePayload(),
  });
};

module.exports = {
  ensureSelfHostedBusinessProfile,
  getSelfHostedDefaultProfilePayload,
  _private: {
    needsSelfHostedProfile,
    parseCsv,
    SELF_HOSTED_REAL_ESTATE_DEFAULT_NEEDS,
  },
};
