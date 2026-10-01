import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { Ticket } from '@/types/ticket';
import { CountdownBadge } from './CountdownBadge';

interface TicketCardProps {
  ticket: Ticket;
  currentAgentId?: string;
}

function getRelativeTime(dateStr: string): string {
  try {
    const createdMs = new Date(dateStr).getTime();
    if (isNaN(createdMs)) return '1m';
    const diffMin = Math.max(1, Math.floor((Date.now() - createdMs) / 60000));
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  } catch {
    return '2m';
  }
}

export const TicketCard = memo(function TicketCard({ ticket, currentAgentId }: TicketCardProps) {
  const isDark = useColorScheme() === 'dark';

  const handlePress = () => {
    router.push(`/tickets/${ticket.external_id}` as any);
  };

  const displaySubject = ticket.subject && ticket.subject.trim().length > 0
    ? ticket.subject
    : '(No Subject Provided)';

  const isAssignedToMe = currentAgentId && ticket.assigned_to === currentAgentId;
  const relativeTime = getRelativeTime(ticket.created_at);

  // Priority solid pill color matching Screen 2
  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case 'P0':
        return '#EF4444';
      case 'P1':
        return '#F97316';
      case 'P2':
        return '#F59E0B';
      case 'P3':
      default:
        return '#10B981';
    }
  };

  const priorityColor = getPriorityBadgeColor(ticket.priority);

  // Status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return { bg: '#EFF6FF', text: '#2563EB', label: 'Open' };
      case 'in_progress':
        return { bg: '#FEF3C7', text: '#D97706', label: 'In Progress' };
      case 'resolved':
        return { bg: '#DCFCE7', text: '#16A34A', label: 'Resolved' };
      case 'closed':
      default:
        return { bg: '#F1F5F9', text: '#64748B', label: 'Closed' };
    }
  };

  const statusBadge = getStatusBadge(ticket.status);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#F1F5F9',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Ticket ${ticket.external_id}: ${displaySubject}`}
    >
      <View style={styles.cardContent}>
        {/* Left Solid Priority Pill */}
        <View style={[styles.priorityPill, { backgroundColor: priorityColor }]}>
          <Text style={styles.priorityPillText}>{ticket.priority}</Text>
        </View>

        {/* Right Info Section */}
        <View style={styles.infoCol}>
          {/* Header Row: Ticket ID + Relative time */}
          <View style={styles.topRow}>
            <View style={styles.idWrap}>
              <Text style={[styles.ticketId, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                {ticket.external_id}
              </Text>
              {isAssignedToMe && (
                <View style={styles.mineTag}>
                  <Text style={styles.mineText}>MINE</Text>
                </View>
              )}
              {ticket.isOptimistic && (
                <View style={styles.optimisticTag}>
                  <Text style={styles.optimisticText}>Syncing...</Text>
                </View>
              )}
            </View>
            <Text style={styles.timeText}>{relativeTime}</Text>
          </View>

          {/* Subject */}
          <Text
            style={[styles.subject, { color: isDark ? '#E2E8F0' : '#334155' }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {displaySubject}
          </Text>

          {/* Bottom Row: Plan + Status on left, Countdown on right */}
          <View style={styles.bottomRow}>
            <View style={styles.tagsRow}>
              {/* Plan Tag */}
              <View style={styles.planTag}>
                <Text style={styles.planTagText}>
                  {ticket.customer_plan.toUpperCase()}
                </Text>
              </View>

              {/* Status Tag */}
              <View style={[styles.statusTag, { backgroundColor: statusBadge.bg }]}>
                <Text style={[styles.statusTagText, { color: statusBadge.text }]}>
                  {statusBadge.label}
                </Text>
              </View>
            </View>

            {/* Countdown timer matching priority color */}
            <CountdownBadge
              createdAt={ticket.created_at}
              priority={ticket.priority}
              status={ticket.status}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priorityPill: {
    width: 32,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  priorityPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  infoCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  idWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketId: {
    fontSize: 14,
    fontWeight: '800',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  mineTag: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mineText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  optimisticTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  optimisticText: {
    color: '#D97706',
    fontSize: 9,
    fontWeight: '700',
  },
  subject: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  planTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
