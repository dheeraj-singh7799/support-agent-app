import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppSelector } from '@/store';

export function OfflineBanner() {
  const { isOnline, pendingCount } = useAppSelector((state) => state.offline);

  // If online and nothing pending, don't show
  if (isOnline && pendingCount === 0) {
    return null;
  }

  const isOffline = !isOnline;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isOffline ? '#DC2626' : '#D97706' },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={
        isOffline
          ? `Offline mode active. ${pendingCount} changes waiting to sync.`
          : `Syncing ${pendingCount} changes to server.`
      }
    >
      <View style={styles.content}>
        {isOffline ? (
          <View style={styles.dot} />
        ) : (
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
        )}
        <Text style={styles.text}>
          {isOffline
            ? `Offline • ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`
            : `Syncing ${pendingCount} pending change${pendingCount === 1 ? '' : 's'}...`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  spinner: {
    marginRight: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
