const express = require("express");
const {
  acceptModuleOffer,
  createRazorpayOrder,
  declineModuleOffer,
  getModules,
  getIndustryCatalogue,
  getPreset,
  getWorkspaceRecommendation,
  listOffers,
  listOrders,
  requestModule,
  submitManualUpi,
  updateModuleState,
  updateProfile,
  verifyRazorpayOrder,
} = require("../controllers/module.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const { permit } = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware);

router.get("/", getModules);
router.get("/industries", getIndustryCatalogue);
router.post("/recommendation", getWorkspaceRecommendation);
router.get("/presets/:preset", getPreset);
router.get("/offers", listOffers);
router.get("/orders", listOrders);
router.put("/profile", permit("owner", "admin"), updateProfile);
router.post("/requests", requestModule);
router.post("/offers/:offerId/accept", permit("owner", "admin"), acceptModuleOffer);
router.post("/offers/:offerId/decline", permit("owner", "admin"), declineModuleOffer);
router.post("/offers/:offerId/pay/razorpay", permit("owner", "admin"), createRazorpayOrder);
router.post("/offers/:offerId/pay/manual-upi", permit("owner", "admin"), submitManualUpi);
router.post("/payments/razorpay/verify", permit("owner", "admin"), verifyRazorpayOrder);
router.put("/:moduleKey", permit("owner", "admin"), updateModuleState);

module.exports = router;
