import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';

const COLORS = {
  primary: '#1E3A8A',
  gray500: '#64748B',
  gray700: '#334155',
  white: '#FFFFFF',
};

export default function PieChart({ data, size = 200, innerRadius = 60 }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2 - 10;
  const center = size / 2;

  let startAngle = -90;
  const segments = data.map((item) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const endAngle = startAngle + angle;
    const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
    const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
    const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
    const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);
    const largeArc = angle > 180 ? 1 : 0;
    const path = `
      M ${center} ${center}
      L ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      Z
    `;
    const result = { path, color: item.color, label: item.label, value: item.value };
    startAngle = endAngle;
    return result;
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, idx) => (
          <Path key={idx} d={seg.path} fill={seg.color} stroke={COLORS.white} strokeWidth="2" />
        ))}
        <Circle cx={center} cy={center} r={innerRadius} fill={COLORS.white} />
        <SvgText x={center} y={center-6} textAnchor="middle" fontSize="16" fontWeight="bold" fill={COLORS.primary}>
          {total}
        </SvgText>
        <SvgText x={center} y={center+16} textAnchor="middle" fontSize="12" fill={COLORS.gray500}>
          Total
        </SvgText>
      </Svg>
      <View style={styles.legend}>
        {data.map((item, idx) => (
          <View key={idx} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label} ({item.value})</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.gray700,
  },
});