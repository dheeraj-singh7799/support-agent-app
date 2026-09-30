import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { useNetworkSync } from '@/hooks/useNetworkSync';
import { useUrgentAlerts } from '@/hooks/useUrgentAlerts';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Toast } from '@/components/Toast';

function AppContent() {
  const isDark = useColorScheme() === 'dark';

  // Initialize network sync and urgent P0 alerts
  useNetworkSync();
  useUrgentAlerts();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' }}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tickets/[id]" />
      </Stack>
      <Toast />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </Provider>
  );
}
