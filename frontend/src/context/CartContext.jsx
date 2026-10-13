import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { recordAddToCart } from "../services/customerBehaviorService";
import { storefrontCartApiEnabled, getStorefrontCart, saveStorefrontCart } from "../services/storefrontCommerceApiService";

const CartContext = createContext(null);

const GUEST_CART_KEY = "techgear_cart_guest";

const getUserCartKey = (userId) =>
  `techgear_cart_user_${userId}`;

function loadCart(key) {
  try {
    const savedCart = localStorage.getItem(key);

    return savedCart
      ? JSON.parse(savedCart)
      : [];
  } catch (error) {
    console.error(
      "Failed to load cart:",
      error
    );

    return [];
  }
}

function mergeCarts(userCart, guestCart) {
  const merged = [...userCart];

  guestCart.forEach((guestItem) => {
    const existingItem = merged.find(
      (item) => item.id === guestItem.id
    );

    if (existingItem) {
      existingItem.quantity = Math.min(
        existingItem.quantity + guestItem.quantity,
        existingItem.stock || 99
      );
    } else {
      merged.push(guestItem);
    }
  });

  return merged;
}

export function CartProvider({ children }) {
  const { user } = useAuth();

  const [cartItems, setCartItems] =
    useState([]);
  const [cartApiReady, setCartApiReady] = useState(false);

  const previousUserIdRef = useRef(null);

  const skipNextSaveRef =
    useRef(false);

  // =========================================
  // HANDLE USER / GUEST CART SWITCH
  // =========================================
  useEffect(() => {
    if (storefrontCartApiEnabled) return;
    const currentUserId =
      user?.id ?? null;

    const previousUserId =
      previousUserIdRef.current;

    // =======================================
    // INITIAL LOAD
    // =======================================
    if (
      previousUserId === null &&
      currentUserId === null
    ) {
      skipNextSaveRef.current = true;

      setCartItems(
        loadCart(GUEST_CART_KEY)
      );

      return;
    }

    // =======================================
    // USER LOGGED IN
    // =======================================
    if (
      currentUserId !== null &&
      currentUserId !== previousUserId
    ) {
      const userKey =
        getUserCartKey(currentUserId);

      const userCart =
        loadCart(userKey);

      const guestCart =
        loadCart(GUEST_CART_KEY);

      // Merge guest cart into user cart
      const mergedCart = mergeCarts(
        userCart,
        guestCart
      );

      skipNextSaveRef.current = true;

      setCartItems(mergedCart);

      // Save merged cart for this user
      localStorage.setItem(
        userKey,
        JSON.stringify(mergedCart)
      );

      // Guest cart no longer needed
      localStorage.removeItem(
        GUEST_CART_KEY
      );

      previousUserIdRef.current =
        currentUserId;

      return;
    }

    // =======================================
    // USER LOGGED OUT
    // =======================================
    if (
      currentUserId === null &&
      previousUserId !== null
    ) {
      const userKey =
        getUserCartKey(
          previousUserId
        );

      // Save User A's cart
      localStorage.setItem(
        userKey,
        JSON.stringify(cartItems)
      );

      // IMPORTANT:
      // Empty active cart after logout
      skipNextSaveRef.current = true;

      setCartItems([]);

      // No guest cart after logout
      localStorage.removeItem(
        GUEST_CART_KEY
      );

      previousUserIdRef.current =
        null;
    }
  }, [user]);

  // =========================================
  // SAVE ACTIVE CART
  // =========================================
  useEffect(() => {
    if (storefrontCartApiEnabled) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const userId =
      user?.id ?? null;

    const key =
      userId !== null
        ? getUserCartKey(userId)
        : GUEST_CART_KEY;

    try {
      localStorage.setItem(
        key,
        JSON.stringify(cartItems)
      );
    } catch (error) {
      console.error(
        "Failed to save cart:",
        error
      );
    }
  }, [cartItems, user]);

  // API mode uses a pseudonymous visitor key and stores the cart in Django/PostgreSQL.
  useEffect(() => {
    if (!storefrontCartApiEnabled) return undefined;
    let active = true;
    getStorefrontCart()
      .then((items) => {
        if (!active) return;
        // Carry over the previous browser-local cart when valid products are now on the API catalogue.
        const legacyItems = loadCart(GUEST_CART_KEY);
        const mergedItems = mergeCarts(items, legacyItems);
        setCartItems(mergedItems);
        setCartApiReady(true);
      })
      .catch((error) => {
        console.error("Could not load the persisted storefront cart. Cart API sync is paused until reload.", error?.message || error);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storefrontCartApiEnabled || !cartApiReady) return undefined;
    const timeoutId = window.setTimeout(() => {
      saveStorefrontCart(cartItems).then(() => {
        try { localStorage.removeItem(GUEST_CART_KEY); } catch { /* legacy local cart cleanup is best-effort */ }
      }).catch((error) => {
        console.error("Could not save the storefront cart to Django.", error?.message || error);
      });
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [cartItems, cartApiReady]);

  // =========================================
  // ADD TO CART
  // =========================================
  const addToCart = (
    product,
    quantity = 1
  ) => {
    recordAddToCart(product, quantity);
    setCartItems((currentItems) => {
      const existingItem =
        currentItems.find(
          (item) =>
            item.id === product.id
        );

      if (existingItem) {
        return currentItems.map(
          (item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity: Math.min(
                    item.quantity +
                      quantity,
                    item.stock || 99
                  ),
                }
              : item
        );
      }

      return [
        ...currentItems,
        {
          ...product,
          quantity,
        },
      ];
    });
  };

  // =========================================
  // REMOVE
  // =========================================
  const removeFromCart = (id) => {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) => item.id !== id
      )
    );
  };

  // =========================================
  // UPDATE QUANTITY
  // =========================================
  const updateQuantity = (
    id,
    quantity
  ) => {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(
                  quantity,
                  item.stock || 99
                )
              ),
            }
          : item
      )
    );
  };

  // =========================================
  // CLEAR CART
  // =========================================
  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  // =========================================
  // COUNT
  // =========================================
  const cartCount =
    cartItems.reduce(
      (total, item) =>
        total + item.quantity,
      0
    );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}