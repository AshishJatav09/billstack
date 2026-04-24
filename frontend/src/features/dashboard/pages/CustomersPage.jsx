import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui/PageState";
import { uiStore } from "../../../store/uiStore";
import {
  createCustomerRequest,
  deleteCustomerRequest,
  listCustomersRequest,
  updateCustomerRequest,
} from "../../auth/api";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  billingAddress: "",
  shippingAddress: "",
  gstNumber: "",
  notes: "",
};

const CustomersPage = () => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    gstStatus: "",
  });
  const [result, setResult] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCustomers = async () => {
    setIsLoading(true);

    try {
      const data = await listCustomersRequest(filters);
      setResult(data);
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to load customers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [filters.page, filters.limit, filters.search, filters.sortBy, filters.sortOrder, filters.gstStatus]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, page: 1, [name]: value }));
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleEdit = (customer) => {
    setEditingId(customer._id);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      billingAddress: customer.billingAddress || "",
      shippingAddress: customer.shippingAddress || "",
      gstNumber: customer.gstNumber || "",
      notes: customer.notes || "",
    });
  };

  const resetForm = () => {
    setEditingId("");
    setForm(initialForm);
    setErrors({});
    setServerError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    setServerError("");

    try {
      if (editingId) {
        await updateCustomerRequest(editingId, form);
      } else {
        await createCustomerRequest(form);
      }

      uiStore.getState().pushToast({
        tone: "success",
        message: editingId ? "Customer updated successfully." : "Customer created successfully.",
      });
      resetForm();
      await loadCustomers();
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setServerError(error.response?.data?.message || "Unable to save customer");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (customerId) => {
    try {
      await deleteCustomerRequest(customerId);
      uiStore.getState().pushToast({
        tone: "success",
        message: "Customer deleted successfully.",
      });
      await loadCustomers();
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to delete customer");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-300">Customers</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Customer management</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search name, email, phone" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
            <select name="gstStatus" value={filters.gstStatus} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="">All GST</option>
              <option value="with-gst">With GST</option>
              <option value="without-gst">Without GST</option>
            </select>
            <select name="sortBy" value={filters.sortBy} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="createdAt">Created</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
            <select name="sortOrder" value={filters.sortOrder} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-semibold text-white">{editingId ? "Edit customer" : "Add customer"}</h3>
          <div className="mt-5 grid gap-4">
            {[
              ["name", "Name"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["billingAddress", "Billing address"],
              ["shippingAddress", "Shipping address"],
              ["gstNumber", "GST number"],
            ].map(([name, label]) => (
              <label key={name} className="block">
                <span className="mb-2 block text-sm text-slate-300">{label}</span>
                <input
                  name={name}
                  value={form[name]}
                  onChange={handleFormChange}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                />
                {errors[name] ? <span className="mt-2 block text-xs text-rose-400">{errors[name]}</span> : null}
              </label>
            ))}
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Notes</span>
              <textarea
                name="notes"
                rows="4"
                value={form.notes}
                onChange={handleFormChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
              />
            </label>
          </div>
          {serverError ? <p className="mt-4 text-sm text-rose-400">{serverError}</p> : null}
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white">
              {isSaving ? "Saving..." : editingId ? "Update customer" : "Create customer"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-200">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Customer list</h3>
            <p className="text-sm text-slate-400">{result.pagination.total} total</p>
          </div>
          {isLoading ? (
            <LoadingState title="Loading customers" description="Fetching customer records for this business." />
          ) : serverError && !result.items.length ? (
            <ErrorState title="Unable to load customers" description={serverError} />
          ) : (
            <div className="space-y-3">
              {result.items.map((customer) => (
                <div key={customer._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-white">{customer.name}</p>
                      <div className="mt-2 grid gap-1 text-sm text-slate-300">
                        <p>{customer.email || "No email"}</p>
                        <p>{customer.phone || "No phone"}</p>
                        <p>{customer.gstNumber || "No GST number"}</p>
                        <p>Invoices: {customer.invoiceHistory?.length || 0}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(customer)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(customer._id)} className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm text-rose-300">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!result.items.length ? (
                <EmptyState
                  title="No customers found"
                  description="Try a different filter or create your first customer."
                />
              ) : null}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
            >
              Previous
            </button>
            <p className="text-sm text-slate-400">
              Page {result.pagination.page} of {result.pagination.totalPages}
            </p>
            <button
              type="button"
              disabled={result.pagination.page >= result.pagination.totalPages}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CustomersPage;
