import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { storefrontWishlistApiEnabled, getStorefrontWishlist, saveStorefrontWishlist } from "../services/storefrontCommerceApiService";

const WishlistContext =
  createContext(null);

const getWishlistKey = (userId) =>
  `techgear_wishlist_user_${userId}`;

function loadWishlist(key) {
  try {
    const savedWishlist =
      localStorage.getItem(key);

    return savedWishlist
      ? JSON.parse(savedWishlist)
      : [];
  } catch (error) {
    console.error(
      "Failed to load wishlist:",
      error
    );

    return [];
  }
}

export function WishlistProvider({
  children,
}) {
  const { user } = useAuth();

  const [wishlistIds, setWishlistIds] =
    useState([]);
  const [wishlistApiReady, setWishlistApiReady] = useState(false);

  const previousUserIdRef =
    useRef(null);

  const skipNextSaveRef =
    useRef(false);

  // =========================================
  // LOAD / SWITCH USER WISHLIST
  // =========================================
  useEffect(() => {
    if (storefrontWishlistApiEnabled) return;
    const currentUserId =
      user?.id ?? null;

    const previousUserId =
      previousUserIdRef.current;

    // Initial guest state
    if (
      previousUserId === null &&
      currentUserId === null
    ) {
      skipNextSaveRef.current = true;
      setWishlistIds([]);
      return;
    }

    // User login
    if (
      currentUserId !== null &&
      currentUserId !== previousUserId
    ) {
      const key =
        getWishlistKey(currentUserId);

      const savedWishlist =
        loadWishlist(key);

      skipNextSaveRef.current = true;

      setWishlistIds(
        savedWishlist
      );

      previousUserIdRef.current =
        currentUserId;

      return;
    }

    // User logout
    if (
      currentUserId === null &&
      previousUserId !== null
    ) {
      // Keep user's wishlist saved
      const key =
        getWishlistKey(
          previousUserId
        );

      localStorage.setItem(
        key,
        JSON.stringify(
          wishlistIds
        )
      );

      // But active state becomes empty
      skipNextSaveRef.current = true;

      setWishlistIds([]);

      previousUserIdRef.current =
        null;
    }
  }, [user]);

  // =========================================
  // SAVE WISHLIST
  // =========================================
  useEffect(() => {
    if (storefrontWishlistApiEnabled) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const userId =
      user?.id ?? null;

    // Guest has no wishlist
    if (userId === null) {
      return;
    }

    const key =
      getWishlistKey(userId);

    localStorage.setItem(
      key,
      JSON.stringify(wishlistIds)
    );
  }, [wishlistIds, user]);

  // API mode loads and persists the visitor's wishlist in Django/PostgreSQL.
  useEffect(() => {
    if (!storefrontWishlistApiEnabled) return undefined;
    let active = true;
    getStorefrontWishlist()
      .then((ids) => {
        if (!active) return;
        const legacyIds = user?.id != null ? loadWishlist(getWishlistKey(user.id)) : [];
        const mergedIds = [...new Set([...ids, ...legacyIds].map(Number).filter((id) => Number.isInteger(id) && id > 0))];
        setWishlistIds(mergedIds);
        setWishlistApiReady(true);
      })
      .catch((error) => {
        console.error("Could not load the persisted storefront wishlist. Wishlist API sync is paused until reload.", error?.message || error);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storefrontWishlistApiEnabled || !wishlistApiReady) return undefined;
    const timeoutId = window.setTimeout(() => {
      saveStorefrontWishlist(wishlistIds).catch((error) => {
        console.error("Could not save the storefront wishlist to Django.", error?.message || error);
      });
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [wishlistIds, wishlistApiReady]);

  // =========================================
  // TOGGLE
  // =========================================
  const toggleWishlist = (
    productId
  ) => {
    setWishlistIds((currentIds) => {
      if (
        currentIds.includes(productId)
      ) {
        return currentIds.filter(
          (id) => id !== productId
        );
      }

      return [
        ...currentIds,
        productId,
      ];
    });
  };

  // =========================================
  // ADD
  // =========================================
  const addToWishlist = (
    productId
  ) => {
    setWishlistIds((currentIds) => {
      if (
        currentIds.includes(productId)
      ) {
        return currentIds;
      }

      return [
        ...currentIds,
        productId,
      ];
    });
  };

  // =========================================
  // REMOVE
  // =========================================
  const removeFromWishlist = (
    productId
  ) => {
    setWishlistIds((currentIds) =>
      currentIds.filter(
        (id) => id !== productId
      )
    );
  };

  // =========================================
  // CHECK
  // =========================================
  const isWishlisted = (
    productId
  ) => {
    return wishlistIds.includes(
      productId
    );
  };

  const wishlistCount =
    wishlistIds.length;

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
  const context =
    useContext(WishlistContext);

  if (!context) {
    throw new Error(
      "useWishlist must be used inside WishlistProvider"
    );
  }

  return context;
}