const Business = require("../models/Business");
const BusinessModuleConfig = require("../models/BusinessModuleConfig");
const ModuleRequest = require("../models/ModuleRequest");
const CommercialModule = require("../models/CommercialModule");
const ModuleOffer = require("../models/ModuleOffer");
const ModuleOrder = require("../models/ModuleOrder");
const { syncCommercialCatalogue } = require("./commercial.service");
const AppError = require("../utils/appError");
const {
  MODULE_REQUEST_STATUSES,
  MODULE_STATES,
  BUSINESS_MODELS,
  coreModuleKeys,
  getDeploymentMode,
  moduleCatalog,
  presets,
} = require("../constants/modules");
const { capabilityCatalog, industryCatalog } = require("../constants/industry-presets");
const { recommendPlanForProfile } = require("./commercial-plan.service");

const catalogMap = new Map(moduleCatalog.map((item) => [item.key, item]));

const normalizeModuleKey = (moduleKey) => String(moduleKey || "").trim().toLowerCase();

const isModuleAllowedForDeployment = (moduleMeta, deploymentMode = getDeploymentMode()) =>
  deploymentMode === "SELF_HOSTED"
    ? moduleMeta.availableForSelfHosted !== false
    : moduleMeta.availableForSaas !== false;

const getPresetRecommendations = (preset) => {
  const key = String(preset || "CUSTOM").trim().toUpperCase();
  return {
    preset: presets[key] ? key : "CUSTOM",
    moduleKeys: presets[key] || [],
    modules: (presets[key] || []).map((moduleKey) => catalogMap.get(moduleKey)).filter(Boolean),
  };
};

const capabilityMap = new Map(capabilityCatalog.map((item) => [item.code, item]));
const industryMap = new Map(industryCatalog.map((item) => [item.code, item]));

const normalizeCapabilityCode = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

const normalizeIndustryCode = (value) => {
  const normalized = String(value || "OTHER").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return industryMap.has(normalized) ? normalized : "OTHER";
};

const resolveWorkspacePreset = (profile = {}) => {
  const industryCode = normalizeIndustryCode(profile.industryCode || profile.industry);
  const industry = industryMap.get(industryCode) || industryMap.get("OTHER");
  const requestedPlayer = String(profile.playerTypeCode || profile.playerType || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const knownPlayer = requestedPlayer ? industry.supportedPlayerTypes.find((item) => item.code === requestedPlayer) : null;
  if (requestedPlayer && !knownPlayer) {
    throw new AppError("Invalid player type for selected industry", 400);
  }
  const player =
    knownPlayer ||
    industry.supportedPlayerTypes[0] ||
    null;
  const businessModel = String(profile.businessModel || player?.businessModel || industry.defaultBusinessModel || "MIXED").toUpperCase();
  if (!Object.values(BUSINESS_MODELS).includes(businessModel)) {
    throw new AppError("Invalid business model", 400);
  }

  const selectedNeeds = Array.isArray(profile.selectedNeeds)
    ? profile.selectedNeeds.map(normalizeCapabilityCode).filter(Boolean)
    : [];
  const needs = Array.from(new Set([...(player?.recommendedNeeds || industry.recommendedNeeds || []), ...selectedNeeds]));
  const needModules = needs.map((need) => capabilityMap.get(need)?.moduleKey).filter(Boolean);
  const recommendedModules = Array.from(new Set([...(player?.recommendedModules || industry.recommendedModules || []), ...(presets[businessModel] || []), ...needModules]))
    .filter((moduleKey) => catalogMap.has(moduleKey));
  const optionalModules = Array.from(new Set([...(industry.optionalModules || []), ...(player?.optionalModules || [])]))
    .filter((moduleKey) => catalogMap.has(moduleKey));
  const futureCapabilities = needs
    .map((need) => capabilityMap.get(need))
    .filter((capability) => capability?.status === "FUTURE");
  const futureWorkflowPacks = Array.from(new Set([...(industry.futureWorkflowPacks || []), ...(player?.futureWorkflowPacks || [])]));
  const plan = recommendPlanForProfile({
    ...profile,
    businessModel,
    selectedNeeds: needs,
    recommendedModules,
    numberOfUsers: profile.numberOfUsers,
    numberOfLocations: profile.numberOfLocations,
  });

  return {
    industry,
    playerType: player,
    operationalFamily: industry.operationalFamily,
    businessModel,
    selectedNeeds: needs,
    recommendedModules,
    optionalModules,
    futureCapabilities,
    futureWorkflowPacks,
    recommendedPlan: plan,
  };
};

const hasProfileScopedWorkspace = (business) => {
  const profile = business?.businessProfile || {};
  return profile.onboardingStatus === "COMPLETED" || (Array.isArray(profile.recommendedModules) && profile.recommendedModules.length > 0);
};

const getProfileModuleDefaults = (business) => {
  const profile = business?.businessProfile || {};
  return new Set(Array.isArray(profile.recommendedModules) ? profile.recommendedModules.map(normalizeModuleKey) : []);
};

const resolveDefaultModuleState = ({ business, moduleMeta }) => {
  if (coreModuleKeys.includes(moduleMeta.key) || moduleMeta.protected) {
    return MODULE_STATES.ACTIVE;
  }

  if (hasProfileScopedWorkspace(business)) {
    return getProfileModuleDefaults(business).has(moduleMeta.key)
      ? MODULE_STATES.ACTIVE
      : moduleMeta.isAddOn
        ? MODULE_STATES.REQUEST_REQUIRED
        : MODULE_STATES.AVAILABLE;
  }

  return moduleMeta.defaultEnabled ? MODULE_STATES.ACTIVE : MODULE_STATES.REQUEST_REQUIRED;
};

const serializeModuleConfig = ({ moduleMeta, config, deploymentMode, business }) => {
  const deploymentAllowed = isModuleAllowedForDeployment(moduleMeta, deploymentMode);
  const defaultState = resolveDefaultModuleState({ business, moduleMeta });
  const state = deploymentAllowed ? config?.state || defaultState : MODULE_STATES.DISABLED;

  return {
    ...moduleMeta,
    deploymentAllowed,
    state,
    active: state === MODULE_STATES.ACTIVE,
    protected: Boolean(moduleMeta.protected || coreModuleKeys.includes(moduleMeta.key)),
    defaultSource: config?.source || (hasProfileScopedWorkspace(business) ? "PRESET" : "LEGACY_DEFAULT"),
    explicitConfig: Boolean(config),
  };
};

const getBusinessModuleState = async ({ businessId, moduleKey }) => {
  const key = normalizeModuleKey(moduleKey);
  const moduleMeta = catalogMap.get(key);

  if (!moduleMeta) {
    throw new AppError("Unknown module", 400);
  }

  const business = await Business.findById(businessId).select("deploymentMode businessProfile");
  if (!business) {
    throw new AppError("Business not found", 404);
  }

  const deploymentMode = business.deploymentMode || getDeploymentMode();
  if (!isModuleAllowedForDeployment(moduleMeta, deploymentMode)) {
    return MODULE_STATES.DISABLED;
  }

  const config = await BusinessModuleConfig.findOne({ businessId, moduleKey: key });
  return config?.state || resolveDefaultModuleState({ business, moduleMeta });
};

const assertModuleActive = async ({ businessId, moduleKey }) => {
  const state = await getBusinessModuleState({ businessId, moduleKey });
  if (state !== MODULE_STATES.ACTIVE) {
    throw new AppError(`The ${moduleKey} module is not active for this business`, 403);
  }
};

const getBusinessModules = async ({ businessId }) => {
  const business = await Business.findById(businessId);
  if (!business) {
    throw new AppError("Business not found", 404);
  }

  const deploymentMode = business.deploymentMode || getDeploymentMode();
  await syncCommercialCatalogue();
  const configs = await BusinessModuleConfig.find({ businessId });
  const commercialModules = await CommercialModule.find({});
  const requests = await ModuleRequest.find({ businessId }).sort("-createdAt").limit(100);
  const offers = await ModuleOffer.find({ businessId }).sort("-createdAt").limit(100);
  const orders = await ModuleOrder.find({ businessId }).sort("-createdAt").limit(100);
  const configMap = new Map(configs.map((item) => [item.moduleKey, item]));
  const commercialMap = new Map(commercialModules.map((item) => [item.moduleKey, item]));
  const requestMap = new Map(requests.map((item) => [item.moduleKey, item]));
  const offerMap = new Map(offers.map((item) => [item.moduleKey, item]));
  const orderMap = new Map(orders.map((item) => [item.offerId?.toString(), item]));

  return {
    deploymentMode,
    catalog: moduleCatalog.map((moduleMeta) => {
      const commercial = commercialMap.get(moduleMeta.key);
      const request = requestMap.get(moduleMeta.key);
      const offer = offerMap.get(moduleMeta.key);
      const order = offer ? orderMap.get(offer._id.toString()) : null;
      const config = serializeModuleConfig({
        moduleMeta,
        config: configMap.get(moduleMeta.key),
        deploymentMode,
        business,
      });
      let commercialState = config.state;
      if (offer?.status === "OFFERED") commercialState = "OFFER_RECEIVED";
      if (offer?.status === "PAYMENT_PENDING") commercialState = "PAYMENT_PENDING";
      if (request && !offer && ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(request.status)) commercialState = "REQUESTED";
      if (order?.paymentStatus === "AWAITING_VERIFICATION") commercialState = "PAYMENT_PENDING";
      return {
        ...config,
        commercial: commercial
          ? {
              commercialType: commercial.commercialType,
              pricingType: commercial.pricingType,
              defaultPrice: commercial.defaultPrice,
              currency: commercial.currency,
              gstApplicable: commercial.gstApplicable,
              gstRate: commercial.gstRate,
              negotiable: commercial.negotiable,
              active: commercial.active,
              badgeText: commercial.badgeText,
            }
          : null,
        commercialState,
        latestRequest: request || null,
        latestOffer: offer || null,
        latestOrder: order || null,
      };
    }),
    requests,
    offers,
    orders,
    presets: Object.keys(presets).map((presetKey) => ({
      key: presetKey,
      moduleKeys: presets[presetKey],
    })),
    industries: industryCatalog,
    capabilities: capabilityCatalog,
    businessProfile: business.businessProfile || {},
    activeModules: moduleCatalog
      .map((moduleMeta) =>
        serializeModuleConfig({
          moduleMeta,
          config: configMap.get(moduleMeta.key),
          deploymentMode,
          business,
        })
      )
      .filter((item) => item.active)
      .map((item) => item.key),
    visibilityContract: [
      "deployment availability",
      "business module activation/preset",
      "plan/add-on entitlement",
      "role permission",
      "visible workspace",
    ],
  };
};

const setBusinessModuleState = async ({ businessId, moduleKey, state, userId, source = "SETTINGS" }) => {
  const key = normalizeModuleKey(moduleKey);
  const moduleMeta = catalogMap.get(key);

  if (!moduleMeta) {
    throw new AppError("Unknown module", 400);
  }

  if (!Object.values(MODULE_STATES).includes(state)) {
    throw new AppError("Invalid module state", 400);
  }

  if (coreModuleKeys.includes(key) && state !== MODULE_STATES.ACTIVE) {
    throw new AppError("Core BillStack modules cannot be disabled", 400);
  }

  const business = await Business.findById(businessId).select("deploymentMode");
  if (!business) {
    throw new AppError("Business not found", 404);
  }

  if (!isModuleAllowedForDeployment(moduleMeta, business.deploymentMode || getDeploymentMode())) {
    throw new AppError("Module is not available for this deployment mode", 400);
  }

  const config = await BusinessModuleConfig.findOneAndUpdate(
    { businessId, moduleKey: key },
    { $set: { state, configuredBy: userId, source } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return config;
};

const updateBusinessProfile = async ({ businessId, payload }) => {
  const business = await Business.findById(businessId);
  if (!business) {
    throw new AppError("Business not found", 404);
  }

  const resolved = resolveWorkspacePreset({
    industry: payload.industry,
    industryCode: payload.industryCode,
    playerType: payload.playerType,
    playerTypeCode: payload.playerTypeCode,
    businessModel: payload.businessModel,
    selectedNeeds: payload.selectedNeeds,
    numberOfUsers: payload.numberOfUsers,
    numberOfLocations: payload.numberOfLocations,
  });
  const selectedNeeds = Array.isArray(payload.selectedNeeds)
    ? payload.selectedNeeds.map(normalizeCapabilityCode).filter(Boolean)
    : [];
  const selectedModules = Array.isArray(payload.selectedModules)
    ? payload.selectedModules.map(normalizeModuleKey).filter(Boolean)
    : [];
  const recommendedModules = Array.from(new Set([...resolved.recommendedModules, ...selectedModules]));

  business.industry = resolved.industry.displayName || payload.industry?.trim() || business.industry || "";
  business.businessProfile = {
    industryCode: resolved.industry.code,
    playerType: resolved.playerType?.displayName || payload.playerType?.trim() || "",
    playerTypeCode: resolved.playerType?.code || payload.playerTypeCode || "",
    operationalFamily: resolved.operationalFamily,
    businessModel: resolved.businessModel,
    businessSize: payload.businessSize?.trim() || "",
    numberOfUsers: Math.max(1, Number(payload.numberOfUsers || 1)),
    numberOfLocations: Math.max(1, Number(payload.numberOfLocations || 1)),
    gstRegistered: payload.gstRegistered === true || payload.gstRegistered === "true",
    selectedNeeds: Array.from(new Set([...resolved.selectedNeeds, ...selectedNeeds])),
    recommendedModules,
    optionalModules: resolved.optionalModules,
    futureCapabilities: resolved.futureCapabilities.map((item) => item.code),
    futureWorkflowPacks: resolved.futureWorkflowPacks,
    recommendedPlanCode: resolved.recommendedPlan.recommendedPlanCode,
    preset: resolved.businessModel,
    onboardingStatus: "COMPLETED",
  };
  business.onboardingCompleted = true;
  await business.save();

  const activeKeys = recommendedModules.filter((key) => catalogMap.get(key)?.status === "IMPLEMENTED");
  await Promise.all(
    activeKeys.map((moduleKey) =>
      setBusinessModuleState({
        businessId,
        moduleKey,
        state: MODULE_STATES.ACTIVE,
        source: "ONBOARDING",
      })
    )
  );

  return business;
};

const createModuleRequest = async ({ businessId, moduleKey, requestType, message, requestedBy }) => {
  const key = normalizeModuleKey(moduleKey);
  if (key && !catalogMap.has(key)) {
    throw new AppError("Unknown module", 400);
  }

  try {
    return await ModuleRequest.create({
      businessId,
      moduleKey: key,
      requestType: requestType || "MODULE",
      message: message || "",
      requestedBy,
      status: MODULE_REQUEST_STATUSES.PENDING,
    });
  } catch (error) {
    if (error.code === 11000) {
      return ModuleRequest.findOne({
        businessId,
        moduleKey: key,
        requestType: requestType || "MODULE",
        status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
      });
    }
    throw error;
  }
};

module.exports = {
  assertModuleActive,
  createModuleRequest,
  getBusinessModules,
  getPresetRecommendations,
  resolveWorkspacePreset,
  moduleCatalog,
  setBusinessModuleState,
  updateBusinessProfile,
  _private: {
    getProfileModuleDefaults,
    hasProfileScopedWorkspace,
    resolveDefaultModuleState,
    serializeModuleConfig,
  },
};
