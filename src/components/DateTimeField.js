import React from 'react';
import { TextInput } from 'react-native';

// Native fallback: this app is currently deployed as a web build only (see
// DateTimeField.web.js for the real calendar/clock picker used there). A
// native build would swap this for @react-native-community/datetimepicker.
export default function DateTimeField({ mode = 'date', value, onChangeText, style, ...rest }) {
  return (
    <TextInput
      style={style}
      value={value || ''}
      onChangeText={onChangeText}
      placeholder={mode === 'time' ? 'HH:MM' : mode === 'datetime' ? 'YYYY-MM-DDTHH:MM' : 'YYYY-MM-DD'}
      {...rest}
    />
  );
}
