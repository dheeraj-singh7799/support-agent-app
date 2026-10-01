import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface StatusModalProps {
  visible: boolean;
  type: 'success' | 'conflict' | 'queued' | 'info';
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
}

export function StatusModal({
  visible,
  type,
  title,
  message,
  buttonText = 'OK',
  onClose,
}: StatusModalProps) {
  if (!visible) return null;

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return {
          name: 'checkmark' as const,
          bgColor: '#10B981',
          btnColor: '#2563EB',
        };
      case 'conflict':
        return {
          name: 'alert' as const,
          bgColor: '#EF4444',
          btnColor: '#EF4444',
        };
      case 'queued':
        return {
          name: 'sync' as const,
          bgColor: '#F59E0B',
          btnColor: '#2563EB',
        };
      default:
        return {
          name: 'information' as const,
          bgColor: '#3B82F6',
          btnColor: '#2563EB',
        };
    }
  };

  const { name, bgColor, btnColor } = getIconConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Big Circular Icon */}
          <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
            <Ionicons name={name} size={36} color="#FFFFFF" />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Action Button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: btnColor, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={styles.actionButtonText}>{buttonText}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actionButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
