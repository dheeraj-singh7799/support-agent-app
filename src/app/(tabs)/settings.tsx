import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  Alert,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store';
import { logoutAgent } from '@/store/slices/authSlice';
import { fakeApi } from '@/services/api/fakeApiServer';
import { showToast } from '@/store/slices/offlineSlice';
import { fetchTickets } from '@/store/slices/ticketsSlice';

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';

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
            await dispatch(logoutAgent());
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' }]}
      contentContainerStyle={styles.content}
    >
      {/* Agent Card */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.agentRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{agent?.name?.[0] || 'A'}</Text>
          </View>
          <View style={styles.agentMeta}>
            <Text style={[styles.agentName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              {agent?.name || 'Unknown Agent'}
            </Text>
            <Text style={[styles.agentId, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              ID: {agent?.id}
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Pending Outbox Changes:
          </Text>
          <Text style={[styles.statVal, { color: pendingCount > 0 ? '#F59E0B' : '#10B981' }]}>
            {pendingCount}
          </Text>
        </View>
      </View>

      {/* Simulator Controls */}
      <Text style={[styles.sectionTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
        EVALUATION / SIMULATION CONTROLS
      </Text>
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              Simulate 10% Network Errors
            </Text>
            <Text style={[styles.settingDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              About 1 request in 10 fails with HTTP 500
            </Text>
          </View>
          <Switch value={simulateErrors} onValueChange={handleToggleErrors} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              Simulate 25% Claim Conflicts (409)
            </Text>
            <Text style={[styles.settingDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              About 1 claim in 4 fails with conflict
            </Text>
          </View>
          <Switch value={simulateConflicts} onValueChange={handleToggleConflicts} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              Background Ticket Activity
            </Text>
            <Text style={[styles.settingDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Simulate incoming tickets & other agents every 5-10s
            </Text>
          </View>
          <Switch value={backgroundActivity} onValueChange={handleToggleBackground} />
        </View>

        <Pressable onPress={handleResetDatabase} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>↺ Re-seed 5,000 Mock Tickets</Text>
        </Pressable>
      </View>

      {/* Sign Out Button */}
      <Pressable onPress={handleLogout} style={styles.logoutBtn} accessibilityRole="button">
        <Text style={styles.logoutBtnText}>Sign Out & Clear Local Data</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  agentMeta: {
    flex: 1,
  },
  agentName: {
    fontSize: 18,
    fontWeight: '800',
  },
  agentId: {
    fontSize: 13,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
  },
  settingInfo: {
    flex: 1,
    paddingRight: 10,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  resetBtn: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
});
