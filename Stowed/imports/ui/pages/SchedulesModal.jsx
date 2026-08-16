import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  SCHEDULE_FREQUENCIES,
  SCHEDULE_FREQUENCY_LABELS,
  GENERATION_MODES,
} from "/imports/api/schedules/constants";
import { Schedules } from "/imports/api/schedules/collections";
import { BUDGET_STRATEGIES, BUDGET_STRATEGY_LABELS } from "/imports/api/shoppingLists/constants";
import { toCents } from "./shoppingListHelpers";

import "./SchedulesModal.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

const emptyForm = {
  name: "",
  frequency: SCHEDULE_FREQUENCIES.WEEKLY,
  generationMode: GENERATION_MODES.AUTO,
  items: [],
  autoStrategy: BUDGET_STRATEGIES.MAX_PRODUCTS,
  autoBudgetInput: "",
  siteId: "",
};

export function SchedulesModal({ onClose, sites, products }) {
  const [view, setView] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [itemProductId, setItemProductId] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { schedules } = useTracker(() => {
    const sub = Meteor.subscribe("schedules");
    return {
      schedules: Schedules.find({}, { sort: { createdAt: -1 } }).fetch(),
      ready: sub.ready(),
    };
  }, []);

  function openCreateForm() {
    setForm(emptyForm);
    setItemProductId(products[0]?._id ?? "");
    setEditingId(null);
    setFormError("");
    setView("form");
  }

  function openEditForm(schedule) {
    setForm({
      name: schedule.name,
      frequency: schedule.frequency,
      generationMode: schedule.generationMode,
      items: schedule.items ?? [],
      autoStrategy: schedule.autoConfig?.strategy ?? BUDGET_STRATEGIES.MAX_PRODUCTS,
      autoBudgetInput:
        schedule.autoConfig?.budgetCents != null
          ? String(schedule.autoConfig.budgetCents / 100)
          : "",
      siteId: schedule.siteId ?? "",
    });
    setItemProductId(products[0]?._id ?? "");
    setEditingId(schedule._id);
    setFormError("");
    setView("form");
  }

  function addItem() {
    if (!itemProductId) return;
    const quantityWanted = Math.max(1, Number(itemQuantity) || 1);
    const existing = form.items.find((i) => i.productId === itemProductId);
    const nextItems = existing
      ? form.items.map((i) =>
          i.productId === itemProductId
            ? { ...i, quantityWanted: i.quantityWanted + quantityWanted }
            : i,
        )
      : [...form.items, { productId: itemProductId, quantityWanted }];
    setForm({ ...form, items: nextItems });
    setItemQuantity(1);
  }

  function removeItem(productId) {
    setForm({ ...form, items: form.items.filter((i) => i.productId !== productId) });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError("Schedule name cannot be empty.");
      return;
    }

    if (form.generationMode === GENERATION_MODES.EXPLICIT && form.items.length === 0) {
      setFormError("Add at least one product, or switch to auto-generate.");
      return;
    }

    const trimmedBudget = form.autoBudgetInput.trim();
    const budgetCents = trimmedBudget === "" ? undefined : toCents(Number(trimmedBudget));

    const payload = {
      name: trimmedName,
      frequency: form.frequency,
      generationMode: form.generationMode,
      ...(form.generationMode === GENERATION_MODES.EXPLICIT ? { items: form.items } : {}),
      ...(form.generationMode === GENERATION_MODES.AUTO
        ? { autoConfig: { strategy: form.autoStrategy, budgetCents } }
        : {}),
      ...(form.siteId ? { siteId: form.siteId } : {}),
    };

    setIsSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await callMethod("schedules.update", { scheduleId: editingId, ...payload });
      } else {
        await callMethod("schedules.create", payload);
      }
      setView("list");
    } catch (error) {
      console.error("Failed to save schedule:", error);
      setFormError(error.reason || error.message || "Failed to save schedule.");
    }
    setIsSaving(false);
  }

  function togglePause(schedule) {
    callMethod("schedules.setActive", {
      scheduleId: schedule._id,
      isActive: !schedule.isActive,
    }).catch((error) => console.error("Failed to update schedule:", error));
  }

  function handleDelete(scheduleId) {
    callMethod("schedules.delete", { scheduleId }).catch((error) =>
      console.error("Failed to delete schedule:", error),
    );
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal schedules-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedules-modal-title"
      >
        <h2 id="schedules-modal-title" className="modal-title">
          Schedules
        </h2>

        {view === "list" && (
          <div>
            <div className="detail-section schedules-card">
              <div className="section-title">
                <span>All schedules</span>
                <span className="section-badge id">{schedules.length}</span>
              </div>

              <div className="section-content">
                <button
                  type="button"
                  className="btn-primary schedules-new-btn"
                  onClick={openCreateForm}
                >
                  + New schedule
                </button>

                {schedules.length === 0 ? (
                  <p className="section-empty">
                    No schedules yet. Create one to automate restocking.
                  </p>
                ) : (
                  <>
                    <div className="schedules-overview-header">
                      <span>Name</span>
                      <span>Frequency</span>
                      <span>Status</span>
                      <span>Actions</span>
                    </div>

                    {schedules.map((schedule) => (
                      <div key={schedule._id} className="schedules-overview-row">
                        <span className="schedules-name">{schedule.name}</span>
                        <span>
                          <span className="schedules-frequency-tag">
                            {SCHEDULE_FREQUENCY_LABELS[schedule.frequency]}
                          </span>
                        </span>
                        <span
                          className={schedule.isActive ? "section-badge id" : "section-badge op"}
                        >
                          {schedule.isActive ? "Active" : "Paused"}
                        </span>
                        <div className="schedules-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openEditForm(schedule)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => togglePause(schedule)}
                          >
                            {schedule.isActive ? "Pause" : "Resume"}
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => handleDelete(schedule._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}

        {view === "form" && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="schedule-name">Name</label>
              <input
                id="schedule-name"
                type="text"
                className="form-input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="schedule-frequency">Frequency</label>
              <select
                id="schedule-frequency"
                className="form-input selected"
                value={form.frequency}
                onChange={(event) => setForm({ ...form, frequency: event.target.value })}
              >
                {Object.values(SCHEDULE_FREQUENCIES).map((value) => (
                  <option key={value} value={value}>
                    {SCHEDULE_FREQUENCY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="schedule-site">Site (optional)</label>
              <select
                id="schedule-site"
                className="form-input selected"
                value={form.siteId}
                onChange={(event) => setForm({ ...form, siteId: event.target.value })}
              >
                <option value="">Unassigned</option>
                {sites.map((site) => (
                  <option key={site._id} value={site._id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="schedules-radio-group">
              <label>
                <input
                  type="radio"
                  checked={form.generationMode === GENERATION_MODES.AUTO}
                  onChange={() => setForm({ ...form, generationMode: GENERATION_MODES.AUTO })}
                />
                Auto-generate from low stock
              </label>
              <label>
                <input
                  type="radio"
                  checked={form.generationMode === GENERATION_MODES.EXPLICIT}
                  onChange={() => setForm({ ...form, generationMode: GENERATION_MODES.EXPLICIT })}
                />
                Pick products manually
              </label>
            </div>

            {form.generationMode === GENERATION_MODES.AUTO && (
              <div className="lists-budget-row">
                <div className="form-group lists-budget-amount">
                  <label htmlFor="schedule-budget">Budget (optional)</label>
                  <input
                    id="schedule-budget"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    placeholder="No limit"
                    value={form.autoBudgetInput}
                    onChange={(event) => setForm({ ...form, autoBudgetInput: event.target.value })}
                  />
                </div>
                <div className="form-group lists-budget-strategy">
                  <label htmlFor="schedule-strategy">Allocation strategy</label>
                  <select
                    id="schedule-strategy"
                    className="form-input selected"
                    value={form.autoStrategy}
                    onChange={(event) => setForm({ ...form, autoStrategy: event.target.value })}
                  >
                    {Object.values(BUDGET_STRATEGIES).map((value) => (
                      <option key={value} value={value}>
                        {BUDGET_STRATEGY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {form.generationMode === GENERATION_MODES.EXPLICIT && (
              <div>
                <div className="lists-add-row">
                  <div className="form-group lists-add-product">
                    <label htmlFor="schedule-item-product">Product</label>
                    <select
                      id="schedule-item-product"
                      className="form-input selected"
                      value={itemProductId}
                      onChange={(event) => setItemProductId(event.target.value)}
                    >
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group lists-add-qty">
                    <label htmlFor="schedule-item-qty">Qty</label>
                    <input
                      id="schedule-item-qty"
                      type="number"
                      min="1"
                      className="form-input"
                      value={itemQuantity}
                      onChange={(event) => setItemQuantity(event.target.value)}
                    />
                  </div>
                  <button type="button" className="btn-secondary lists-add-btn" onClick={addItem}>
                    Add to schedule
                  </button>
                </div>

                <div className="schedules-items-section">
                  {form.items.map((item) => {
                    const product = products.find((p) => p._id === item.productId);
                    return (
                      <div key={item.productId} className="schedules-item-row">
                        <span className="schedules-item-name">
                          {product ? product.name : item.productId}
                        </span>
                        <span className="schedules-item-qty">{item.quantityWanted}</span>
                        <button
                          type="button"
                          className="lists-remove-btn"
                          onClick={() => removeItem(item.productId)}
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {formError && <p className="warning-text">{formError}</p>}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setView("list")}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {editingId ? "Save changes" : "Create schedule"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
