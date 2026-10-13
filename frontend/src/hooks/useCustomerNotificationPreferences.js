import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getNotificationPreferences, saveNotificationPreferences } from "../services/notificationCenterService";
import {
  getCustomerProfile,
  isStorefrontAccountApiEnabled,
  updateCustomerProfile,
} from "../services/storefrontAccountApiService";

const PROFILE_FIELDS = {
  emailNotifications: "email_updates",
  smsNotifications: "sms_updates",
  whatsappNotifications: "whatsapp_updates",
};

function readLocalPreferences(user) {
  return getNotificationPreferences(user);
}

export function useCustomerNotificationPreferences() {
  const { user, authenticatedRequest } = useAuth();
  const [preferences, setPreferences] = useState(() => readLocalPreferences(user));
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const local = readLocalPreferences(user);
    setPreferences(local);
    setError("");

    if (!isStorefrontAccountApiEnabled || user?.role !== "CUSTOMER" || typeof authenticatedRequest !== "function") {
      return () => { cancelled = true; };
    }

    getCustomerProfile(authenticatedRequest)
      .then((profile) => {
        if (cancelled) return;
        setPreferences({
          ...local,
          emailNotifications: profile?.email_updates ?? local.emailNotifications,
          smsNotifications: profile?.sms_updates ?? local.smsNotifications,
          whatsappNotifications: profile?.whatsapp_updates ?? local.whatsappNotifications,
        });
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Could not load notification preferences from your account.");
      });

    return () => { cancelled = true; };
  }, [user?.email, user?.id, user?.role, authenticatedRequest]);

  const updatePreference = useCallback(async (key, value) => {
    setError("");
    const backendField = PROFILE_FIELDS[key];
    if (isStorefrontAccountApiEnabled && user?.role === "CUSTOMER" && backendField) {
      try {
        await updateCustomerProfile({ [backendField]: Boolean(value) }, authenticatedRequest);
        setPreferences((current) => ({ ...current, [key]: Boolean(value) }));
      } catch (requestError) {
        setError(requestError.message || "Could not save this preference to your account.");
      }
      return;
    }

    setPreferences(saveNotificationPreferences(user, { [key]: Boolean(value) }));
  }, [user, authenticatedRequest]);

  return { preferences, updatePreference, error, isApiMode: isStorefrontAccountApiEnabled && user?.role === "CUSTOMER" };
}
