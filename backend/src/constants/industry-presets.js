const OPERATIONAL_FAMILIES = {
  TRADING_DISTRIBUTION: "TRADING_DISTRIBUTION",
  MANUFACTURING: "MANUFACTURING",
  PROFESSIONAL_SERVICE: "PROFESSIONAL_SERVICE",
  PROJECT_BASED: "PROJECT_BASED",
  APPOINTMENT_BOOKING: "APPOINTMENT_BOOKING",
  RECURRING_MEMBERSHIP: "RECURRING_MEMBERSHIP",
};

const CAPABILITY_STATUS = {
  IMPLEMENTED: "IMPLEMENTED",
  FUTURE: "FUTURE",
};

const capabilityCatalog = [
  { code: "CUSTOMER_MANAGEMENT", label: "Customer management", moduleKey: "customers", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "PRODUCTS_SERVICES", label: "Products and services", moduleKey: "products_services", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "QUOTATIONS", label: "Quotations", moduleKey: "quotations", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "INVOICING", label: "Invoicing", moduleKey: "invoices", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "PAYMENTS", label: "Payments", moduleKey: "payments", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "CUSTOMER_STATEMENT", label: "Customer statements", moduleKey: "ledger", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "EXPENSES", label: "Business expenses", moduleKey: "expenses", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "GST", label: "GST reporting", moduleKey: "gst", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "INVENTORY", label: "Inventory", moduleKey: "inventory", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "SUPPLIERS", label: "Suppliers", moduleKey: "suppliers", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "PURCHASES", label: "Purchases", moduleKey: "purchases", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "COMMUNICATIONS", label: "Payment reminders and communications", moduleKey: "communications", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "E_INVOICE", label: "E-invoice readiness", moduleKey: "gst", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "API_INTEGRATION", label: "API integrations", moduleKey: "integrations", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "MULTI_LOCATION", label: "Multi-location operations", moduleKey: "settings", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "ORDER_MANAGEMENT", label: "Orders and fulfilment", moduleKey: "order_management", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "RECURRING_BILLING", label: "Recurring billing", moduleKey: "recurring_billing", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "PROJECTS", label: "Projects", moduleKey: "projects_tasks", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "TASKS_FOLLOWUPS", label: "Tasks and follow-ups", moduleKey: "projects_tasks", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "APPOINTMENTS", label: "Appointments", moduleKey: "appointments_scheduling", status: CAPABILITY_STATUS.IMPLEMENTED },
  { code: "FIELD_OPERATIONS", label: "Field operations", moduleKey: "field_operations", status: CAPABILITY_STATUS.FUTURE },
  { code: "APPROVALS", label: "Approvals", moduleKey: "approvals", status: CAPABILITY_STATUS.FUTURE },
  { code: "ADVANCED_REPORTING", label: "Advanced reporting", moduleKey: "advanced_reports", status: CAPABILITY_STATUS.FUTURE },
  { code: "BARCODE_QR", label: "Barcode and QR", moduleKey: "barcode_qr", status: CAPABILITY_STATUS.FUTURE },
  { code: "PORTAL", label: "Portal", moduleKey: "portal", status: CAPABILITY_STATUS.FUTURE },
  { code: "PRODUCTION", label: "Production workflows", moduleKey: "production", status: CAPABILITY_STATUS.FUTURE },
];

const baseCore = ["customers", "products_services", "invoices", "payments", "ledger", "expenses", "reports"];
const tradeModules = [...baseCore, "quotations", "order_management", "inventory", "suppliers", "purchases", "sales_returns", "credit_notes", "gst"];
const serviceModules = [...baseCore, "quotations", "credit_notes", "communications", "gst"];

const playerTypes = {
  RETAIL: [
    { code: "STORE", displayName: "Retail store", businessModel: "TRADING", recommendedNeeds: ["INVENTORY", "GST"], recommendedModules: tradeModules, optionalModules: ["communications"], futureWorkflowPacks: ["BARCODE_QR", "PORTAL"] },
    { code: "D2C", displayName: "D2C seller", businessModel: "TRADING", recommendedNeeds: ["INVENTORY", "COMMUNICATIONS"], recommendedModules: tradeModules.concat("communications"), optionalModules: [], futureWorkflowPacks: ["PORTAL"] },
  ],
  WHOLESALE_DISTRIBUTION: [
    { code: "DISTRIBUTOR", displayName: "Distributor", businessModel: "TRADING", recommendedNeeds: ["INVENTORY", "SUPPLIERS", "PURCHASES"], recommendedModules: tradeModules, optionalModules: ["communications"], futureWorkflowPacks: ["DEALER_DISTRIBUTOR", "FIELD_OPERATIONS"] },
  ],
  MANUFACTURING: [
    { code: "MANUFACTURER", displayName: "Manufacturer", businessModel: "MANUFACTURING", recommendedNeeds: ["INVENTORY", "SUPPLIERS", "PURCHASES", "GST"], recommendedModules: tradeModules, optionalModules: ["communications"], futureWorkflowPacks: ["PRODUCTION", "BATCH_EXPIRY"] },
  ],
  PROFESSIONAL_SERVICES: [
    { code: "CONSULTANT", displayName: "Consultant / professional", businessModel: "SERVICE", recommendedNeeds: ["QUOTATIONS", "INVOICING", "EXPENSES"], recommendedModules: serviceModules, optionalModules: ["communications"], futureWorkflowPacks: ["RETAINER"] },
  ],
  IT_SOFTWARE: [
    { code: "AGENCY", displayName: "Software/IT agency", businessModel: "PROJECT_BASED", recommendedNeeds: ["QUOTATIONS", "PROJECTS", "API_INTEGRATION"], recommendedModules: serviceModules, optionalModules: ["communications"], futureWorkflowPacks: ["PROJECT", "RETAINER"] },
  ],
  HEALTHCARE: [
    { code: "CLINIC", displayName: "Clinic", businessModel: "SERVICE", recommendedNeeds: ["APPOINTMENTS", "COMMUNICATIONS"], recommendedModules: serviceModules, optionalModules: [], futureWorkflowPacks: ["APPOINTMENT", "PATIENT"] },
    { code: "DIAGNOSTIC_CENTER", displayName: "Diagnostic center", businessModel: "SERVICE", recommendedNeeds: ["APPOINTMENTS", "GST"], recommendedModules: serviceModules, optionalModules: ["inventory"], futureWorkflowPacks: ["PATIENT", "BATCH_EXPIRY"] },
  ],
  REAL_ESTATE: [
    { code: "BROKER", displayName: "Broker / agency", businessModel: "SERVICE", recommendedNeeds: ["QUOTATIONS", "COMMUNICATIONS"], recommendedModules: serviceModules, optionalModules: [], futureWorkflowPacks: ["DEALER_DISTRIBUTOR"] },
  ],
  CONSTRUCTION: [
    { code: "CONTRACTOR", displayName: "Contractor", businessModel: "PROJECT_BASED", recommendedNeeds: ["PROJECTS", "PURCHASES", "EXPENSES"], recommendedModules: tradeModules, optionalModules: ["communications"], futureWorkflowPacks: ["SITE_MATERIAL", "PROJECT"] },
  ],
  TEXTILE_APPAREL: [
    { code: "MANUFACTURER", displayName: "Garment/textile manufacturer", businessModel: "MANUFACTURING", recommendedNeeds: ["INVENTORY", "PURCHASES", "GST"], recommendedModules: tradeModules, optionalModules: ["communications"], futureWorkflowPacks: ["PRODUCTION", "JOB_WORK"] },
    { code: "DISTRIBUTOR", displayName: "Textile distributor", businessModel: "TRADING", recommendedNeeds: ["INVENTORY", "SUPPLIERS"], recommendedModules: tradeModules, optionalModules: [], futureWorkflowPacks: ["DEALER_DISTRIBUTOR"] },
  ],
  EDUCATION_TRAINING: [
    { code: "TRAINING_CENTER", displayName: "Training centre", businessModel: "RECURRING", recommendedNeeds: ["RECURRING_BILLING", "COMMUNICATIONS"], recommendedModules: serviceModules, optionalModules: [], futureWorkflowPacks: ["STUDENT_FEES"] },
  ],
  HOSPITALITY: [
    { code: "HOTEL", displayName: "Hotel / lodging", businessModel: "SERVICE", recommendedNeeds: ["GST", "EXPENSES"], recommendedModules: serviceModules, optionalModules: ["inventory"], futureWorkflowPacks: ["BOOKING"] },
  ],
  FOOD_RESTAURANT: [
    { code: "RESTAURANT", displayName: "Restaurant / cafe", businessModel: "TRADING", recommendedNeeds: ["INVENTORY", "GST"], recommendedModules: tradeModules, optionalModules: ["communications"], futureWorkflowPacks: ["POS", "BATCH_EXPIRY"] },
  ],
  LOGISTICS_TRANSPORT: [
    { code: "TRANSPORTER", displayName: "Transport operator", businessModel: "SERVICE", recommendedNeeds: ["INVOICING", "EXPENSES"], recommendedModules: serviceModules, optionalModules: ["communications"], futureWorkflowPacks: ["FIELD_OPERATIONS"] },
  ],
  AGENCY_MARKETING: [
    { code: "AGENCY", displayName: "Agency", businessModel: "PROJECT_BASED", recommendedNeeds: ["QUOTATIONS", "PROJECTS", "COMMUNICATIONS"], recommendedModules: serviceModules, optionalModules: [], futureWorkflowPacks: ["CAMPAIGN", "RETAINER"] },
  ],
  REPAIR_MAINTENANCE: [
    { code: "SERVICE_CENTER", displayName: "Service centre", businessModel: "SERVICE", recommendedNeeds: ["INVENTORY", "COMMUNICATIONS"], recommendedModules: serviceModules.concat(["inventory", "sales_returns"]), optionalModules: ["purchases"], futureWorkflowPacks: ["AMC_WARRANTY", "FIELD_OPERATIONS"] },
  ],
  OTHER: [
    { code: "CUSTOM", displayName: "Custom business", businessModel: "MIXED", recommendedNeeds: ["INVOICING", "EXPENSES"], recommendedModules: baseCore, optionalModules: ["quotations", "communications", "gst"], futureWorkflowPacks: [] },
  ],
};

const industryCatalog = [
  { code: "RETAIL", displayName: "Retail", description: "Stores and direct-to-consumer sellers.", operationalFamily: OPERATIONAL_FAMILIES.TRADING_DISTRIBUTION, defaultBusinessModel: "TRADING", sortOrder: 10 },
  { code: "WHOLESALE_DISTRIBUTION", displayName: "Wholesale / Distribution", description: "Wholesale, distribution and channel businesses.", operationalFamily: OPERATIONAL_FAMILIES.TRADING_DISTRIBUTION, defaultBusinessModel: "TRADING", sortOrder: 20 },
  { code: "MANUFACTURING", displayName: "Manufacturing", description: "Manufacturers using shared inventory/procurement foundations.", operationalFamily: OPERATIONAL_FAMILIES.MANUFACTURING, defaultBusinessModel: "MANUFACTURING", sortOrder: 30 },
  { code: "PROFESSIONAL_SERVICES", displayName: "Professional Services", description: "Consultants, firms and service businesses.", operationalFamily: OPERATIONAL_FAMILIES.PROFESSIONAL_SERVICE, defaultBusinessModel: "SERVICE", sortOrder: 40 },
  { code: "IT_SOFTWARE", displayName: "IT / Software", description: "Software services and digital delivery teams.", operationalFamily: OPERATIONAL_FAMILIES.PROJECT_BASED, defaultBusinessModel: "PROJECT_BASED", sortOrder: 50 },
  { code: "HEALTHCARE", displayName: "Healthcare", description: "Clinics and diagnostic services; workflow packs are future-only.", operationalFamily: OPERATIONAL_FAMILIES.APPOINTMENT_BOOKING, defaultBusinessModel: "SERVICE", sortOrder: 60 },
  { code: "REAL_ESTATE", displayName: "Real Estate", description: "Property service and brokerage businesses.", operationalFamily: OPERATIONAL_FAMILIES.PROFESSIONAL_SERVICE, defaultBusinessModel: "SERVICE", sortOrder: 70 },
  { code: "CONSTRUCTION", displayName: "Construction", description: "Contractors and project-oriented businesses.", operationalFamily: OPERATIONAL_FAMILIES.PROJECT_BASED, defaultBusinessModel: "PROJECT_BASED", sortOrder: 80 },
  { code: "TEXTILE_APPAREL", displayName: "Textile / Apparel", description: "Textile manufacturing, processing and distribution.", operationalFamily: OPERATIONAL_FAMILIES.MANUFACTURING, defaultBusinessModel: "TRADING", sortOrder: 90 },
  { code: "EDUCATION_TRAINING", displayName: "Education / Training", description: "Training and education businesses.", operationalFamily: OPERATIONAL_FAMILIES.RECURRING_MEMBERSHIP, defaultBusinessModel: "RECURRING", sortOrder: 100 },
  { code: "HOSPITALITY", displayName: "Hospitality", description: "Hotels and hospitality services.", operationalFamily: OPERATIONAL_FAMILIES.APPOINTMENT_BOOKING, defaultBusinessModel: "SERVICE", sortOrder: 110 },
  { code: "FOOD_RESTAURANT", displayName: "Food / Restaurant", description: "Restaurants, cafés and food businesses.", operationalFamily: OPERATIONAL_FAMILIES.TRADING_DISTRIBUTION, defaultBusinessModel: "TRADING", sortOrder: 120 },
  { code: "LOGISTICS_TRANSPORT", displayName: "Logistics / Transport", description: "Transport and logistics operators.", operationalFamily: OPERATIONAL_FAMILIES.PROFESSIONAL_SERVICE, defaultBusinessModel: "SERVICE", sortOrder: 130 },
  { code: "AGENCY_MARKETING", displayName: "Agency / Marketing", description: "Marketing, creative and service agencies.", operationalFamily: OPERATIONAL_FAMILIES.PROJECT_BASED, defaultBusinessModel: "PROJECT_BASED", sortOrder: 140 },
  { code: "REPAIR_MAINTENANCE", displayName: "Repair / Maintenance", description: "Repair, maintenance and service centres.", operationalFamily: OPERATIONAL_FAMILIES.PROFESSIONAL_SERVICE, defaultBusinessModel: "SERVICE", sortOrder: 150 },
  { code: "OTHER", displayName: "Other", description: "Custom or mixed businesses.", operationalFamily: OPERATIONAL_FAMILIES.PROFESSIONAL_SERVICE, defaultBusinessModel: "MIXED", sortOrder: 999 },
].map((industry) => ({
  ...industry,
  supportedPlayerTypes: playerTypes[industry.code] || [],
  recommendedNeeds: (playerTypes[industry.code]?.[0]?.recommendedNeeds || ["INVOICING", "EXPENSES"]),
  recommendedModules: (playerTypes[industry.code]?.[0]?.recommendedModules || baseCore),
  optionalModules: (playerTypes[industry.code]?.[0]?.optionalModules || []),
  futureWorkflowPacks: (playerTypes[industry.code]?.[0]?.futureWorkflowPacks || []),
  active: true,
}));

module.exports = {
  CAPABILITY_STATUS,
  OPERATIONAL_FAMILIES,
  capabilityCatalog,
  industryCatalog,
  playerTypes,
};
