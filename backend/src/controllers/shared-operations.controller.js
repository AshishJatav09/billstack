const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/shared-operations.service");

const ok = (res, message, data, status = 200) => res.status(status).json({ success: true, message, data });

const createProductionJob = asyncHandler(async (req, res) => ok(res, "Production job created", await service.createProductionJob({ businessId: req.tenant.businessId, userId: req.user._id, payload: req.body, req }), 201));
const listProductionJobs = asyncHandler(async (req, res) => ok(res, "Production jobs fetched", await service.listProductionJobs({ businessId: req.tenant.businessId, query: req.query })));
const setProductionJobStatus = asyncHandler(async (req, res) => ok(res, "Production job status updated", await service.setProductionJobStatus({ businessId: req.tenant.businessId, userId: req.user._id, id: req.params.jobId, status: req.body.status, req })));

const createBatch = asyncHandler(async (req, res) => ok(res, "Batch created", await service.createBatch({ businessId: req.tenant.businessId, userId: req.user._id, payload: req.body, req }), 201));
const listBatches = asyncHandler(async (req, res) => ok(res, "Batches fetched", await service.listBatches({ businessId: req.tenant.businessId, query: req.query })));
const setBatchStatus = asyncHandler(async (req, res) => ok(res, "Batch status updated", await service.setBatchStatus({ businessId: req.tenant.businessId, userId: req.user._id, id: req.params.batchId, status: req.body.status, req })));

const createDispatch = asyncHandler(async (req, res) => ok(res, "Dispatch created", await service.createDispatch({ businessId: req.tenant.businessId, userId: req.user._id, payload: req.body, req }), 201));
const listDispatches = asyncHandler(async (req, res) => ok(res, "Dispatches fetched", await service.listDispatches({ businessId: req.tenant.businessId, query: req.query })));
const setDispatchStatus = asyncHandler(async (req, res) => ok(res, "Dispatch status updated", await service.setDispatchStatus({ businessId: req.tenant.businessId, userId: req.user._id, id: req.params.dispatchId, status: req.body.status, req })));

const createApprovalDocument = asyncHandler(async (req, res) => ok(res, "Approval document created", await service.createApprovalDocument({ businessId: req.tenant.businessId, userId: req.user._id, payload: req.body, req }), 201));
const listApprovalDocuments = asyncHandler(async (req, res) => ok(res, "Approval documents fetched", await service.listApprovalDocuments({ businessId: req.tenant.businessId, query: req.query })));
const setApprovalStatus = asyncHandler(async (req, res) => ok(res, "Approval status updated", await service.setApprovalStatus({ businessId: req.tenant.businessId, userId: req.user._id, role: req.user.role, id: req.params.documentId, status: req.body.status, comment: req.body.comment, req })));

module.exports = {
  createApprovalDocument,
  createBatch,
  createDispatch,
  createProductionJob,
  listApprovalDocuments,
  listBatches,
  listDispatches,
  listProductionJobs,
  setApprovalStatus,
  setBatchStatus,
  setDispatchStatus,
  setProductionJobStatus,
};
