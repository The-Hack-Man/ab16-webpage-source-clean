import { createContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import type { CartItem } from '@/types';

const STORAGE_KEY = 'ab16_cart';

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD'; item: CartItem }
  | { type: 'REMOVE'; variantId: string }
  | { type: 'UPDATE_QTY'; variantId: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; items: CartItem[] };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { items: action.items };
    case 'ADD': {
      const existing = state.items.find((i) => i.variant_id === action.item.variant_id);
      const quantity = Math.min(action.item.quantity, action.item.max_stock);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.variant_id === action.item.variant_id
              ? { ...action.item, quantity: Math.min(i.quantity + quantity, action.item.max_stock) }
              : i
          ),
        };
      }
      return { items: [...state.items, { ...action.item, quantity }] };
    }
    case 'REMOVE':
      return { items: state.items.filter((i) => i.variant_id !== action.variantId) };
    case 'UPDATE_QTY':
      return {
        items: state.items.map((i) =>
          i.variant_id === action.variantId
            ? { ...i, quantity: Math.max(1, Math.min(action.quantity, i.max_stock)) }
            : i
        ),
      };
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  count: number;
  subtotal: number;
}

export const CartContext = createContext<CartContextValue | null>(null);
export type { CartContextValue };

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        const items = Array.isArray(parsed)
          ? parsed.filter((item): item is CartItem => isCartItem(item))
          : [];
        dispatch({ type: 'HYDRATE', items });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // ignore
    }
  }, [hydrated, state.items]);

  const count = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const value: CartContextValue = {
    items: state.items,
    addItem: (item) => dispatch({ type: 'ADD', item }),
    removeItem: (variantId) => dispatch({ type: 'REMOVE', variantId }),
    updateQuantity: (variantId, quantity) => dispatch({ type: 'UPDATE_QTY', variantId, quantity }),
    clearCart: () => dispatch({ type: 'CLEAR' }),
    count,
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return typeof item.variant_id === 'string'
    && typeof item.product_slug === 'string'
    && typeof item.name === 'string'
    && Number.isFinite(item.price) && Number(item.price) >= 0
    && Number.isInteger(item.quantity) && Number(item.quantity) > 0
    && Number.isInteger(item.max_stock) && Number(item.max_stock) > 0
    && Number(item.quantity) <= Number(item.max_stock);
}
