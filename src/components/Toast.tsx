import React, { useEffect } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/store';
import { hideToast } from '@/store/slices/offlineSlice';

export function Toast() {
  const dispatch = useAppDispatch();
  const { toastMessage, toastType } = useAppSelector((state) => state.offline);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        dispatch(hideToast());
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, dispatch]);

  if (!toastMessage) return null;

  const getBgColor = () => {
    switch (toastType) {
      case 'error':
        return '#EF4444';
      case 'success':
        return '#10B981';
      case 'info':
      default:
        return '#3B82F6';
    }
  };

  return (
    <Pressable
      onPress={() => dispatch(hideToast())}
      style={[styles.container, { backgroundColor: getBgColor() }]}
      accessibilityRole="alert"
    >
      <Text style={styles.text}>{toastMessage}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
