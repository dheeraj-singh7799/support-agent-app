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
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store';
import { loginAgent, clearAuthError } from '@/store/slices/authSlice';
import { KNOWN_AGENTS } from '@/types/ticket';

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const isDark = useColorScheme() === 'dark';

  const [selectedAgentId, setSelectedAgentId] = useState<string>('agent-1');
  const [pin, setPin] = useState<string>('');

  const handleLogin = async () => {
    if (pin.length !== 4) return;

    dispatch(clearAuthError());
    const result = await dispatch(loginAgent({ agentId: selectedAgentId, pin }));
    if (loginAgent.fulfilled.match(result)) {
      router.replace('/(tabs)/tickets' as any);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🎧</Text>
          </View>
          <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            Support Agent
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Sign in to access and manage live queue tickets on the move
          </Text>
        </View>

        {/* Agent Selector */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: isDark ? '#CBD5E1' : '#334155' }]}>
            SELECT AGENT PROFILE
          </Text>
          <View style={styles.agentList}>
            {KNOWN_AGENTS.map((agent) => {
              const isSelected = selectedAgentId === agent.id;
              return (
                <Pressable
                  key={agent.id}
                  onPress={() => setSelectedAgentId(agent.id)}
                  style={[
                    styles.agentCard,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? '#1E3A8A'
                          : '#EFF6FF'
                        : isDark
                        ? '#1E293B'
                        : '#FFFFFF',
                      borderColor: isSelected
                        ? '#3B82F6'
                        : isDark
                        ? '#334155'
                        : '#E2E8F0',
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${agent.name} (${agent.id})`}
                >
                  <View style={[styles.avatar, { backgroundColor: isSelected ? '#3B82F6' : '#94A3B8' }]}>
                    <Text style={styles.avatarText}>{agent.name[0]}</Text>
                  </View>
                  <View style={styles.agentInfo}>
                    <Text
                      style={[
                        styles.agentName,
                        { color: isSelected ? (isDark ? '#93C5FD' : '#1D4ED8') : isDark ? '#F1F5F9' : '#0F172A' },
                      ]}
                    >
                      {agent.name}
                    </Text>
                    <Text style={[styles.agentId, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {agent.id}
                    </Text>
                  </View>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 4-Digit PIN */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: isDark ? '#CBD5E1' : '#334155' }]}>
            4-DIGIT PIN
          </Text>
          <TextInput
            style={[
              styles.pinInput,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: error ? '#EF4444' : isDark ? '#334155' : '#CBD5E1',
                color: isDark ? '#F8FAFC' : '#0F172A',
              },
            ]}
            placeholder="••••"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
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
          <Text style={[styles.hint, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Use default PIN <Text style={{ fontWeight: '700' }}>1234</Text> for any agent.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Submit Button */}
        <Pressable
          onPress={handleLogin}
          disabled={pin.length !== 4 || isLoading}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: pin.length === 4 ? '#2563EB' : isDark ? '#334155' : '#CBD5E1',
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sign In"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Sign In</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  agentList: {
    gap: 10,
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '700',
  },
  agentId: {
    fontSize: 12,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3B82F6',
    marginRight: 6,
  },
  pinInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 10,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
