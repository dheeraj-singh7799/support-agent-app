import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store';
import { checkSavedSession } from '@/store/slices/authSlice';
import { fakeApi } from '@/services/api/fakeApiServer';

export default function IndexScreen() {
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const { isInitialized, token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Start background activity simulation
    fakeApi.startBackgroundSimulation();

    // Check if an existing session is saved on device
    dispatch(checkSavedSession());
  }, [dispatch]);

  useEffect(() => {
    if (isInitialized) {
      if (token) {
        router.replace('/(tabs)/tickets' as any);
      } else {
        router.replace('/login');
      }
    }
  }, [isInitialized, token]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' },
      ]}
    >
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
