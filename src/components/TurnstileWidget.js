import React, { useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';

// Public site key (safe to ship client-side — only the secret key, which
// lives as a Supabase Edge Function secret, must stay server-side).
const TURNSTILE_SITE_KEY = '0x4AAAAAAEYAmJTs-9oUcUS6';

let scriptPromise = null;
const loadTurnstileScript = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptPromise;
};

// Web-only for now (this app is currently deployed as a web build; a native
// build would need react-native-turnstile or an equivalent instead).
export default function TurnstileWidget({ onVerify, onExpire }) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => onVerify && onVerify(token),
        'expired-callback': () => onExpire && onExpire(),
        'error-callback': () => onExpire && onExpire(),
      });
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, []);

  if (Platform.OS !== 'web') return null;
  return <View ref={containerRef} style={{ marginBottom: 12 }} />;
}
