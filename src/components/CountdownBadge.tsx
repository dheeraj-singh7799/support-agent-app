import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Priority, Status } from '@/types/ticket';
import { calculateSla } from '@/services/sla/slaService';

interface CountdownBadgeProps {
  createdAt: string;
  priority: Priority;
  status: Status;
}

export const CountdownBadge = memo(function CountdownBadge({
  createdAt,
  priority,
  status,
}: CountdownBadgeProps) {
  const [sla, setSla] = useState(() => calculateSla(createdAt, priority, status));
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    // If ticket is resolved or closed, SLA is fulfilled — no ticking needed!
    if (status === 'resolved' || status === 'closed') {
      setSla(calculateSla(createdAt, priority, status));
      return;
    }

    // Isolated 1-second interval for this badge only
    const timer = setInterval(() => {
      setSla(calculateSla(createdAt, priority, status));
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt, priority, status]);

  // Color schemes based on SLA urgency
  const getBadgeColors = () => {
    switch (sla.badgeType) {
      case 'late':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
          text: isDark ? '#FCA5A5' : '#B91C1C',
          border: isDark ? '#EF4444' : '#DC2626',
        };
      case 'at_risk':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
          text: isDark ? '#FCD34D' : '#B45309',
          border: isDark ? '#F59E0B' : '#D97706',
        };
      case 'future':
        return {
          bg: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF',
          text: isDark ? '#A5B4FC' : '#4338CA',
          border: isDark ? '#6366F1' : '#4F46E5',
        };
      case 'on_track':
      default:
        return {
          bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5',
          text: isDark ? '#6EE7B7' : '#047857',
          border: isDark ? '#10B981' : '#059669',
        };
    }
  };

  const colors = getBadgeColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
      accessible={true}
      accessibilityLabel={`SLA Status: ${sla.statusText}, time remaining: ${sla.formattedCountdown}`}
    >
      <View style={[styles.dot, { backgroundColor: colors.border }]} />
      <Text style={[styles.statusText, { color: colors.text }]} numberOfLines={1}>
        {sla.statusText}
      </Text>
      <Text style={[styles.timerText, { color: colors.text }]} numberOfLines={1}>
        {sla.formattedCountdown}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    maxWidth: 160,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
