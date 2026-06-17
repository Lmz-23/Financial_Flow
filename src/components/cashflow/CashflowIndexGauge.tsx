import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, typography } from '../../theme';

interface CashflowIndexGaugeProps {
  percentage: number; // 0 to 100+
  size?: number;
}

export default function CashflowIndexGauge({ percentage, size = 200 }: CashflowIndexGaugeProps) {
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Clamp percentage for display (max 100 for full circle)
  const displayPercent = Math.min(Math.max(percentage, 0), 100);
  const progress = displayPercent / 100;
  const strokeDashoffset = circumference * (1 - progress);

  // Color based on coverage
  const getColor = () => {
    if (percentage >= 100) return colors.accentGreen;
    if (percentage >= 50) return colors.accentYellow;
    return colors.accentRed;
  };

  const color = getColor();

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surface2}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Center text */}
      <View style={[styles.centerContent, { width: size, height: size }]}>
        <Text style={[styles.percentageText, { color }]}>{percentage.toFixed(0)}%</Text>
        <Text style={styles.label}>Cobertura</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold,
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
});
