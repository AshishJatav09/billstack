const PLAN_CODES = {
  FREE: "free",
  BASIC: "basic",
  PRO: "pro",
  ENTERPRISE: "enterprise",
};

const PLAN_DEFINITIONS = {
  [PLAN_CODES.FREE]: {
    code: PLAN_CODES.FREE,
    name: "Free",
    invoiceMonthlyLimit: 20,
    staffUserLimit: 2,
    inventoryAccess: false,
    reportsAccess: false,
    pdfTemplatesAccess: false,
    sharingAccess: false,
  },
  [PLAN_CODES.BASIC]: {
    code: PLAN_CODES.BASIC,
    name: "Basic",
    invoiceMonthlyLimit: 250,
    staffUserLimit: 5,
    inventoryAccess: true,
    reportsAccess: false,
    pdfTemplatesAccess: true,
    sharingAccess: true,
  },
  [PLAN_CODES.PRO]: {
    code: PLAN_CODES.PRO,
    name: "Pro",
    invoiceMonthlyLimit: 2000,
    staffUserLimit: 20,
    inventoryAccess: true,
    reportsAccess: true,
    pdfTemplatesAccess: true,
    sharingAccess: true,
  },
  [PLAN_CODES.ENTERPRISE]: {
    code: PLAN_CODES.ENTERPRISE,
    name: "Enterprise",
    invoiceMonthlyLimit: Number.MAX_SAFE_INTEGER,
    staffUserLimit: 9999,
    inventoryAccess: true,
    reportsAccess: true,
    pdfTemplatesAccess: true,
    sharingAccess: true,
  },
};

const PLAN_FEATURE_MAP = {
  inventory: "inventoryAccess",
  reports: "reportsAccess",
  pdfTemplates: "pdfTemplatesAccess",
  sharing: "sharingAccess",
};

module.exports = {
  PLAN_CODES,
  PLAN_DEFINITIONS,
  PLAN_FEATURE_MAP,
};

