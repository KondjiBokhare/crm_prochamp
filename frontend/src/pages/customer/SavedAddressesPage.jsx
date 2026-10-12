import SavedAddresses from "../../components/profile/SavedAddresses";

function SavedAddressesPage() {
  return (
    <div className="account-detail-page">

      <div className="account-page-header">
         

        <h1 className="account-page-title">
          Saved Addresses
        </h1>

        <p className="account-page-subtitle">
          Manage your saved delivery and work addresses.
        </p>
      </div>

      <SavedAddresses />

    </div>
  );
}

export default SavedAddressesPage;