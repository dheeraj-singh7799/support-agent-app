import React from 'react';
import { Tabs } from 'expo-router';
import { Text, useColorScheme } from 'react-native';
import { useAppSelector } from '@/store';

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark';
  const tickets = useAppSelector((state) => state.tickets.items);
  const pendingReviewCount = tickets.filter((t) => t.triage_decision !== 'auto_accept').length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: isDark ? '#94A3B8' : '#64748B',
        tabBarStyle: {
          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          borderTopColor: isDark ? '#334155' : '#E2E8F0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="tickets/index"
        options={{
          title: 'Tickets',
          tabBarLabel: 'Queue',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="ai-review/index"
        options={{
          title: 'AI Review',
          tabBarLabel: 'AI Review',
          tabBarBadge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🤖</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
