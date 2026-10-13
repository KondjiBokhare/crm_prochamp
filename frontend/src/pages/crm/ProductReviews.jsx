import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getCrmProductReviews, setCrmProductReviewStatus } from "../../services/storefrontCommerceApiService";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

function ProductReviews() {
  const { authenticatedRequest } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCrmProductReviews(authenticatedRequest, { status, search });
      setReviews(result);
    } catch (requestError) {
      setError(requestError?.message || "Could not load product reviews.");
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, status, search, reloadToken]);

  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, search ? 250 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh, search]);

  const moderate = async (review, nextStatus) => {
    setUpdatingId(review.id);
    setError("");
    setNotice("");
    try {
      await setCrmProductReviewStatus(authenticatedRequest, review.id, nextStatus);
      setNotice(`Review ${review.id} marked ${nextStatus.toLowerCase()}.`);
      if (status === "PENDING") setReviews((current) => current.filter((item) => item.id !== review.id));
      else setReviews((current) => current.map((item) => item.id === review.id ? { ...item, status: nextStatus } : item));
    } catch (requestError) {
      setError(requestError?.message || "Could not update review status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="crm-page">
      <PageHeader title="Product Reviews" description="Review customer-submitted ratings before publishing them to the storefront." action={<button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw size={13} /> Refresh</button>} />
      {notice && <div className="crm-notice crm-notice-success">{notice}</div>}
      {error && <div className="crm-notice crm-notice-error"><ShieldAlert size={15} /> {error}</div>}
      <SectionCard title="Review queue" subtitle="Only approved reviews are visible on product pages. Public submissions are not marked as verified purchases.">
        <div className="crm-toolbar">
          <label className="crm-search-field"><Search size={15} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, reviewer or text…" /></label>
          <label className="crm-filter-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All reviews</option></select></label>
          <span className="crm-result-count">{reviews.length} review{reviews.length === 1 ? "" : "s"}</span>
        </div>
        {loading ? <div className="crm-loading">Loading reviews…</div> : reviews.length === 0 ? <EmptyState title="No reviews in this queue" message="Try a different status or check again after a customer submits a review." /> : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Product</th><th>Reviewer</th><th>Rating</th><th>Review</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>{reviews.map((review) => (
                <tr key={review.id}>
                  <td><strong>{review.product_name}</strong><small>Product ID: {review.product_id}</small></td>
                  <td>{review.reviewerName}</td>
                  <td>{review.rating}/5</td>
                  <td><strong>{review.title}</strong><small className="crm-review-comment">{review.comment}</small>{review.verifiedPurchase && <small>Verified purchase</small>}</td>
                  <td><StatusBadge status={review.status} /></td>
                  <td>{dateLabel(review.createdAt)}</td>
                  <td><div className="crm-product-actions">{review.status !== "APPROVED" && <button type="button" className="crm-button crm-button-primary crm-button-small" disabled={updatingId === review.id} onClick={() => moderate(review, "APPROVED")}><Check size={12} /> Approve</button>}{review.status !== "REJECTED" && <button type="button" className="crm-button crm-button-secondary crm-button-small" disabled={updatingId === review.id} onClick={() => moderate(review, "REJECTED")}><X size={12} /> Reject</button>}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default ProductReviews;
