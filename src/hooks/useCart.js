/**
 * useCart — shared cart hook
 *
 * Keeps cart in sync across:
 *   1. React state  (instant UI)
 *   2. localStorage (offline / page-reload persistence)
 *   3. MongoDB cart collection via /api/cart/ (backend DB)
 *
 * Every add / update / remove / clear triggers a debounced DB save
 * so the backend always has the latest cart state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cartAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const LS_KEY   = 'shopnest_cart';
const DEBOUNCE = 800;   // ms — wait this long after last change before saving to DB

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
}

function writeLocal(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export default function useCart() {
  const { user } = useAuth();
  const [cart, setCartState]   = useState(readLocal);
  const [syncing, setSyncing]  = useState(false);
  const debounceRef            = useRef(null);
  const lastSyncedRef          = useRef(null);   // tracks what we last sent to DB

  // ── Load cart from DB on login, merge with localStorage ─────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await cartAPI.getCart();
        const dbItems = res.data.cart?.items || [];
        if (dbItems.length === 0) return;   // DB empty → keep localStorage

        // Merge: localStorage is source-of-truth for qty changes made offline;
        // DB items fill in anything not already in localStorage
        const local = readLocal();
        const localIds = new Set(local.map(i => i.id));
        const merged = [
          ...local,
          ...dbItems.filter(i => !localIds.has(i.id)),
        ];
        if (merged.length !== local.length) {
          setCartState(merged);
          writeLocal(merged);
        }
      } catch (_) {
        // Not logged in or API error — silently continue with localStorage
      }
    })();
  }, [user?.email]);  // re-run when user logs in/out

  // ── Debounced DB save ────────────────────────────────────────────────────
  const syncToDb = useCallback((items) => {
    if (!user) return;                            // only sync when logged in
    const payload = JSON.stringify(items);
    if (payload === lastSyncedRef.current) return; // no change, skip

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setSyncing(true);
        await cartAPI.saveCart(items);
        lastSyncedRef.current = payload;
      } catch (e) {
        console.warn('Cart DB sync failed:', e?.response?.data?.error || e.message);
      } finally {
        setSyncing(false);
      }
    }, DEBOUNCE);
  }, [user]);

  // ── Internal setter: updates state + localStorage + DB ───────────────────
  const setCart = useCallback((updater) => {
    setCartState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeLocal(next);
      syncToDb(next);
      return next;
    });
  }, [syncToDb]);

  // ── Public actions ───────────────────────────────────────────────────────

  /** Add item or increment qty if already present */
  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }, [setCart]);

  /** Set exact quantity for an item (removes if qty < 1) */
  const updateQty = useCallback((id, qty) => {
    if (qty < 1) {
      setCart(prev => prev.filter(i => i.id !== id));
      return;
    }
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  }, [setCart]);

  /** Remove a single item */
  const removeItem = useCallback((id) => {
    setCart(prev => prev.filter(i => i.id !== id));
  }, [setCart]);

  /** Wipe cart — also clears DB immediately (no debounce) */
  const clearCart = useCallback(async () => {
    setCartState([]);
    writeLocal([]);
    lastSyncedRef.current = '[]';
    if (user) {
      try { await cartAPI.clearCart(); } catch (_) {}
    }
  }, [user]);

  // Derived values
  const cartCount  = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal   = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return {
    cart,
    cartCount,
    subtotal,
    syncing,
    addToCart,
    updateQty,
    removeItem,
    clearCart,
    setCart,        // escape hatch if needed
  };
}
