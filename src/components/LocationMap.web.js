import React from 'react';

// Web: a real embedded Google Map, no API key needed — the public
// /maps?output=embed endpoint accepts a free-text address as the query,
// so this stays accurate automatically whenever the office address in
// Site Settings changes (see LocationMap.js for the native fallback).
export default function LocationMap({ address, height = 260 }) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  return (
    <iframe
      title="Office location"
      src={src}
      style={{ width: '100%', height, border: 0, borderRadius: 12 }}
      loading="lazy"
    />
  );
}
