import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/lib/supabase';

type CheckoutStatus = 'loading' | 'pending' | 'paid' | 'failed';

export function CheckoutSuccessPage() {
  const location = useLocation();
  const { clearCart } = useCart();
  const clearCartRef = useRef(clearCart);
  clearCartRef.current = clearCart;
  const [status, setStatus] = useState<CheckoutStatus>('loading');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verifyCheckout = useCallback(async () => {
    const sessionId = new URLSearchParams(location.search).get('session_id');
    if (!sessionId) {
      setStatus('failed');
      setErrorMessage('The payment session was not included in the return link.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke<{
        status: 'paid' | 'pending' | 'failed';
        orderNumber?: string;
        error?: string;
      }>('verify-checkout', { body: { sessionId } });

      if (error) {
        setStatus('failed');
        setErrorMessage(error.message);
        return;
      }
      if (data?.status === 'failed') {
        setStatus('failed');
        setErrorMessage(data.error || 'This payment was not completed.');
        return;
      }
      if (data?.status === 'pending') {
        setStatus('pending');
        return;
      }
      if (data?.status !== 'paid' || !data.orderNumber) {
        setStatus('failed');
        setErrorMessage('The payment verification response was invalid.');
        return;
      }

      setOrderNumber(data.orderNumber);
      setStatus('paid');
      clearCartRef.current();
    } catch (error) {
      setStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown verification error.');
    }
  }, [location.search]);

  useEffect(() => {
    void verifyCheckout();
  }, [verifyCheckout]);

  return (
    <div className="bg-bone min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center py-16">
        {status === 'loading' ? (
          <>
            <Loader2 size={32} className="animate-spin mx-auto mb-6 text-jet" />
            <h1 className="text-display-lg">Verifying payment</h1>
          </>
        ) : status === 'paid' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-6">
              <Check size={32} className="text-white" />
            </div>
            <h1 className="text-display-lg">Thank you for your order</h1>
            <p className="mt-4 text-slate-600">Order number: <strong className="text-jet">{orderNumber}</strong></p>
            <p className="mt-2 text-sm text-slate-500">A confirmation will be sent to your email.</p>
          </>
        ) : status === 'pending' ? (
          <>
            <h1 className="text-display-lg">Payment is processing</h1>
            <p className="mt-4 text-slate-600">Your order will appear once Stripe confirms the payment.</p>
            <button type="button" onClick={() => void verifyCheckout()} className="btn-outline mt-6">Check again</button>
          </>
        ) : (
          <>
            <h1 className="text-display-lg">We could not verify that payment</h1>
            <p role="alert" className="mt-4 text-sm text-red-700">{errorMessage}</p>
            <button type="button" onClick={() => void verifyCheckout()} className="btn-outline mt-6">Try again</button>
          </>
        )}
        {status === 'paid' && <Link to="/shop" className="btn-primary mt-8">Continue Shopping</Link>}
        {status !== 'loading' && status !== 'paid' && <Link to="/bag" className="btn-outline mt-4">Return to Bag</Link>}
      </div>
    </div>
  );
}
