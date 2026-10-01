import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '@/store';

export function OfflineBanner() {
  const { isOnline, pendingCount } = useAppSelector((state) => state.offline);
  const [showRestored, setShowRestored] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      // Just came back online!
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  const isRestored = isOnline && showRestored;

  // If online, not recently restored, and no pending items, hide banner
  if (isOnline && !isRestored && pendingCount === 0) {
    return null;
  }

  if (!isOnline) {
    // Screen 6: Vibrant Red Offline Banner
    return (
      <View
        style={[styles.container, styles.offlineBg]}
        accessibilityRole="alert"
        accessibilityLabel={`You are offline. ${pendingCount} changes pending.`}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-offline" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>You are offline</Text>
          <Text style={styles.subtitle}>
            {pendingCount} change{pendingCount === 1 ? '' : 's'} pending
          </Text>
        </View>
      </View>
    );
  }

  // Screen 8: Vibrant Green Connection Restored Banner
  return (
    <View
      style={[styles.container, styles.onlineBg]}
      accessibilityRole="alert"
      accessibilityLabel={`Back online! Syncing ${pendingCount} pending changes.`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Back online!</Text>
        <Text style={styles.subtitle}>
          {pendingCount > 0
            ? `Syncing ${pendingCount} pending change${pendingCount === 1 ? '' : 's'}...`
            : 'All changes synced successfully.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    zIndex: 100,
  },
  offlineBg: {
    backgroundColor: '#EF4444',
  },
  onlineBg: {
    backgroundColor: '#10B981',
  },
  iconWrap: {
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
});
