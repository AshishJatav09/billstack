const express = require("express");

const controller = require("../controllers/shared-operations.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const { requireFeature } = require("../middlewares/feature-guard.middleware");
const { requireModule } = require("../middlewares/module-guard.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { permit } = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription());

router.get("/production-jobs", requireModule("production_job_work"), requireFeature("productionJobWork"), controller.listProductionJobs);
router.post("/production-jobs", requireModule("production_job_work"), requireFeature("productionJobWork"), permit("owner", "admin", "staff"), controller.createProductionJob);
router.post("/production-jobs/:jobId/status", validateObjectIdParam("jobId"), requireModule("production_job_work"), requireFeature("productionJobWork"), permit("owner", "admin", "staff"), controller.setProductionJobStatus);

router.get("/batches", requireModule("batch_expiry"), requireFeature("batchExpiry"), controller.listBatches);
router.post("/batches", requireModule("batch_expiry"), requireFeature("batchExpiry"), permit("owner", "admin", "staff"), controller.createBatch);
router.post("/batches/:batchId/status", validateObjectIdParam("batchId"), requireModule("batch_expiry"), requireFeature("batchExpiry"), permit("owner", "admin", "staff"), controller.setBatchStatus);

router.get("/dispatches", requireModule("dispatch_fulfilment"), requireFeature("dispatchFulfilment"), controller.listDispatches);
router.post("/dispatches", requireModule("dispatch_fulfilment"), requireFeature("dispatchFulfilment"), permit("owner", "admin", "staff"), controller.createDispatch);
router.post("/dispatches/:dispatchId/status", validateObjectIdParam("dispatchId"), requireModule("dispatch_fulfilment"), requireFeature("dispatchFulfilment"), permit("owner", "admin", "staff"), controller.setDispatchStatus);

router.get("/approval-documents", requireModule("documents_approvals"), requireFeature("documentsApprovals"), controller.listApprovalDocuments);
router.post("/approval-documents", requireModule("documents_approvals"), requireFeature("documentsApprovals"), permit("owner", "admin", "staff", "accountant"), controller.createApprovalDocument);
router.post("/approval-documents/:documentId/status", validateObjectIdParam("documentId"), requireModule("documents_approvals"), requireFeature("documentsApprovals"), permit("owner", "admin", "staff", "accountant"), controller.setApprovalStatus);

module.exports = router;
