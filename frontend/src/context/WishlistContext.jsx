
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

import {
  storefrontWishlistApiEnabled,
  getStorefrontWishlist,
  saveStorefrontWishlist,
} from "../services/storefrontCommerceApiService";

const WishlistContext = createContext(null);

const getWishlistKey = (userId) =>
  `techgear_wishlist_user_${userId}`;

function loadWishlist(key) {
  try {
    const savedWishlist = localStorage.getItem(key);
    return savedWishlist ? JSON.parse(savedWishlist) : [];
  } catch (error) {
    console.error("Failed to load wishlist:", error);
    return [];
  }
}

export function WishlistProvider({ children }) {
  const {
    user,
    isAuthenticated,
    isInitializing,
    authenticatedRequest,
  } = useAuth();

  const [wishlistIds, setWishlistIds] = useState([]);
  const [wishlistApiReady, setWishlistApiReady] = useState(false);
  const [wishlistDirty, setWishlistDirty] = useState(false);
  const [loadedScopeKey, setLoadedScopeKey] = useState(null);

  const previousUserIdRef = useRef(null);
  const skipNextSaveRef = useRef(false);
  const wishlistVersionRef = useRef(0);

  // =========================================
  // LOCAL MODE: LOAD / SWITCH USER WISHLIST
  // =========================================

  useEffect(() => {
    if (storefrontWishlistApiEnabled) return;

    const currentUserId = user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    // Initial guest state
    if (
      previousUserId === null &&
      currentUserId === null
    ) {
      skipNextSaveRef.current = true;
      setWishlistIds([]);
      return;
    }

    // User login or account switch
    if (
      currentUserId !== null &&
      currentUserId !== previousUserId
    ) {
      const key = getWishlistKey(currentUserId);
      const savedWishlist = loadWishlist(key);

      skipNextSaveRef.current = true;
      setWishlistIds(savedWishlist);

      previousUserIdRef.current = currentUserId;
      return;
    }

    // User logout
    if (
      currentUserId === null &&
      previousUserId !== null
    ) {
      const key = getWishlistKey(previousUserId);

      localStorage.setItem(
        key,
        JSON.stringify(wishlistIds)
      );

      skipNextSaveRef.current = true;
      setWishlistIds([]);

      previousUserIdRef.current = null;
    }
  }, [user?.id]);

  // =========================================
  // LOCAL MODE: SAVE WISHLIST
  // =========================================

  useEffect(() => {
    if (storefrontWishlistApiEnabled) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const userId = user?.id ?? null;

    // Guest wishlist is not stored as a user wishlist
    if (userId === null) return;

    const key = getWishlistKey(userId);

    localStorage.setItem(
      key,
      JSON.stringify(wishlistIds)
    );
  }, [wishlistIds, user?.id]);

  // =========================================
  // API MODE: LOAD ACCOUNT-SPECIFIC WISHLIST
  // =========================================

  useEffect(() => {
    if (!storefrontWishlistApiEnabled) return;
    if (isInitializing) return;

    // CRM staff cannot use customer wishlist
    if (
      isAuthenticated &&
      user?.role !== "CUSTOMER"
    ) {
      wishlistVersionRef.current += 1;

      setWishlistIds([]);
      setWishlistApiReady(false);
      setWishlistDirty(false);
      setLoadedScopeKey(null);

      return;
    }

    // Wait if authenticated customer ID is unavailable
    if (isAuthenticated && user?.id == null) {
      setWishlistIds([]);
      setWishlistApiReady(false);
      setWishlistDirty(false);
      setLoadedScopeKey(null);

      return;
    }

    // Each customer gets a unique server-side wishlist scope.
    // Guest users continue using their browser visitor ID.
    const scopeKey = isAuthenticated
      ? `customer:${user.id}`
      : "guest";

    // Authenticated customers must use authenticated requests.
    if (
      isAuthenticated &&
      typeof authenticatedRequest !== "function"
    ) {
      setWishlistIds([]);
      setWishlistApiReady(false);
      setLoadedScopeKey(null);

      console.error(
        "Authenticated wishlist request is unavailable."
      );

      return;
    }

    let active = true;

    // Invalidate any previous pending save completion.
    wishlistVersionRef.current += 1;

    setWishlistIds([]);
    setWishlistApiReady(false);
    setWishlistDirty(false);
    setLoadedScopeKey(null);

    const request = isAuthenticated
      ? authenticatedRequest
      : undefined;

    getStorefrontWishlist(request)
      .then((ids) => {
        if (!active) return;

        const safeIds = Array.isArray(ids)
          ? [
              ...new Set(
                ids
                  .map(Number)
                  .filter(
                    (id) =>
                      Number.isInteger(id) && id > 0
                  )
              ),
            ]
          : [];

        setWishlistIds(safeIds);
        setLoadedScopeKey(scopeKey);
        setWishlistApiReady(true);
        setWishlistDirty(false);
      })
      .catch((error) => {
        if (!active) return;

        console.error(
          "Could not load the storefront wishlist:",
          error?.message || error
        );

        setWishlistApiReady(false);
        setLoadedScopeKey(null);
      });

    return () => {
      active = false;
    };
  }, [
    isInitializing,
    isAuthenticated,
    user?.id,
    user?.role,
    authenticatedRequest,
  ]);

  // =========================================
  // API MODE: SAVE CHANGED WISHLIST
  // =========================================

  useEffect(() => {
    if (!storefrontWishlistApiEnabled) return;
    if (isInitializing) return;
    if (!wishlistApiReady || !wishlistDirty) return;

    // Do not save CRM staff wishlist
    if (
      isAuthenticated &&
      user?.role !== "CUSTOMER"
    ) {
      return;
    }

    const currentScopeKey = isAuthenticated
      ? `customer:${user?.id}`
      : "guest";

    // Prevent old account data from being saved
    // under the newly selected account.
    if (loadedScopeKey !== currentScopeKey) return;

    if (
      isAuthenticated &&
      typeof authenticatedRequest !== "function"
    ) {
      return;
    }

    const request = isAuthenticated
      ? authenticatedRequest
      : undefined;

    const version = wishlistVersionRef.current;
    const idsToSave = [...wishlistIds];

    const timeoutId = window.setTimeout(() => {
      saveStorefrontWishlist(idsToSave, request)
        .then(() => {
          // Only mark clean if no newer change happened.
          if (version === wishlistVersionRef.current) {
            setWishlistDirty(false);
          }
        })
        .catch((error) => {
          console.error(
            "Could not save the storefront wishlist:",
            error?.message || error
          );
        });
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    wishlistIds,
    wishlistApiReady,
    wishlistDirty,
    loadedScopeKey,
    isInitializing,
    isAuthenticated,
    user?.id,
    user?.role,
    authenticatedRequest,
  ]);

  // =========================================
  // MARK WISHLIST AS CHANGED
  // =========================================

  const markWishlistChanged = () => {
    if (!storefrontWishlistApiEnabled) return;

    wishlistVersionRef.current += 1;
    setWishlistDirty(true);
  };

  // =========================================
  // TOGGLE WISHLIST
  // =========================================

  const toggleWishlist = (productId) => {
    markWishlistChanged();

    setWishlistIds((currentIds) => {
      if (currentIds.includes(productId)) {
        return currentIds.filter(
          (id) => id !== productId
        );
      }

      return [...currentIds, productId];
    });
  };

  // =========================================
  // ADD TO WISHLIST
  // =========================================

  const addToWishlist = (productId) => {
    if (wishlistIds.includes(productId)) return;

    markWishlistChanged();

    setWishlistIds((currentIds) => {
      if (currentIds.includes(productId)) {
        return currentIds;
      }

      return [...currentIds, productId];
    });
  };

  // =========================================
  // REMOVE FROM WISHLIST
  // =========================================

  const removeFromWishlist = (productId) => {
    if (!wishlistIds.includes(productId)) return;

    markWishlistChanged();

    setWishlistIds((currentIds) =>
      currentIds.filter((id) => id !== productId)
    );
  };

  // =========================================
  // CHECK WISHLIST
  // =========================================

  const isWishlisted = (productId) => {
    return wishlistIds.includes(productId);
  };

  const wishlistCount = wishlistIds.length;

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistCount,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isWishlisted,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error(
      "useWishlist must be used inside WishlistProvider"
    );
  }

  return context;
}
