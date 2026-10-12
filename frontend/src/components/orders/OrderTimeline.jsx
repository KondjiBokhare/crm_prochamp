import { Check, Truck } from "lucide-react";

const steps = [
  "Order Placed",
  "Processed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

function OrderTimeline({ currentStep = 5 }) {
  return (
    <div className="order-timeline">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const completed = stepNumber <= currentStep;
        const active = stepNumber === currentStep;

        return (
          <div className="timeline-step" key={step}>
            <div
              className={`timeline-circle ${
                completed ? "completed" : ""
              } ${active ? "active" : ""}`}
            >
              {completed ? (
                stepNumber === 3 ? (
                  <Truck size={14} />
                ) : (
                  <Check size={14} />
                )
              ) : (
                stepNumber
              )}
            </div>

            <strong>{step}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default OrderTimeline;