import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/store';
import { loginAgent, clearAuthError } from '@/store/slices/authSlice';
import { KNOWN_AGENTS } from '@/types/ticket';
import { fakeApi } from '@/services/api/fakeApiServer';

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('agent-1');
  const [pin, setPin] = useState<string>('1234');
  const [pickerVisible, setPickerVisible] = useState<boolean>(false);

  const selectedAgent = KNOWN_AGENTS.find((a) => a.id === selectedAgentId) || KNOWN_AGENTS[0];

  const handleLogin = async () => {
    if (pin.length !== 4) return;

    dispatch(clearAuthError());
    const result = await dispatch(loginAgent({ agentId: selectedAgentId, pin }));
    if (loginAgent.fulfilled.match(result)) {
      fakeApi.startBackgroundSimulation();
      router.replace('/(tabs)/tickets' as any);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Branding */}
        <View style={styles.header}>
          <View style={styles.iconRing}>
            <View style={styles.iconCircle}>
              <Ionicons name="headset" size={44} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.appTitle}>Support Agent</Text>
          <Text style={styles.appSubtitle}>Customer Support Made Simple</Text>
        </View>

        {/* Center Floating White Card */}
        <View style={styles.loginCard}>
          {/* Select Agent Dropdown */}
          <Text style={styles.fieldLabel}>Select Agent</Text>
          <Pressable
            onPress={() => setPickerVisible(true)}
            style={styles.dropdownBtn}
            accessibilityRole="combobox"
            accessibilityLabel={`Selected agent: ${selectedAgent.name}`}
          >
            <View style={styles.dropdownLeft}>
              <Ionicons name="person-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
              <Text style={styles.dropdownText}>{selectedAgent.name}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#64748B" />
          </Pressable>

          {/* 4-Digit PIN */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Enter 4-digit PIN</Text>
          <TextInput
            style={[styles.pinInput, error ? styles.pinInputError : null]}
            placeholder="••••"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            value={pin}
            onChangeText={(text) => {
              setPin(text.replace(/[^0-9]/g, ''));
              if (error) dispatch(clearAuthError());
            }}
            accessibilityLabel="Enter 4-digit PIN"
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Sign In Button */}
          <Pressable
            onPress={handleLogin}
            disabled={pin.length !== 4 || isLoading}
            style={({ pressed }) => [
              styles.signInBtn,
              {
                backgroundColor: pin.length === 4 ? '#2563EB' : '#93C5FD',
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInBtnText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Demo App • Expo</Text>
        </View>
      </ScrollView>

      {/* Agent Selection Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Agent Profile</Text>
            {KNOWN_AGENTS.map((agent) => {
              const isSelected = agent.id === selectedAgentId;
              return (
                <Pressable
                  key={agent.id}
                  onPress={() => {
                    setSelectedAgentId(agent.id);
                    setPickerVisible(false);
                  }}
                  style={[styles.agentOption, isSelected ? styles.agentOptionSelected : null]}
                >
                  <View style={styles.agentOptionAvatar}>
                    <Text style={styles.agentOptionAvatarText}>{agent.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.agentOptionName}>{agent.name}</Text>
                    <Text style={styles.agentOptionId}>{agent.id}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="#2563EB" />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E40AF', // Deep Royal Blue background
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 48,
    minHeight: '100%',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  pinInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '700',
    letterSpacing: 6,
  },
  pinInputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  signInBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  agentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  agentOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  agentOptionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  agentOptionAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  agentOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  agentOptionId: {
    fontSize: 12,
    color: '#64748B',
  },
});
