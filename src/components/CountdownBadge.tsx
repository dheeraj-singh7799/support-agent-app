import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Priority, Status } from '@/types/ticket';
import { calculateSla } from '@/services/sla/slaService';

interface CountdownBadgeProps {
  createdAt: string;
  priority: Priority;
  status: Status;
  showBadgeBackground?: boolean;
}

export const CountdownBadge = memo(function CountdownBadge({
  createdAt,
  priority,
  status,
  showBadgeBackground = false,
}: CountdownBadgeProps) {
  const [sla, setSla] = useState(() => calculateSla(createdAt, priority, status));

  useEffect(() => {
    if (status === 'resolved' || status === 'closed') {
      setSla(calculateSla(createdAt, priority, status));
      return;
    }

    const timer = setInterval(() => {
      setSla(calculateSla(createdAt, priority, status));
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt, priority, status]);

  // Urgency color matching the design mockup:
  const getColor = () => {
    switch (priority) {
      case 'P0':
        return '#EF4444';
      case 'P1':
        return '#F97316';
      case 'P2':
        return '#F59E0B';
      case 'P3':
      default:
        return '#10B981';
    }
  };

  const color = getColor();

  if (!showBadgeBackground) {
    // Exact match for Screen 2 mockup: crisp bold countdown in priority color
    return (
      <View style={styles.container} accessible={true} accessibilityLabel={`SLA remaining: ${sla.formattedCountdown}`}>
        <Text style={[styles.cleanTimerText, { color }]}>
          {sla.formattedCountdown}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}15`,
          borderColor: color,
        },
      ]}
      accessible={true}
      accessibilityLabel={`SLA Status: ${sla.statusText}, time remaining: ${sla.formattedCountdown}`}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>
        {sla.statusText}
      </Text>
      <Text style={[styles.timerText, { color }]}>
        {sla.formattedCountdown}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cleanTimerText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
