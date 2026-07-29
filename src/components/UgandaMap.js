import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';

// Simplified paths for 12 regions (scaled to 400x400)
const regionPaths = {
  'West Nile': 'M40,40 L70,30 L90,40 L85,60 L60,70 L40,60 Z',
  'Acholi': 'M90,40 L120,30 L140,40 L135,60 L110,70 L90,60 Z',
  'Karamoja': 'M200,30 L230,20 L250,30 L245,50 L220,60 L200,50 Z',
  'Teso': 'M140,70 L170,60 L190,70 L185,90 L160,100 L140,90 Z',
  'Sebei': 'M230,70 L260,60 L280,70 L275,90 L250,100 L230,90 Z',
  'Bugisu': 'M190,110 L220,100 L240,110 L235,130 L210,140 L190,130 Z',
  'Bukedi': 'M240,130 L270,120 L290,130 L285,150 L260,160 L240,150 Z',
  'Buganda': 'M70,130 L100,120 L130,130 L125,160 L100,170 L70,160 Z',
  'Busoga': 'M130,150 L160,140 L180,150 L175,170 L150,180 L130,170 Z',
  'Toro': 'M40,140 L70,130 L90,140 L85,160 L60,170 L40,160 Z',
  'Ankole': 'M70,190 L100,180 L130,190 L125,210 L100,220 L70,210 Z',
  'Kigezi': 'M40,200 L70,190 L90,200 L85,220 L60,230 L40,220 Z',
};

export default function UgandaMap({ category, regionData }) {
  const getColor = (regionName) => {
    const data = regionData.find(d => d.region_name === regionName);
    if (!data) return '#E5E7EB';
    let score = 0;
    if (category === 'education') score = data.education_score || 0;
    else if (category === 'sports') score = data.sports_score || 0;
    else if (category === 'health') score = data.health_score || 0;
    if (score >= 80) return '#22C55E';
    if (score >= 70) return '#84CC16';
    if (score >= 60) return '#FBBF24';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.container}>
      <Svg width="100%" height="100%" viewBox="0 0 300 250">
        {Object.entries(regionPaths).map(([name, path]) => (
          <G key={name}>
            <Path
              d={path}
              fill={getColor(name)}
              stroke="#fff"
              strokeWidth="1.5"
            />
            {/* Region labels – small, white text */}
            <SvgText
              x="0"
              y="0"
              fontSize="5"
              fill="#fff"
              fontWeight="bold"
              // You can add text positioning manually if needed
            />
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 200,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    overflow: 'hidden',
  },
});