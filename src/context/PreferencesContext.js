import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from '../i18n';

const KEY = 'nwsc_preferences';
const DEFAULTS = { language: 'en', textScale: 1, highContrast: false, lite: null }; // lite null = automatic

const PreferencesContext = createContext(null);

// Slow or data-saving connections switch Lite mode on automatically.
function connectionIsSlow() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return !!c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType));
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setPrefs((p) => ({ ...p, ...JSON.parse(v) })))
      .catch(() => {});
  }, []);

  // Apply text size and contrast to the whole page on web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (root) {
      root.style.zoom = String(prefs.textScale);
      root.style.filter = prefs.highContrast ? 'contrast(1.35) saturate(1.1)' : '';
    }
    document.documentElement.lang = prefs.language === 'xog' ? 'xog' : prefs.language === 'lg' ? 'lg' : 'en';
  }, [prefs.textScale, prefs.highContrast, prefs.language]);

  const update = useCallback((patch) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const lite = prefs.lite === null ? connectionIsSlow() : prefs.lite;
  const t = useCallback((key, vars) => translate(prefs.language, key, vars), [prefs.language]);

  return (
    <PreferencesContext.Provider value={{ ...prefs, lite, liteAuto: prefs.lite === null, update, t }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) return { ...DEFAULTS, lite: false, update: () => {}, t: (k, v) => translate('en', k, v) };
  return ctx;
}

export const useT = () => usePreferences().t;
