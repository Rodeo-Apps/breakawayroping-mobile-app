import { useCallback, useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '@/lib/supabase';

type T_PAYMENT_RESULT = {
  success: boolean;
  cancelled: boolean;
  message?: string;
};

type T_PAYMENT_FLOW_INPUT = {
  createFunctionName: string;
  confirmFunctionName: string;
  createPayload: Record<string, unknown>;
};

type T_EVENT_PAYMENT_INPUT = {
  registrationId: string;
  amountCents: number;
  currency?: string;
};

type T_COACHING_PAYMENT_INPUT = {
  bookingId: string;
  amountCents: number;
  currency?: string;
};

/**
 * Generic Stripe payment-sheet flow for event registrations and coaching
 * bookings, ported from BarrelConnect. Each flow calls a create-* edge function
 * to mint a PaymentIntent, presents the native sheet, then calls the matching
 * confirm-* edge function.
 *
 * GRACEFUL DEGRADATION: guards on a real EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY.
 */
export const useStripePayment = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const runPaymentFlow = useCallback(
    async ({
      createFunctionName,
      confirmFunctionName,
      createPayload,
    }: T_PAYMENT_FLOW_INPUT): Promise<T_PAYMENT_RESULT> => {
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

        const createRes = await fetch(`${baseUrl}/functions/v1/${createFunctionName}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createPayload),
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

        const confirmRes = await fetch(`${baseUrl}/functions/v1/${confirmFunctionName}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentIntentId: createResult.paymentIntentId }),
        });

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

  const payEventRegistration = useCallback(
    async ({
      registrationId,
      amountCents,
      currency = 'usd',
    }: T_EVENT_PAYMENT_INPUT): Promise<T_PAYMENT_RESULT> =>
      runPaymentFlow({
        createFunctionName: 'create-event-payment',
        confirmFunctionName: 'confirm-event-payment',
        createPayload: { registrationId, amountCents, currency: currency.toLowerCase() },
      }),
    [runPaymentFlow],
  );

  const payCoachingBooking = useCallback(
    async ({
      bookingId,
      amountCents,
      currency = 'usd',
    }: T_COACHING_PAYMENT_INPUT): Promise<T_PAYMENT_RESULT> =>
      runPaymentFlow({
        createFunctionName: 'create-coaching-payment',
        confirmFunctionName: 'confirm-coaching-payment',
        createPayload: { bookingId, amountCents, currency: currency.toLowerCase() },
      }),
    [runPaymentFlow],
  );

  return { loading, payEventRegistration, payCoachingBooking };
};
