import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, SPACE, TYPE } from '../theme';

/** Plain text with "## Heading" lines, "- bullet" lines and blank-line paragraphs. */
export default function RichText({ text }) {
  const blocks = String(text || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <View style={{ gap: SPACE.md }}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        return (
          <View key={i} style={{ gap: 6 }}>
            {lines.map((line, j) => {
              if (line.startsWith('## ')) return <Text key={j} style={[TYPE.h3, { marginTop: i ? SPACE.sm : 0 }]} accessibilityRole="header">{line.slice(3)}</Text>;
              if (line.startsWith('- ')) {
                return (
                  <View key={j} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
                    <Text style={[TYPE.body, { color: COLORS.primary }]}>•</Text>
                    <Text style={[TYPE.body, { flex: 1, color: COLORS.gray800 }]}>{line.slice(2)}</Text>
                  </View>
                );
              }
              return <Text key={j} style={[TYPE.body, { color: COLORS.gray800 }]}>{line}</Text>;
            })}
          </View>
        );
      })}
    </View>
  );
}
