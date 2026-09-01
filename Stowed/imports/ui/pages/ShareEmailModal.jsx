import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { currency, sortByCategory } from "./shoppingListHelpers";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export function ShareEmailModal({ list, onClose }) {
  const [recipients, setRecipients] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    callMethod("shoppingLists.listRecipients")
      .then((result) => setRecipients(result))
      .catch((error) => setLoadError(error.reason || error.message || "Failed to load recipients."))
      .finally(() => setIsLoading(false));
  }, []);

  function toggleRecipient(email) {
    setSelectedEmails((current) =>
      current.includes(email) ? current.filter((e) => e !== email) : [...current, email],
    );
  }

  async function handleSend() {
    if (selectedEmails.length === 0) {
      setSendError("Select at least one recipient.");
      return;
    }
    setIsSending(true);
    setSendError("");
    try {
      await callMethod("shoppingLists.shareByEmail", {
        listId: list._id,
        recipientEmails: selectedEmails,
      });
      setSent(true);
    } catch (error) {
      setSendError(error.reason || error.message || "Failed to send email.");
    }
    setIsSending(false);
  }

  const items = sortByCategory(list.items || []);
  const total = items.reduce((sum, item) => sum + item.quantityWanted * item.unitCost, 0);

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-email-modal-title"
      >
        <h2 id="share-email-modal-title" className="modal-title">
          Share &quot;{list.name}&quot; via email
        </h2>

        {sent ? (
          <div>
            <p>Sent to {selectedEmails.length} recipient(s).</p>
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="detail-section">
              <div className="section-title">Recipients</div>
              <div className="section-content">
                {isLoading && <p>Loading recipients...</p>}
                {loadError && <p className="warning-text">{loadError}</p>}
                {!isLoading && !loadError && recipients.length === 0 && (
                  <p className="section-empty">No other organisation members found.</p>
                )}
                {recipients.map((member) => (
                  <label key={member._id} style={{ display: "block", marginBottom: "4px" }}>
                    <input
                      type="checkbox"
                      checked={selectedEmails.includes(member.email)}
                      onChange={() => toggleRecipient(member.email)}
                    />{" "}
                    {member.username} ({member.email})
                  </label>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <div className="section-title">Preview</div>
              <div className="section-content">
                <table className="lists-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th>Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.productId}>
                        <td>{item.productName}</td>
                        <td>{item.category || "Uncategorized"}</td>
                        <td>{item.quantityWanted}</td>
                        <td>{currency(item.unitCost)}</td>
                        <td>{currency(item.quantityWanted * item.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ textAlign: "right", fontWeight: "bold" }}>Total: {currency(total)}</p>
              </div>
            </div>

            {sendError && <p className="warning-text">{sendError}</p>}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSend}
                disabled={isSending || selectedEmails.length === 0}
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
