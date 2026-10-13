import ProfileHeader from "../../components/profile/ProfileHeader";
import PersonalInfo from "../../components/profile/PersonalInfo";
import SavedAddresses from "../../components/profile/SavedAddresses";
import PaymentMethods from "../../components/profile/PaymentMethods";
import AccountSettings from "../../components/profile/AccountSettings";
import ReferralBanner from "../../components/profile/ReferralBanner";

function MyProfile() {
  return (
    <div className="profile-page">

      <main className="profile-main">

        <ProfileHeader />

        <div className="profile-columns">

          <div className="profile-left-column">
            <PersonalInfo />
            <PaymentMethods />
            <ReferralBanner />
          </div>

          <div className="profile-right-column">
            <SavedAddresses />
            <AccountSettings />
          </div>

        </div>

      </main>

    </div>
  );
}

export default MyProfile;