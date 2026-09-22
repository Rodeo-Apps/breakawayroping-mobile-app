import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

// Wraps the app so the Stripe payment-sheet hooks (useStripe) have a provider in
// context. The publishable key is read from the environment; when it is absent
// or still a placeholder we pass an empty string. The provider renders its
// children either way, and every checkout hook guards on a real `pk_` key before
// attempting a charge, so the app degrades gracefully with no Stripe configured.
const PUBLISHABLE_KEY = (() => {
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return key && key.startsWith('pk_') ? key : '';
})();

export function AppStripeProvider({ children }: { children: React.ReactNode }) {
  return (
    <StripeProvider
      publishableKey={PUBLISHABLE_KEY}
      merchantIdentifier="merchant.pro.breakawayroping.app"
    >
      <>{children}</>
    </StripeProvider>
  );
}
