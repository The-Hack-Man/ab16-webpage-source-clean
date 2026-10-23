import { createContext, useEffect, useReducer, type ReactNode } from 'react';
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
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.variant_id === action.item.variant_id
              ? { ...i, quantity: Math.min(i.quantity + action.item.quantity, i.max_stock) }
              : i
          ),
        };
      }
      return { items: [...state.items, action.item] };
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored) as CartItem[];
        dispatch({ type: 'HYDRATE', items });
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // ignore
    }
  }, [state.items]);

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
