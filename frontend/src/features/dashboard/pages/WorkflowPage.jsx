import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { authStore } from "../../../store/authStore";
import { isActiveModule, isRealEstateSelfHostedWorkspace, shouldShowWorkspaceNavigation } from "../../workspace/workspaceVisibility";
import {
  createAppointmentRequest,
  createApprovalDocumentRequest,
  createBatchRequest,
  createDispatchRequest,
  createOrderRequest,
  createProductionJobRequest,
  createProjectRequest,
  createRecurringProfileRequest,
  createTaskRequest,
  generateRecurringInvoiceRequest,
  getBusinessModulesRequest,
  listAppointmentsRequest,
  listApprovalDocumentsRequest,
  listBatchesRequest,
  listCustomersRequest,
  listDispatchesRequest,
  listOrdersRequest,
  listProductsRequest,
  listProductionJobsRequest,
  listProjectsRequest,
  listRecurringProfilesRequest,
  listTasksRequest,
  listTeamMembersRequest,
  updateAppointmentStatusRequest,
  updateApprovalDocumentStatusRequest,
  updateBatchStatusRequest,
  updateDispatchStatusRequest,
  updateOrderFulfilmentRequest,
  updateOrderStatusRequest,
  updateProductionJobStatusRequest,
  updateProjectRequest,
  updateRecurringStatusRequest,
  updateTaskRequest,
  convertOrderToInvoiceRequest,
} from "../../auth/api";

const tabs = [
  { key: "orders", label: "Orders", realEstateLabel: "Orders", path: "/dashboard/orders", icon: ClipboardList, moduleKey: "order_management" },
  { key: "projects", label: "Projects", realEstateLabel: "Projects", path: "/dashboard/projects", icon: FileText, moduleKey: "projects_tasks" },
  { key: "tasks", label: "Tasks", realEstateLabel: "Tasks", path: "/dashboard/tasks", icon: CheckCircle2, moduleKey: "projects_tasks" },
  { key: "recurring", label: "Recurring Billing", realEstateLabel: "Monthly Billing", path: "/dashboard/recurring-billing", icon: RefreshCw, moduleKey: "recurring_billing" },
  { key: "appointments", label: "Appointments", realEstateLabel: "Site Visits", path: "/dashboard/appointments", icon: CalendarClock, moduleKey: "appointments_scheduling" },
  { key: "production", label: "Production / Job Work", realEstateLabel: "Production / Job Work", path: "/dashboard/production-jobs", icon: ClipboardList, moduleKey: "production_job_work" },
  { key: "batches", label: "Batch & Expiry", realEstateLabel: "Batch & Expiry", path: "/dashboard/batches", icon: RefreshCw, moduleKey: "batch_expiry" },
  { key: "dispatches", label: "Dispatch / Fulfilment", realEstateLabel: "Dispatch / Fulfilment", path: "/dashboard/dispatches", icon: ClipboardList, moduleKey: "dispatch_fulfilment" },
  { key: "approvals", label: "Documents & Approvals", realEstateLabel: "Documents & Approvals", path: "/dashboard/approvals", icon: FileText, moduleKey: "documents_approvals" },
];

const statusTone = {
  DRAFT: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-amber-50 text-amber-700",
  PARTIALLY_FULFILLED: "bg-purple-50 text-purple-700",
  FULFILLED: "bg-emerald-50 text-emerald-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  DONE: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  SCHEDULED: "bg-blue-50 text-blue-700",
  PAUSED: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-rose-50 text-rose-700",
  BLOCKED: "bg-rose-50 text-rose-700",
  PLANNED: "bg-blue-50 text-blue-700",
  PACKED: "bg-amber-50 text-amber-700",
  DISPATCHED: "bg-purple-50 text-purple-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  QUARANTINED: "bg-amber-50 text-amber-700",
  CONSUMED: "bg-slate-100 text-slate-700",
  EXPIRED: "bg-rose-50 text-rose-700",
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

const Badge = ({ children }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[children] || "bg-slate-100 text-slate-700"}`}>
    {String(children || "—").replaceAll("_", " ")}
  </span>
);

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
    <p className="text-base font-semibold text-slate-900">{title}</p>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </div>
);

const WorkflowPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { business } = authStore();
  const [moduleData, setModuleData] = useState(null);
  const visibleTabs = useMemo(() => tabs
    .filter((tab) => isActiveModule(moduleData, tab.moduleKey) && shouldShowWorkspaceNavigation(tab.moduleKey, moduleData, business))
    .map((tab) => ({ ...tab, label: isRealEstateSelfHostedWorkspace(moduleData, business) ? tab.realEstateLabel : tab.label })), [moduleData, business]);
  const activeTab = (visibleTabs.find((tab) => tab.path === location.pathname) || visibleTabs[0] || tabs.find((tab) => tab.path === location.pathname) || tabs[0]).key;
  const [data, setData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({});

  const currentTab = visibleTabs.find((tab) => tab.key === activeTab) || tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const isRealEstateClient = isRealEstateSelfHostedWorkspace(moduleData, business);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      let effectiveModuleData = moduleData;
      if (!moduleData) {
        effectiveModuleData = await getBusinessModulesRequest();
        setModuleData(effectiveModuleData);
      }
      const allowedTabs = tabs.filter((tab) => isActiveModule(effectiveModuleData, tab.moduleKey) && shouldShowWorkspaceNavigation(tab.moduleKey, effectiveModuleData, business));
      if (allowedTabs.length && !allowedTabs.some((tab) => tab.key === activeTab)) {
        navigate(allowedTabs[0].path, { replace: true });
        setData([]);
        return;
      }
      const request = {
        orders: listOrdersRequest,
        projects: listProjectsRequest,
        tasks: listTasksRequest,
        recurring: listRecurringProfilesRequest,
        appointments: listAppointmentsRequest,
        production: listProductionJobsRequest,
        batches: listBatchesRequest,
        dispatches: listDispatchesRequest,
        approvals: listApprovalDocumentsRequest,
      }[activeTab];
      const response = await request(query ? { search: query } : undefined);
      setData(Array.isArray(response) ? response : response?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load this workflow module.");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    getBusinessModulesRequest()
      .then(setModuleData)
      .catch(() => setModuleData({ catalog: [] }));
  }, []);

  useEffect(() => {
    if (!moduleData || !visibleTabs.length) return;
    if (!visibleTabs.some((tab) => tab.path === location.pathname)) {
      navigate(visibleTabs[0].path, { replace: true });
    }
  }, [location.pathname, moduleData, navigate, visibleTabs]);

  useEffect(() => {
    Promise.allSettled([listCustomersRequest(), listProductsRequest(), listProjectsRequest(), listTeamMembersRequest()])
      .then(([customerResult, productResult, projectResult, teamResult]) => {
        if (customerResult.status === "fulfilled") setCustomers(customerResult.value?.items || customerResult.value || []);
        if (productResult.status === "fulfilled") setProducts(productResult.value?.items || productResult.value || []);
        if (projectResult.status === "fulfilled") setProjects(projectResult.value?.items || projectResult.value || []);
        if (teamResult.status === "fulfilled") setTeam(teamResult.value?.items || teamResult.value || []);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!query) return data;
    const needle = query.toLowerCase();
    return data.filter((item) => JSON.stringify(item).toLowerCase().includes(needle));
  }, [data, query]);

  const firstCustomer = customers[0]?._id || customers[0]?.id || "";
  const firstProduct = products[0]?._id || products[0]?.id || "";
  const firstProject = projects[0]?._id || projects[0]?.id || "";
  const firstUser = team[0]?._id || team[0]?.id || "";
  const selectedProduct = products.find((product) => String(product._id || product.id) === String(form.productId || ""));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (activeTab === "orders") {
        await createOrderRequest({
          customerId: form.customerId || firstCustomer,
          expectedDeliveryDate: form.expectedDeliveryDate || undefined,
          lineItems: [{ productId: form.productId || firstProduct, quantity: Number(form.quantity || 1), rate: Number(form.rate || 0) }],
          notes: form.notes || "",
        });
      }
      if (activeTab === "projects") {
        await createProjectRequest({ name: form.name, customerId: form.customerId || undefined, dueDate: form.dueDate || undefined, assignedUsers: firstUser ? [firstUser] : [] });
      }
      if (activeTab === "tasks") {
        await createTaskRequest({ title: form.title, projectId: form.projectId || firstProject || undefined, assignedTo: form.assignedTo || firstUser || undefined, dueDate: form.dueDate || undefined });
      }
      if (activeTab === "recurring") {
        await createRecurringProfileRequest({
          customerId: form.customerId || firstCustomer,
          name: form.name,
          frequency: form.frequency || "MONTHLY",
          startDate: form.startDate || new Date().toISOString().slice(0, 10),
          lineItems: [{ productId: form.productId || firstProduct, quantity: Number(form.quantity || 1), rate: Number(form.rate || 0) }],
        });
      }
      if (activeTab === "appointments") {
        await createAppointmentRequest({
          title: form.title,
          customerId: form.customerId || undefined,
          assignedUsers: firstUser ? [firstUser] : [],
          startAt: form.startAt,
          endAt: form.endAt,
          locationType: form.locationType || "OFFICE",
        });
      }
      if (activeTab === "production") {
        await createProductionJobRequest({
          title: form.title || form.name,
          outputProductId: form.productId || firstProduct,
          outputQuantity: Number(form.quantity || 1),
          inputItems: form.inputProductId ? [{ productId: form.inputProductId, quantity: Number(form.inputQuantity || 1) }] : [],
          dueDate: form.dueDate || undefined,
          notes: form.notes || "",
        });
      }
      if (activeTab === "batches") {
        await createBatchRequest({
          productId: form.productId || firstProduct,
          batchNumber: form.batchNumber || form.name,
          quantityOnHand: Number(form.quantity || 0),
          manufactureDate: form.manufactureDate || undefined,
          expiryDate: form.expiryDate || undefined,
          notes: form.notes || "",
        });
      }
      if (activeTab === "dispatches") {
        await createDispatchRequest({
          customerId: form.customerId || firstCustomer,
          items: [{ productId: form.productId || firstProduct, quantity: Number(form.quantity || 1) }],
          carrier: form.carrier || "",
          trackingNumber: form.trackingNumber || "",
          dispatchDate: form.dispatchDate || undefined,
        });
      }
      if (activeTab === "approvals") {
        await createApprovalDocumentRequest({
          title: form.title || form.name,
          documentType: form.documentType || "GENERAL",
          approvers: firstUser ? [firstUser] : [],
          notes: form.notes || "",
        });
      }
      setForm({});
      setSuccess(`${currentTab.label} saved successfully.`);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to save. Please check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  const action = async (fn, message) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      setSuccess(message);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Action could not be completed.");
    } finally {
      setSaving(false);
    }
  };

  const markOrderFulfilled = (order) =>
    updateOrderFulfilmentRequest(
      order._id,
      (order.lineItems || []).map((line) => ({
        lineItemId: line._id,
        fulfilledQuantity: line.quantity,
      }))
    );

  const renderRows = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center rounded-2xl border bg-white p-12 text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading {currentTab.label.toLowerCase()}...
        </div>
      );
    }
    if (!filtered.length) return <EmptyState title={`No ${currentTab.label.toLowerCase()} yet`} description="Create the first record when this module is active and your plan allows it." />;

    if (activeTab === "orders") {
      return filtered.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">{item.orderNumber}</p>
              <p className="text-sm text-slate-500">{item.customerId?.name || item.customerSnapshot?.name || "Customer"} · {formatDate(item.orderDate)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{item.status}</Badge>
              <Badge>{item.fulfilmentStatus}</Badge>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-900">{money(item.grandTotal)}</span>
            <div className="flex flex-wrap gap-2">
              {item.status === "DRAFT" ? <button className="btn-secondary" onClick={() => action(() => updateOrderStatusRequest(item._id, "CONFIRMED"), "Order confirmed.")}>Confirm</button> : null}
              {item.status === "CONFIRMED" ? <button className="btn-secondary" onClick={() => action(() => updateOrderStatusRequest(item._id, "PROCESSING"), "Order moved to processing.")}>Process</button> : null}
              {["CONFIRMED", "PROCESSING", "PARTIALLY_FULFILLED"].includes(item.status) && item.fulfilmentStatus !== "FULFILLED" ? <button className="btn-secondary" onClick={() => action(() => markOrderFulfilled(item), "Order marked fulfilled.")}>Mark fulfilled</button> : null}
              {!item.invoiceIds?.length && item.status !== "CANCELLED" ? <button className="btn-primary" onClick={() => action(() => convertOrderToInvoiceRequest(item._id), "Invoice created from order.")}>Create invoice</button> : null}
              {["DRAFT", "CONFIRMED", "PROCESSING", "PARTIALLY_FULFILLED"].includes(item.status) ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateOrderStatusRequest(item._id, "CANCELLED"), "Order cancelled.")}><XCircle size={15} /> Cancel</button> : null}
            </div>
          </div>
        </div>
      ));
    }

    if (activeTab === "projects") {
      return filtered.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">{item.name}</p>
              <p className="text-sm text-slate-500">{item.projectNumber} · {item.customerId?.name || "Internal"} · Due {formatDate(item.dueDate)}</p>
            </div>
            <Badge>{item.status}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status === "PLANNING" ? <button className="btn-secondary" onClick={() => action(() => updateProjectRequest(item._id, { status: "ACTIVE" }), "Project activated.")}>Start</button> : null}
            {item.status === "ACTIVE" ? <button className="btn-secondary" onClick={() => action(() => updateProjectRequest(item._id, { status: "ON_HOLD" }), "Project put on hold.")}>Hold</button> : null}
            {item.status === "ON_HOLD" ? <button className="btn-secondary" onClick={() => action(() => updateProjectRequest(item._id, { status: "ACTIVE" }), "Project resumed.")}>Resume</button> : null}
            {item.status === "ACTIVE" ? <button className="btn-secondary" onClick={() => action(() => updateProjectRequest(item._id, { status: "COMPLETED" }), "Project completed.")}>Complete</button> : null}
            {["PLANNING", "ACTIVE", "ON_HOLD"].includes(item.status) ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateProjectRequest(item._id, { status: "CANCELLED" }), "Project cancelled.")}>Cancel</button> : null}
          </div>
        </div>
      ));
    }

    if (activeTab === "tasks") {
      return filtered.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">{item.title}</p>
              <p className="text-sm text-slate-500">{item.projectId?.name || "Standalone"} · {item.assignedTo?.name || "Unassigned"} · Due {formatDate(item.dueDate)}</p>
            </div>
            <Badge>{item.status}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status === "TODO" ? <button className="btn-secondary" onClick={() => action(() => updateTaskRequest(item._id, { status: "IN_PROGRESS" }), "Task moved to in progress.")}>Start</button> : null}
            {["TODO", "IN_PROGRESS"].includes(item.status) ? <button className="btn-secondary" onClick={() => action(() => updateTaskRequest(item._id, { status: "BLOCKED" }), "Task blocked.")}>Block</button> : null}
            {item.status === "BLOCKED" ? <button className="btn-secondary" onClick={() => action(() => updateTaskRequest(item._id, { status: "IN_PROGRESS" }), "Task resumed.")}>Resume</button> : null}
            {["TODO", "IN_PROGRESS", "BLOCKED"].includes(item.status) ? <button className="btn-secondary" onClick={() => action(() => updateTaskRequest(item._id, { status: "DONE" }), "Task completed.")}>Done</button> : null}
            {["TODO", "IN_PROGRESS", "BLOCKED"].includes(item.status) ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateTaskRequest(item._id, { status: "CANCELLED" }), "Task cancelled.")}>Cancel</button> : null}
          </div>
        </div>
      ));
    }

    if (activeTab === "recurring") {
      return filtered.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">{item.name}</p>
              <p className="text-sm text-slate-500">{item.customerId?.name || "Customer"} · {item.frequency} · Next {formatDate(item.nextBillingDate)}</p>
            </div>
            <Badge>{item.status}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">{money(item.grandTotal)}</span>
            <div className="flex flex-wrap gap-2">
              {item.status === "DRAFT" ? <button className="btn-secondary" onClick={() => action(() => updateRecurringStatusRequest(item._id, "ACTIVE"), "Recurring profile activated.")}><PlayCircle size={15} /> Activate</button> : null}
              {item.status === "ACTIVE" ? <button className="btn-secondary" onClick={() => action(() => updateRecurringStatusRequest(item._id, "PAUSED"), "Recurring profile paused.")}><PauseCircle size={15} /> Pause</button> : null}
              {item.status === "PAUSED" ? <button className="btn-secondary" onClick={() => action(() => updateRecurringStatusRequest(item._id, "ACTIVE"), "Recurring profile resumed.")}><PlayCircle size={15} /> Resume</button> : null}
              {item.status === "ACTIVE" ? <button className="btn-primary" onClick={() => action(() => generateRecurringInvoiceRequest(item._id), "Recurring invoice generated.")}>Generate now</button> : null}
              {["DRAFT", "ACTIVE", "PAUSED"].includes(item.status) ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateRecurringStatusRequest(item._id, "CANCELLED"), "Recurring profile cancelled.")}>Cancel</button> : null}
            </div>
          </div>
        </div>
      ));
    }

    if (activeTab === "production") {
      return filtered.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">{item.title}</p>
              <p className="text-sm text-slate-500">{item.jobNumber} · Output {item.outputProductId?.name || "Product"} · Due {formatDate(item.dueDate)}</p>
            </div>
            <Badge>{item.status}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status === "PLANNED" ? <button className="btn-secondary" onClick={() => action(() => updateProductionJobStatusRequest(item._id, "IN_PROGRESS"), "Production job started.")}>Start</button> : null}
            {item.status === "IN_PROGRESS" ? <button className="btn-primary" onClick={() => action(() => updateProductionJobStatusRequest(item._id, "COMPLETED"), "Production job completed and stock updated.")}>Complete</button> : null}
            {["PLANNED", "IN_PROGRESS"].includes(item.status) ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateProductionJobStatusRequest(item._id, "CANCELLED"), "Production job cancelled.")}>Cancel</button> : null}
          </div>
        </div>
      ));
    }

    if (activeTab === "batches") {
      return filtered.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">{item.batchNumber}</p>
              <p className="text-sm text-slate-500">{item.productId?.name || "Product"} · Qty {item.quantityOnHand || 0} · Expiry {formatDate(item.expiryDate)}</p>
            </div>
            <Badge>{item.status}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status === "ACTIVE" ? <button className="btn-secondary" onClick={() => action(() => updateBatchStatusRequest(item._id, "QUARANTINED"), "Batch quarantined.")}>Quarantine</button> : null}
            {item.status === "QUARANTINED" ? <button className="btn-secondary" onClick={() => action(() => updateBatchStatusRequest(item._id, "ACTIVE"), "Batch restored.")}>Restore</button> : null}
            {["ACTIVE", "QUARANTINED"].includes(item.status) ? <button className="btn-secondary" onClick={() => action(() => updateBatchStatusRequest(item._id, "EXPIRED"), "Batch marked expired.")}>Expire</button> : null}
            {["ACTIVE", "QUARANTINED"].includes(item.status) ? <button className="btn-secondary" onClick={() => action(() => updateBatchStatusRequest(item._id, "CONSUMED"), "Batch marked consumed.")}>Consume</button> : null}
          </div>
        </div>
      ));
    }

    if (activeTab === "dispatches") {
      return filtered.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">{item.dispatchNumber}</p>
              <p className="text-sm text-slate-500">{item.customerId?.name || "Customer"} · {item.carrier || "Carrier pending"} · {item.trackingNumber || "No tracking"}</p>
            </div>
            <Badge>{item.status}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status === "DRAFT" ? <button className="btn-secondary" onClick={() => action(() => updateDispatchStatusRequest(item._id, "PACKED"), "Dispatch packed.")}>Pack</button> : null}
            {item.status === "PACKED" ? <button className="btn-secondary" onClick={() => action(() => updateDispatchStatusRequest(item._id, "DISPATCHED"), "Dispatch sent.")}>Dispatch</button> : null}
            {item.status === "DISPATCHED" ? <button className="btn-primary" onClick={() => action(() => updateDispatchStatusRequest(item._id, "DELIVERED"), "Dispatch delivered.")}>Deliver</button> : null}
            {["DRAFT", "PACKED", "DISPATCHED"].includes(item.status) ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateDispatchStatusRequest(item._id, "CANCELLED"), "Dispatch cancelled.")}>Cancel</button> : null}
          </div>
        </div>
      ));
    }

    if (activeTab === "approvals") {
      return filtered.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-950">{item.title}</p>
              <p className="text-sm text-slate-500">{item.documentType || "GENERAL"} · {item.sourceType || "GENERAL"} · {item.approvers?.length || 0} approver(s)</p>
            </div>
            <Badge>{item.status}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status === "DRAFT" ? <button className="btn-secondary" onClick={() => action(() => updateApprovalDocumentStatusRequest(item._id, "PENDING"), "Approval submitted.")}>Submit</button> : null}
            {item.status === "PENDING" ? <button className="btn-primary" onClick={() => action(() => updateApprovalDocumentStatusRequest(item._id, "APPROVED"), "Document approved.")}>Approve</button> : null}
            {item.status === "PENDING" ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateApprovalDocumentStatusRequest(item._id, "REJECTED"), "Document rejected.")}>Reject</button> : null}
            {["DRAFT", "PENDING"].includes(item.status) ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateApprovalDocumentStatusRequest(item._id, "CANCELLED"), "Approval cancelled.")}>Cancel</button> : null}
          </div>
        </div>
      ));
    }

    return filtered.map((item) => (
      <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-950">{item.title}</p>
            <p className="text-sm text-slate-500">{item.customerId?.name || "No customer"} · {formatDateTime(item.startAt)} – {formatDateTime(item.endAt)}</p>
          </div>
          <Badge>{item.status}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {item.status === "SCHEDULED" ? <button className="btn-secondary" onClick={() => action(() => updateAppointmentStatusRequest(item._id, "CONFIRMED"), "Appointment confirmed.")}>Confirm</button> : null}
          {["SCHEDULED", "CONFIRMED"].includes(item.status) ? <button className="btn-secondary" onClick={() => action(() => updateAppointmentStatusRequest(item._id, "COMPLETED"), "Appointment completed.")}>Complete</button> : null}
          {["SCHEDULED", "CONFIRMED"].includes(item.status) ? <button className="btn-secondary" onClick={() => action(() => updateAppointmentStatusRequest(item._id, "NO_SHOW"), "Appointment marked no-show.")}>No show</button> : null}
          {["SCHEDULED", "CONFIRMED"].includes(item.status) ? <button className="btn-secondary text-rose-600" onClick={() => action(() => updateAppointmentStatusRequest(item._id, "CANCELLED"), "Appointment cancelled.")}>Cancel</button> : null}
        </div>
      </div>
    ));
  };

  const needsLineItem = ["orders", "recurring"].includes(activeTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-600">Business workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{currentTab.label}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage recurring client billing and site visit activity for this workspace.
          </p>
        </div>
        <button type="button" onClick={loadData} className="btn-secondary"><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm no-scrollbar">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{success}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-brand-600" />
            <h2 className="text-lg font-bold text-slate-950">Create {currentTab.key === "recurring" ? "Monthly Billing" : currentTab.label}</h2>
          </div>
          <div className="mt-5 space-y-3">
            {["orders", "recurring", "appointments", "dispatches"].includes(activeTab) ? (
              <select className="input" value={form.customerId || ""} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Select customer</option>
                {customers.map((customer) => <option key={customer._id || customer.id} value={customer._id || customer.id}>{customer.name}</option>)}
              </select>
            ) : null}
            {["projects", "recurring", "batches", "approvals"].includes(activeTab) ? (
              <input className="input" placeholder={activeTab === "projects" ? "Project name" : activeTab === "recurring" ? "Profile name / description" : activeTab === "batches" ? "Batch number" : "Document title"} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            ) : null}
            {["tasks", "appointments", "production"].includes(activeTab) ? (
              <input className="input" placeholder={activeTab === "tasks" ? "Task title" : activeTab === "appointments" ? "Site visit title" : "Production job title"} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            ) : null}
            {needsLineItem || ["production", "batches", "dispatches"].includes(activeTab) ? (
              <>
                <select className="input" value={form.productId || ""} onChange={(e) => { const product = products.find((item) => String(item._id || item.id) === String(e.target.value)); setForm({ ...form, productId: e.target.value, rate: product?.sellingPrice ?? form.rate, taxRate: product?.taxRate ?? form.taxRate }); }}>
                  <option value="">{activeTab === "production" ? "Select output product" : "Select product/service"}</option>
                  {products.map((product) => <option key={product._id || product.id} value={product._id || product.id}>{product.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" type="number" min="1" placeholder="Qty" aria-label="Quantity" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                  <input className="input" type="number" min="0" placeholder={selectedProduct ? `Rate: ${money(selectedProduct.sellingPrice)}` : "Rate"} aria-label="Rate" value={form.rate || ""} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                </div>
              </>
            ) : null}
            {activeTab === "production" ? (
              <select className="input" value={form.inputProductId || ""} onChange={(e) => setForm({ ...form, inputProductId: e.target.value })}>
                <option value="">Optional input product</option>
                {products.map((product) => <option key={product._id || product.id} value={product._id || product.id}>{product.name}</option>)}
              </select>
            ) : null}
            {activeTab === "batches" ? (
              <div className="grid gap-3">
                <input className="input" type="date" value={form.manufactureDate || ""} onChange={(e) => setForm({ ...form, manufactureDate: e.target.value })} />
                <input className="input" type="date" value={form.expiryDate || ""} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
            ) : null}
            {activeTab === "dispatches" ? (
              <div className="grid gap-3">
                <input className="input" placeholder="Carrier" value={form.carrier || ""} onChange={(e) => setForm({ ...form, carrier: e.target.value })} />
                <input className="input" placeholder="Tracking number" value={form.trackingNumber || ""} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} />
              </div>
            ) : null}
            {activeTab === "tasks" ? (
              <select className="input" value={form.projectId || ""} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">Standalone task</option>
                {projects.map((project) => <option key={project._id || project.id} value={project._id || project.id}>{project.name}</option>)}
              </select>
            ) : null}
            {activeTab === "recurring" ? (
              <select className="input" value={form.frequency || "MONTHLY"} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                <option value="MONTHLY">Monthly</option>{!isRealEstateClient ? <option value="WEEKLY">Weekly</option> : null}{!isRealEstateClient ? <option value="QUARTERLY">Quarterly</option> : null}{!isRealEstateClient ? <option value="HALF_YEARLY">Half-yearly</option> : null}{!isRealEstateClient ? <option value="YEARLY">Yearly</option> : null}
              </select>
            ) : null}
            {activeTab === "appointments" ? (
              <div className="grid gap-3">
                <input className="input" type="datetime-local" value={form.startAt || ""} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required />
                <input className="input" type="datetime-local" value={form.endAt || ""} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required />
              </div>
            ) : null}
            {activeTab === "projects" || activeTab === "tasks" || activeTab === "production" ? (
              <input className="input" type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            ) : null}
            <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />} Save
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder={`Search ${currentTab.label.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <span className="text-sm font-medium text-slate-500">{filtered.length} records</span>
          </div>
          <div className="grid gap-4">{renderRows()}</div>
          {activeTab === "orders" ? <p className="text-xs text-slate-500">Order invoices are created through the existing BillStack invoice engine. Stock remains governed by invoice/inventory behavior.</p> : null}
          {activeTab === "recurring" ? <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-800"><p className="font-semibold">How Monthly Billing works</p><p>Active profiles generate normal BillStack invoices on the next billing date. Generate now creates the current invoice once; payments are still recorded from the invoice or customer payment flow.</p></div> : null}
          {activeTab === "appointments" ? <p className="text-xs text-slate-500">Site visit overlap checks are handled when assigning staff.</p> : null}
          <Link to="/dashboard" className="inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
};
export default WorkflowPage;