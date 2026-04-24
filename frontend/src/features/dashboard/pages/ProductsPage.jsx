import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui/PageState";
import {
  createProductMovementRequest,
  createProductRequest,
  deleteProductRequest,
  listProductMovementsRequest,
  listProductsRequest,
  updateProductRequest,
} from "../../auth/api";
import { authStore } from "../../../store/authStore";
import { uiStore } from "../../../store/uiStore";

const initialForm = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  unitType: "unit",
  purchasePrice: 0,
  sellingPrice: 0,
  taxRate: 0,
  discount: 0,
  openingStock: 0,
  minimumStockLevel: 0,
  trackInventory: true,
  status: "active",
};

const initialMovementForm = {
  type: "IN",
  quantity: 1,
  reason: "",
  referenceType: "MANUAL",
  referenceId: "",
};

const ProductsPage = () => {
  const { business } = authStore();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    status: "",
    category: "",
    trackInventory: "",
    lowStock: "false",
    outOfStock: "false",
  });
  const [result, setResult] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [movementForm, setMovementForm] = useState(initialMovementForm);
  const [movementErrors, setMovementErrors] = useState({});
  const [movementHistory, setMovementHistory] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementSaving, setMovementSaving] = useState(false);

  const loadProducts = async () => {
    setIsLoading(true);

    try {
      const data = await listProductsRequest(filters);
      setResult(data);
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to load products");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [
    filters.page,
    filters.limit,
    filters.search,
    filters.sortBy,
    filters.sortOrder,
    filters.status,
    filters.category,
    filters.trackInventory,
    filters.lowStock,
    filters.outOfStock,
  ]);

  const openMovementPanel = async (product) => {
    setSelectedProduct(product);
    setMovementHistory([]);
    setMovementErrors({});
    setMovementLoading(true);

    try {
      const data = await listProductMovementsRequest(product._id, { limit: 20, page: 1 });
      setMovementHistory(data.items);
    } catch (error) {
      setMovementErrors({
        general: error.response?.data?.message || "Unable to load stock history",
      });
    } finally {
      setMovementLoading(false);
    }
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, page: 1, [name]: value }));
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleMovementChange = (event) => {
    const { name, value } = event.target;
    setMovementForm((current) => ({ ...current, [name]: value }));
  };

  const handleEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      category: product.category || "",
      unitType: product.unitType || "unit",
      purchasePrice: product.purchasePrice ?? 0,
      sellingPrice: product.sellingPrice ?? 0,
      taxRate: product.taxRate ?? 0,
      discount: product.discount ?? 0,
      openingStock: product.openingStock ?? product.currentStock ?? 0,
      minimumStockLevel: product.minimumStockLevel ?? 0,
      trackInventory: product.trackInventory ?? true,
      status: product.status || "active",
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
        await updateProductRequest(editingId, form);
      } else {
        await createProductRequest(form);
      }

      uiStore.getState().pushToast({
        tone: "success",
        message: editingId ? "Product updated successfully." : "Product created successfully.",
      });
      resetForm();
      await loadProducts();
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setServerError(error.response?.data?.message || "Unable to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (productId) => {
    try {
      await deleteProductRequest(productId);
      uiStore.getState().pushToast({
        tone: "success",
        message: "Product deleted successfully.",
      });
      await loadProducts();
      if (selectedProduct?._id === productId) {
        setSelectedProduct(null);
      }
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to delete product");
    }
  };

  const handleMovementSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProduct) {
      return;
    }

    setMovementSaving(true);
    setMovementErrors({});

    try {
      const data = await createProductMovementRequest(selectedProduct._id, movementForm);
      setSelectedProduct(data.product);
      setMovementHistory((current) => [data.movement, ...current]);
      setMovementForm(initialMovementForm);
      uiStore.getState().pushToast({
        tone: "success",
        message: "Stock movement recorded successfully.",
      });
      await loadProducts();
    } catch (error) {
      setMovementErrors(error.response?.data?.errors || {});
      if (error.response?.data?.message) {
        setMovementErrors((current) => ({
          ...current,
          general: error.response.data.message,
        }));
      }
    } finally {
      setMovementSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-300">Inventory</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Inventory and stock movements</h2>
            <p className="mt-2 text-sm text-slate-400">
              Negative stock is {business?.inventorySettings?.allowNegativeStock ? "enabled" : "blocked"} for this business.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search name, SKU, barcode" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
            <input name="category" value={filters.category} onChange={handleFilterChange} placeholder="Category" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
            <select name="status" value={filters.status} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select name="trackInventory" value={filters.trackInventory} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="">All inventory modes</option>
              <option value="true">Tracked</option>
              <option value="false">Untracked</option>
            </select>
            <select name="lowStock" value={filters.lowStock} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="false">All stock</option>
              <option value="true">Low stock only</option>
            </select>
            <select name="outOfStock" value={filters.outOfStock} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="false">All availability</option>
              <option value="true">Out of stock only</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-semibold text-white">{editingId ? "Edit product" : "Add product"}</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              ["name", "Name"],
              ["sku", "SKU"],
              ["barcode", "Barcode"],
              ["category", "Category"],
              ["unitType", "Unit type"],
              ["purchasePrice", "Purchase price"],
              ["sellingPrice", "Selling price"],
              ["taxRate", "Tax rate"],
              ["discount", "Discount"],
              ["openingStock", "Opening stock"],
              ["minimumStockLevel", "Minimum stock level"],
            ].map(([name, label]) => (
              <label key={name} className="block">
                <span className="mb-2 block text-sm text-slate-300">{label}</span>
                <input
                  name={name}
                  value={form[name]}
                  onChange={handleFormChange}
                  disabled={editingId && name === "openingStock"}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                />
                {editingId && name === "openingStock" ? (
                  <span className="mt-2 block text-xs text-slate-500">
                    Opening stock is set during creation. Use stock movements to change stock later.
                  </span>
                ) : null}
                {errors[name] ? <span className="mt-2 block text-xs text-rose-400">{errors[name]}</span> : null}
              </label>
            ))}
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Status</span>
              <select name="status" value={form.status} onChange={handleFormChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200">
              <input type="checkbox" name="trackInventory" checked={form.trackInventory} onChange={handleFormChange} />
              Track inventory
            </label>
          </div>
          {serverError ? <p className="mt-4 text-sm text-rose-400">{serverError}</p> : null}
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white">
              {isSaving ? "Saving..." : editingId ? "Update product" : "Create product"}
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
            <h3 className="text-xl font-semibold text-white">Inventory list</h3>
            <p className="text-sm text-slate-400">{result.pagination.total} total</p>
          </div>
          {isLoading ? (
            <LoadingState title="Loading products" description="Fetching your inventory and stock alerts." />
          ) : serverError && !result.items.length ? (
            <ErrorState title="Unable to load products" description={serverError} />
          ) : (
            <div className="space-y-3">
              {result.items.map((product) => (
                <div key={product._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-white">{product.name}</p>
                        {product.isOutOfStock ? (
                          <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs text-rose-300">Out of stock</span>
                        ) : null}
                        {!product.isOutOfStock && product.isLowStock ? (
                          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-300">Low stock</span>
                        ) : null}
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-300">
                        <p>SKU: {product.sku || "N/A"}</p>
                        <p>Category: {product.category || "Uncategorized"}</p>
                        <p>Current stock: {product.currentStock}</p>
                        <p>Minimum stock: {product.minimumStockLevel}</p>
                        <p>Status: {product.status}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openMovementPanel(product)} className="rounded-xl border border-brand-500/50 px-4 py-2 text-sm text-brand-200">
                        Movements
                      </button>
                      <button onClick={() => handleEdit(product)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(product._id)} className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm text-rose-300">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!result.items.length ? (
                <EmptyState
                  title="No products found"
                  description="Create a product or adjust your filters to see inventory items."
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

      {selectedProduct ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Stock movements for {selectedProduct.name}</h3>
              <p className="mt-2 text-sm text-slate-400">
                Current stock: {selectedProduct.currentStock}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200"
            >
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={handleMovementSubmit} className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <h4 className="text-lg font-semibold text-white">Add movement</h4>
              <div className="mt-4 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Type</span>
                  <select name="type" value={movementForm.type} onChange={handleMovementChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
                    <option value="IN">Stock in</option>
                    <option value="OUT">Stock out</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="RETURN">Returned stock</option>
                    <option value="DAMAGED">Damaged or lost</option>
                  </select>
                  {movementErrors.type ? <span className="mt-2 block text-xs text-rose-400">{movementErrors.type}</span> : null}
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    {movementForm.type === "ADJUSTMENT" ? "New stock level" : "Quantity"}
                  </span>
                  <input name="quantity" value={movementForm.quantity} onChange={handleMovementChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                  {movementErrors.quantity ? <span className="mt-2 block text-xs text-rose-400">{movementErrors.quantity}</span> : null}
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Reference type</span>
                  <select name="referenceType" value={movementForm.referenceType} onChange={handleMovementChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
                    <option value="MANUAL">Manual</option>
                    <option value="PURCHASE">Purchase</option>
                    <option value="INVOICE">Invoice</option>
                    <option value="RETURN">Return</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Reference ID</span>
                  <input name="referenceId" value={movementForm.referenceId} onChange={handleMovementChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Reason</span>
                  <textarea name="reason" rows="3" value={movementForm.reason} onChange={handleMovementChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                </label>
                {movementErrors.general ? <p className="text-sm text-rose-400">{movementErrors.general}</p> : null}
                <button type="submit" disabled={movementSaving} className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white">
                  {movementSaving ? "Recording..." : "Record movement"}
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <h4 className="text-lg font-semibold text-white">Movement history</h4>
              {movementLoading ? (
                <LoadingState title="Loading stock history" description="Gathering recent stock movements." />
              ) : (
                <div className="mt-4 space-y-3">
                  {movementHistory.map((movement) => (
                    <div key={movement._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-500/20 px-3 py-1 text-xs text-brand-200">{movement.type}</span>
                        <span className="text-sm text-slate-300">{movement.quantity}</span>
                        <span className="text-sm text-slate-400">
                          {movement.previousStock} to {movement.newStock}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-300">
                        <p>Reference: {movement.referenceType || "MANUAL"} {movement.referenceId ? `(${movement.referenceId})` : ""}</p>
                        <p>Reason: {movement.reason || "No reason provided"}</p>
                        <p>At: {new Date(movement.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {!movementHistory.length ? (
                    <EmptyState
                      title="No movement history yet"
                      description="Manual, purchase, invoice, and return movements will appear here."
                    />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default ProductsPage;
