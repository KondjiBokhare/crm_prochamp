import { CheckCircle2, PackageCheck } from "lucide-react";
import { formatINR } from "../../utils/pricing";

function OrderSuccess({ order }) {
  const orderId = order?.id || "—";
  const itemCount = (order?.items || []).reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  return (
    <section className="order-success">
      <div className="order-success-icon"><CheckCircle2 size={48} /></div>
      <span className="order-success-label">{order?.serverBacked ? "ORDER REQUEST SAVED" : "DEMO ORDER CONFIRMED"}</span>
      <h1>{order?.serverBacked ? "Your order request is saved" : "Thank you for trying the demo checkout!"}</h1>
      <p>{order?.serverBacked ? "Your order record contains " : "Your demo order contains "}{itemCount} item{itemCount === 1 ? "" : "s"} with a total payable of <strong>{formatINR(order?.total)}</strong>. No real payment was processed and no courier shipment was created.</p>
      <div className="order-id-box"><span>Order ID</span><strong>{orderId}</strong></div>
      <div className="order-success-note"><PackageCheck size={18} /><span>{order?.serverBacked ? "Your order and product snapshot are saved in Django." : "Your confirmation lists the products and total saved from this demo checkout."}</span></div>
    </section>
  );
}

export default OrderSuccess;
