import { useCallback, useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '@/lib/supabase';

type T_PAYMENT_RESULT = {
  success: boolean;
  cancelled: boolean;
  message?: string;
};

type T_BUY_LISTING_INPUT = {
  listingId: string;
  currency?: string;
};

/**
 * In-app Stripe checkout for marketplace listings whose payment_type is "stripe".
 * Ported from BarrelConnect: create a PaymentIntent via the marketplace-checkout
 * edge function -> present the native payment sheet -> confirm server-side.
 * Breakaway Roping takes ZERO platform commission; the only add-on is Stripe's
 * processing fee (handled server-side).
 *
 * GRACEFUL DEGRADATION: guards on a real EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and
 * returns a friendly message instead of throwing when Stripe is not configured.
 */
export const useMarketplacePayment = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const buyListing = useCallback(
    async ({
      listingId,
      currency = 'usd',
    }: T_BUY_LISTING_INPUT): Promise<T_PAYMENT_RESULT> => {
      try {
        setLoading(true);

        const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!stripeKey || !stripeKey.startsWith('pk_')) {
          throw new Error(
            'In-app payments are not available yet. Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable checkout.',
          );
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!baseUrl) {
          throw new Error('Supabase URL is not configured.');
        }

        const createRes = await fetch(`${baseUrl}/functions/v1/marketplace-checkout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ listingId, currency: currency.toLowerCase() }),
        });

        const createResult = await createRes.json();
        if (!createRes.ok || !createResult?.success || !createResult?.clientSecret) {
          throw new Error(createResult?.error || 'Failed to create payment');
        }

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: createResult.clientSecret,
          merchantDisplayName: 'Breakaway Roping',
        });
        if (initError) {
          throw new Error(initError.message || 'Failed to initialize payment');
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === 'Canceled') {
            return { success: false, cancelled: true };
          }
          throw new Error(presentError.message || 'Payment was not completed');
        }

        const confirmRes = await fetch(
          `${baseUrl}/functions/v1/confirm-marketplace-checkout`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentIntentId: createResult.paymentIntentId }),
          },
        );

        const confirmResult = await confirmRes.json();
        if (!confirmRes.ok || !confirmResult?.success) {
          throw new Error(confirmResult?.error || 'Failed to confirm payment');
        }

        return { success: true, cancelled: false };
      } catch (error: any) {
        return {
          success: false,
          cancelled: false,
          message:
            typeof error?.message === 'string'
              ? error.message
              : 'Payment failed. Please try again.',
        };
      } finally {
        setLoading(false);
      }
    },
    [initPaymentSheet, presentPaymentSheet],
  );

  return { loading, buyListing };
};
