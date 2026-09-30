import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { Ticket } from '@/types/ticket';
import { CountdownBadge } from './CountdownBadge';

interface TicketCardProps {
  ticket: Ticket;
  currentAgentId?: string;
}

export const TicketCard = memo(function TicketCard({ ticket, currentAgentId }: TicketCardProps) {
  const isDark = useColorScheme() === 'dark';

  const handlePress = () => {
    router.push(`/tickets/${ticket.external_id}` as any);
  };

  // Safe fallback for empty subject (Edge case T-2006)
  const displaySubject = ticket.subject && ticket.subject.trim().length > 0
    ? ticket.subject
    : '(No Subject Provided)';

  const isAssignedToMe = currentAgentId && ticket.assigned_to === currentAgentId;

  // Priority badge styling
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'P0':
        return { bg: '#FEE2E2', text: '#DC2626', border: '#EF4444' };
      case 'P1':
        return { bg: '#FFEDD5', text: '#C2410C', border: '#F97316' };
      case 'P2':
        return { bg: '#FEF9C3', text: '#A16207', border: '#EAB308' };
      case 'P3':
        return { bg: '#F1F5F9', text: '#475569', border: '#94A3B8' };
      default:
        // E.g., P5
        return { bg: '#EDE9FE', text: '#6D28D9', border: '#8B5CF6' };
    }
  };

  // Status badge styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'open':
        return { bg: '#E0F2FE', text: '#0369A1' };
      case 'in_progress':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'resolved':
        return { bg: '#DCFCE7', text: '#15803D' };
      case 'closed':
        return { bg: '#F3F4F6', text: '#6B7280' };
      default:
        return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  const pStyle = getPriorityStyle(ticket.priority);
  const sStyle = getStatusStyle(ticket.status);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E2E8F0',
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Ticket ${ticket.external_id}: ${displaySubject}, Priority ${ticket.priority}, Status ${ticket.status}`}
    >
      <View style={styles.topRow}>
        <View style={styles.idContainer}>
          <Text style={[styles.ticketId, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {ticket.external_id}
          </Text>
          {ticket.isOptimistic && (
            <View style={styles.optimisticTag}>
              <Text style={styles.optimisticText}>Syncing...</Text>
            </View>
          )}
          {isAssignedToMe && (
            <View style={styles.mineTag}>
              <Text style={styles.mineText}>MINE</Text>
            </View>
          )}
        </View>

        {/* Live Countdown Badge */}
        <CountdownBadge
          createdAt={ticket.created_at}
          priority={ticket.priority}
          status={ticket.status}
        />
      </View>

      {/* Subject */}
      <Text
        style={[
          styles.subject,
          { color: isDark ? '#F8FAFC' : '#0F172A' },
        ]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {displaySubject}
      </Text>

      {/* Badges footer */}
      <View style={styles.bottomRow}>
        <View style={styles.badgesGroup}>
          {/* Priority Badge */}
          <View style={[styles.badge, { backgroundColor: pStyle.bg, borderColor: pStyle.border }]}>
            <Text style={[styles.badgeText, { color: pStyle.text }]}>{ticket.priority}</Text>
          </View>

          {/* Status Badge */}
          <View style={[styles.badge, { backgroundColor: sStyle.bg }]}>
            <Text style={[styles.badgeText, { color: sStyle.text }]}>
              {ticket.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          {/* Customer Plan */}
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  ticket.customer_plan === 'enterprise' ? '#FDF2F8' : isDark ? '#334155' : '#F1F5F9',
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color:
                    ticket.customer_plan === 'enterprise'
                      ? '#BE185D'
                      : isDark
                      ? '#CBD5E1'
                      : '#475569',
                },
              ]}
            >
              {ticket.customer_plan.toUpperCase()}
            </Text>
          </View>
        </View>

        {ticket.assigned_to && (
          <Text style={[styles.assigneeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {ticket.assigned_to}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketId: {
    fontSize: 13,
    fontWeight: '700',
  },
  optimisticTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  optimisticText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '600',
  },
  mineTag: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mineText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subject: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  assigneeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
