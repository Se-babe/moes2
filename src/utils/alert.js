import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a no-op, so on web every error/success
// message silently disappears. This mirrors RN's Alert.alert(title, message, buttons)
// API but falls back to window.alert/confirm on web.
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }

  if (buttons.length === 1) {
    window.alert(text);
    buttons[0].onPress?.();
    return;
  }

  if (window.confirm(text)) {
    const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
    confirmBtn.onPress?.();
  } else {
    buttons.find((b) => b.style === 'cancel')?.onPress?.();
  }
}
