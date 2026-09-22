import { Alert } from 'react-native';

// Lightweight, dependency-free notice helper. Foreground FCM messages and other
// transient status updates surface through here. Kept as a thin wrapper so the
// call sites stay uncluttered and a richer toast/banner can be dropped in later
// without touching the callers.
export function showAlert(message: string, title = 'Breakaway Roping'): void {
  const trimmed = (message ?? '').trim();
  if (!trimmed) return;
  Alert.alert(title, trimmed);
}
