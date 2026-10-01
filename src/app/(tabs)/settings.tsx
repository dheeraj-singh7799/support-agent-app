import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/store';
import { logoutAgent } from '@/store/slices/authSlice';
import { fakeApi } from '@/services/api/fakeApiServer';
import { showToast } from '@/store/slices/offlineSlice';
import { fetchTickets } from '@/store/slices/ticketsSlice';

export default function SettingsScreen() {
  const dispatch = useAppDispatch();

  const agent = useAppSelector((state) => state.auth.agent);
  const pendingCount = useAppSelector((state) => state.offline.pendingCount);

  // Simulation controls
  const [simulateErrors, setSimulateErrors] = useState(true);
  const [simulateConflicts, setSimulateConflicts] = useState(true);
  const [backgroundActivity, setBackgroundActivity] = useState(true);

  const handleToggleErrors = (val: boolean) => {
    setSimulateErrors(val);
    fakeApi.setConfig({ simulateErrors: val });
  };

  const handleToggleConflicts = (val: boolean) => {
    setSimulateConflicts(val);
    fakeApi.setConfig({ simulateClaimConflicts: val });
  };

  const handleToggleBackground = (val: boolean) => {
    setBackgroundActivity(val);
    fakeApi.setConfig({ enableBackgroundActivity: val });
    if (val) {
      fakeApi.startBackgroundSimulation();
    } else {
      fakeApi.stopBackgroundSimulation();
    }
  };

  const handleResetDatabase = () => {
    Alert.alert(
      'Reset Mock Data',
      'This will re-initialize the 5,000 mock tickets and test cases.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            fakeApi.initDatabase();
            dispatch(fetchTickets({ filters: {}, page: 1, agentId: agent?.id }));
            dispatch(showToast({ message: 'Database reset to initial state.', type: 'info' }));
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Signing out will remove your saved session and all cached data about your profile from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            fakeApi.stopBackgroundSimulation();
            await dispatch(logoutAgent());
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Signature Blue Top App Bar matching Screen 10 */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Simulation Controls Section */}
        <Text style={styles.sectionHeading}>Simulation Controls</Text>
        <View style={styles.card}>
          {/* 500 Errors Toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Simulate 500 Errors</Text>
            <Switch
              value={simulateErrors}
              onValueChange={handleToggleErrors}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={simulateErrors ? '#2563EB' : '#FFFFFF'}
            />
          </View>

          {/* 409 Conflicts Toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Simulate 409 Conflicts</Text>
            <Switch
              value={simulateConflicts}
              onValueChange={handleToggleConflicts}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={simulateConflicts ? '#2563EB' : '#FFFFFF'}
            />
          </View>

          {/* Background Events Toggle */}
          <View style={[styles.switchRow, { borderBottomWidth: 0, marginBottom: 8 }]}>
            <Text style={styles.switchLabel}>Background Events</Text>
            <Switch
              value={backgroundActivity}
              onValueChange={handleToggleBackground}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={backgroundActivity ? '#2563EB' : '#FFFFFF'}
            />
          </View>

          {/* Reset Database Button */}
          <Pressable
            onPress={handleResetDatabase}
            style={({ pressed }) => [
              styles.resetBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset Database"
          >
            <Text style={styles.resetBtnText}>Reset Database</Text>
          </Pressable>
        </View>

        {/* Agent Profile Section */}
        <Text style={styles.sectionHeading}>Agent</Text>
        <View style={styles.card}>
          <View style={styles.agentRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={20} color="#2563EB" />
            </View>
            <View style={styles.agentMeta}>
              <Text style={styles.agentName}>{agent?.name || 'Priya'}</Text>
              <Text style={styles.agentEmail}>
                {agent ? `${agent.id}@company.com` : 'agent-1@company.com'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
          </View>

          {/* Sign Out Button */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.signOutBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign Out"
          >
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* App Info Footer */}
        <View style={styles.infoFooter}>
          <Text style={styles.infoFooterText}>Support Agent Mobile • Expo SDK 57</Text>
          <Text style={styles.infoFooterSub}>
            Offline queue items pending: {pendingCount}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appBar: {
    height: 56,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  appBarTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  resetBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  resetBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  agentMeta: {
    flex: 1,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  agentEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  signOutBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  infoFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  infoFooterText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  infoFooterSub: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 4,
  },
});
