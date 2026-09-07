import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const ENTITLEMENT_ID = 'rodeo_apps_premium';

export const initRevenueCat = () => {
  const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY;
  const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY;
  if (!appleKey && !googleKey) {
    console.warn('[IAP] RevenueCat keys not configured — purchase flows disabled');
    return;
  }
  Purchases.setLogLevel(LOG_LEVEL.WARN);
  if (Platform.OS === 'ios' && appleKey) {
    Purchases.configure({ apiKey: appleKey });
  } else if (Platform.OS === 'android' && googleKey) {
    Purchases.configure({ apiKey: googleKey });
  }
};

export const identifyUser = async (userId: string) => {
  try {
    await Purchases.logIn(userId);
  } catch {
    // ignore — RevenueCat not configured or offline
  }
};

export const checkPremium = async (): Promise<boolean> => {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
};

export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
};

export const purchasePackage = async (pkg: PurchasesPackage) => {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  if (isPremium) {
    // Sync premium status to Supabase
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ has_premium_access: true, premium_source: 'revenuecat' })
        .eq('id', user.id);
    }
  }
  return isPremium;
};

export const restorePurchases = async (): Promise<boolean> => {
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
};
