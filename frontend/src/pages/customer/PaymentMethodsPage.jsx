import PaymentMethods from "../../components/profile/PaymentMethods";

function PaymentMethodsPage() {
  return (
    <div className="account-detail-page">

      <div className="account-page-header">
       

        <h1 className="account-page-title">
          Payment Methods
        </h1>

        <p className="account-page-subtitle">
          Manage your saved cards, UPI and other payment methods.
        </p>
      </div>

      <PaymentMethods />

    </div>
  );
}

export default PaymentMethodsPage;