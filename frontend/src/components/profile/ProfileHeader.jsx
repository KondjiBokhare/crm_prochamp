import { useCallback, useEffect, useRef, useState } from "react";
import { Package, Heart, Star, Crown, Camera } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isStorefrontAccountApiEnabled } from "../../services/storefrontAccountApiService";

function ProfileHeader() {
  const { user, authenticatedRequest, authenticatedBlobRequest } = useAuth();
  const displayName = user?.name || "Customer";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const inputRef = useRef(null);
  const canManagePhoto = user?.role === "CUSTOMER" && isStorefrontAccountApiEnabled;

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (canManagePhoto && typeof authenticatedBlobRequest === "function") {
      authenticatedBlobRequest("/api/storefront/account/profile-image/")
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setPhotoUrl(objectUrl);
        })
        .catch((error) => {
          if (active && error?.status !== 404) setPhotoMessage(error.message || "Could not load profile photo.");
          if (active) setPhotoUrl("");
        });
    } else {
      setPhotoUrl("");
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [authenticatedBlobRequest, canManagePhoto, user?.id, photoVersion]);

  const choosePhoto = useCallback(() => {
    setPhotoMessage("");
    inputRef.current?.click();
  }, []);

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setPhotoMessage("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoMessage("Profile image must be 2 MB or smaller.");
      return;
    }
    setUploading(true);
    setPhotoMessage("");
    try {
      const form = new FormData();
      form.append("profile_image", file);
      await authenticatedRequest("/api/storefront/account/profile-image/", { method: "PUT", body: form });
      setPhotoVersion((version) => version + 1);
      setPhotoMessage("Profile photo updated.");
    } catch (error) {
      setPhotoMessage(error.message || "Could not upload profile photo.");
    } finally {
      setUploading(false);
    }
  }

  const stats = [
    { label: "Total Orders", value: "—", icon: Package, className: "blue" },
    { label: "Wishlist Items", value: "—", icon: Heart, className: "red" },
    { label: "Avg. Rating", value: "—", icon: Star, className: "orange" },
    { label: "Member Tier", value: "—", icon: Crown, className: "purple" },
  ];

  return (
    <section className="profile-header-card">
      <div className="profile-user-info">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar profile-avatar-photo">
            {photoUrl ? <img src={photoUrl} alt={`${displayName}'s profile`} /> : initials}
          </div>
          {canManagePhoto && <>
            <button className="change-photo-button" type="button" aria-label="Change profile photo" onClick={choosePhoto} disabled={uploading} title={uploading ? "Uploading photo…" : "Change profile photo"}>
              <Camera size={14} />
            </button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} hidden />
          </>}
        </div>
        <div>
          <h1>{displayName}</h1>
          <p>{user?.email || "Sign in to see your account"}</p>
          {user?.authProvider === "django" && <span className="verified-badge">✓ Account connected</span>}
          <div className="member-since">
            {user?.dateJoined ? `Member since ${new Date(user.dateJoined).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` : "Your TechGear account"}
          </div>
          {photoMessage && <p className="profile-photo-message" role="status">{photoMessage}</p>}
        </div>
      </div>
      <div className="profile-stats">
        {stats.map(({ label, value, icon: Icon, className }) => (
          <div className="profile-stat" key={label}>
            <div className={`profile-stat-icon ${className}`}><Icon size={19} /></div>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ProfileHeader;
