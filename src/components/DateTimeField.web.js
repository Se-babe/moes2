import React from 'react';

// Web implementation: a real HTML5 date/time input, which every browser
// renders with its own native calendar/clock picker on click — no extra
// dependency needed. Metro picks this file automatically on web builds
// (see the plain DateTimeField.js sibling for the native fallback).
export default function DateTimeField({ mode = 'date', value, onChangeText, placeholderTextColor, style, ...rest }) {
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || {};
  // Postgres `time` columns come back as HH:MM:SS, but <input type="time">
  // expects HH:MM — trim it so the picker displays an existing value correctly.
  const displayValue = mode === 'time' && value ? value.slice(0, 5) : value || '';
  return (
    <input
      type={mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date'}
      value={displayValue}
      onChange={(e) => onChangeText && onChangeText(e.target.value)}
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: flatStyle.borderColor || '#E2E8F0',
        borderRadius: flatStyle.borderRadius ?? 8,
        padding: 12,
        marginBottom: flatStyle.marginBottom ?? 12,
        fontSize: flatStyle.fontSize ?? 16,
        color: flatStyle.color || '#0F172A',
        backgroundColor: flatStyle.backgroundColor || '#FFFFFF',
        fontFamily: 'inherit',
        width: '100%',
        boxSizing: 'border-box',
        colorScheme: 'light',
      }}
      {...rest}
    />
  );
}
