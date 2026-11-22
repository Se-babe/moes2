import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from '../i18n';

const KEY = 'nwsc_preferences';
const DEFAULTS = { language: 'en', textScale: 1, highContrast: false, lite: null, appearance: 'light', accent: 'blue' }; // lite null = automatic

// Colour themes: how far to turn the site's colour wheel from NWSC blue.
export const ACCENTS = [
  { value: 'blue', label: 'NWSC blue', swatch: '#0A4D8C', rotate: 0 },
  { value: 'teal', label: 'Teal', swatch: '#0A7A8C', rotate: -25 },
  { value: 'green', label: 'Green', swatch: '#1F7A3A', rotate: -60 },
  { value: 'purple', label: 'Purple', swatch: '#5B3E9E', rotate: 50 },
];

// Dark mode and colour themes are page-wide colour filters. Photos, videos
// and maps get the opposite filter so they keep their real colours.
function themeCss({ dark, rotate, highContrast }) {
  const page = [dark && 'invert(1) hue-rotate(180deg)', rotate && `hue-rotate(${rotate}deg)`, highContrast && 'contrast(1.35) saturate(1.1)'].filter(Boolean);
  if (!page.length) return '';
  const undo = [rotate && `hue-rotate(${-rotate}deg)`, dark && 'hue-rotate(180deg) invert(1)'].filter(Boolean);
  // Photos (RN Image draws them as url() backgrounds) get the full undo;
  // status colours only get the hue turned back, so they still follow dark
  // mode; the deep-blue banners (gradients) stay deep in dark mode.
  return `html { filter: ${page.join(' ')}; background: #fff; }
${undo.length ? `img, video, iframe, canvas, [style*="url("], [data-keep-colors] { filter: ${undo.join(' ')}; }` : ''}
${rotate ? `[data-keep-hue] { filter: hue-rotate(${-rotate}deg); } [data-keep-hue] [data-keep-hue] { filter: none; }` : ''}
${dark ? `[style*="linear-gradient"], [data-stay-dark] { filter: hue-rotate(180deg) invert(1); } [data-stay-dark] [style*="linear-gradient"], [data-stay-dark] [data-stay-dark] { filter: none; } [style*="linear-gradient"] [style*="url("], [data-stay-dark] [style*="url("] { filter: ${undo.filter((x) => !x.includes('invert')).join(' ') || 'none'}; }` : ''}`;
}

function prefersDark() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

const PreferencesContext = createContext(null);

// Slow or data-saving connections switch Lite mode on automatically.
function connectionIsSlow() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return !!c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType));
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [systemDark, setSystemDark] = useState(prefersDark);

  // Follow the device when "Match my device" is chosen.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setPrefs((p) => ({ ...p, ...JSON.parse(v) })))
      .catch(() => {});
  }, []);

  const dark = prefs.appearance === 'dark' || (prefs.appearance === 'system' && systemDark);

  // Apply text size, contrast, dark mode and colour theme to the whole page
  // on web (including pop-up windows, which sit outside #root).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (root) {
      root.style.zoom = String(prefs.textScale);
      root.style.filter = '';
    }
    let tag = document.getElementById('nwsc-theme');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'nwsc-theme';
      document.head.appendChild(tag);
    }
    const rotate = ACCENTS.find((a) => a.value === prefs.accent)?.rotate || 0;
    tag.textContent = themeCss({ dark, rotate, highContrast: prefs.highContrast });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0F14' : '#0A4D8C');
    document.documentElement.lang = prefs.language === 'xog' ? 'xog' : prefs.language === 'lg' ? 'lg' : 'en';
  }, [prefs.textScale, prefs.highContrast, prefs.language, prefs.accent, dark]);

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
    <PreferencesContext.Provider value={{ ...prefs, dark, lite, liteAuto: prefs.lite === null, update, t }}>
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
