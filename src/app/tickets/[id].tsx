import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  BackHandler,
  Linking,
  useColorScheme,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchTicketById,
  optimisticClaim,
  optimisticStatusUpdate,
  rollbackTicket,
  ticketUpdatedFromRemote,
} from '@/store/slices/ticketsSlice';
import { showToast } from '@/store/slices/offlineSlice';
import { syncQueue } from '@/services/offline/syncQueue';
import { fakeApi } from '@/services/api/fakeApiServer';
import { CountdownBadge } from '@/components/CountdownBadge';
import { HtmlViewer } from '@/components/HtmlViewer';
import { validateUrl } from '@/services/security/sanitizer';
import { Status, Ticket } from '@/types/ticket';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';

  const currentAgent = useAppSelector((state) => state.auth.agent);
  const isOnline = useAppSelector((state) => state.offline.isOnline);
  const ticketFromList = useAppSelector((state) =>
    state.tickets.items.find((t) => t.external_id === id)
  );
  const selectedTicket = useAppSelector((state) => state.tickets.selectedTicket);

  const ticket: Ticket | undefined = ticketFromList || selectedTicket || undefined;
  const [isMutating, setIsMutating] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Android Back Button: Must return to the list, NEVER exit the app from ticket screen
  useEffect(() => {
    const onBackPress = () => {
      router.replace('/(tabs)/tickets' as any);
      return true; // handled, do not exit app
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  // 2. Fetch ticket details if not preloaded
  useEffect(() => {
    if (id && !ticket) {
      dispatch(fetchTicketById(id));
    }
  }, [id, ticket, dispatch]);

  // Handle Optimistic Claim
  const handleClaim = useCallback(async () => {
    if (!ticket || !currentAgent || isMutating) return;

    // Debounce to prevent multiple taps
    if (debounceTimerRef.current) return;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
    }, 1000);

    const previousState: Partial<Ticket> = {
      assigned_to: ticket.assigned_to,
      status: ticket.status,
    };

    // 1. Optimistic UI update immediately
    dispatch(optimisticClaim({ ticketId: ticket.external_id, agentId: currentAgent.id }));
    setIsMutating(true);

    if (!isOnline) {
      // Offline mode: enqueue in persistent outbox
      await syncQueue.enqueue({
        type: 'CLAIM',
        ticketId: ticket.external_id,
        agentId: currentAgent.id,
        payload: {},
        previousState,
      });
      dispatch(
        showToast({
          message: 'Claim saved offline. Will sync when connection returns.',
          type: 'info',
        })
      );
      setIsMutating(false);
      return;
    }

    // Online mode: execute directly against API
    try {
      const updated = await fakeApi.claimTicket(ticket.external_id, currentAgent.id);
      dispatch(ticketUpdatedFromRemote(updated));
      dispatch(showToast({ message: 'Ticket claimed successfully!', type: 'success' }));
    } catch (err: any) {
      // "If the server says no, undo the change and tell the agent what happened."
      dispatch(rollbackTicket({ ticketId: ticket.external_id, previousState }));
      dispatch(
        showToast({
          message: `Claim failed: ${err.message}`,
          type: 'error',
        })
      );
    } finally {
      setIsMutating(false);
    }
  }, [ticket, currentAgent, isMutating, isOnline, dispatch]);

  // Handle Allowed Status Transition
  const handleStatusChange = useCallback(
    async (nextStatus: Status) => {
      if (!ticket || !currentAgent || isMutating) return;

      // Debounce: "Tapping twice quickly must not send two requests."
      if (debounceTimerRef.current) return;
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
      }, 1000);

      const previousState: Partial<Ticket> = {
        status: ticket.status,
        assigned_to: ticket.assigned_to,
      };

      // 1. Optimistic UI update immediately
      dispatch(
        optimisticStatusUpdate({
          ticketId: ticket.external_id,
          newStatus: nextStatus,
          agentId: currentAgent.id,
        })
      );
      setIsMutating(true);

      if (!isOnline) {
        // Offline mode: enqueue in persistent outbox
        await syncQueue.enqueue({
          type: 'UPDATE_STATUS',
          ticketId: ticket.external_id,
          agentId: currentAgent.id,
          payload: { status: nextStatus },
          previousState,
        });
        dispatch(
          showToast({
            message: `Status moved to ${nextStatus} offline. Saved to queue.`,
            type: 'info',
          })
        );
        setIsMutating(false);
        return;
      }

      // Online mode: call API
      try {
        const updated = await fakeApi.updateStatus(ticket.external_id, nextStatus, currentAgent.id);
        dispatch(ticketUpdatedFromRemote(updated));
        dispatch(
          showToast({
            message: `Status updated to ${nextStatus}`,
            type: 'success',
          })
        );
      } catch (err: any) {
        // Server rejected move -> rollback and alert
        dispatch(rollbackTicket({ ticketId: ticket.external_id, previousState }));
        dispatch(
          showToast({
            message: `Status move rejected: ${err.message}`,
            type: 'error',
          })
        );
      } finally {
        setIsMutating(false);
      }
    },
    [ticket, currentAgent, isMutating, isOnline, dispatch]
  );

  // Handle Attachment link click with strict security validation
  const handleOpenAttachment = (url: string | null) => {
    const result = validateUrl(url);
    if (!result.isSafe || !result.sanitizedUrl) {
      Alert.alert(
        'Blocked Unsafe Attachment',
        `This attachment link was blocked for your safety:\n"${url}"\nReason: ${result.reason || 'Invalid link'}`
      );
      return;
    }

    Linking.openURL(result.sanitizedUrl).catch(() => {
      Alert.alert('Error', 'Unable to open attachment link.');
    });
  };

  if (!ticket) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={[styles.loadingText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          Loading ticket details...
        </Text>
      </View>
    );
  }

  // Allowed transitions logic:
  // "Offer only the allowed next steps: open -> in_progress -> resolved , and resolved -> open"
  let allowedNextSteps: { label: string; status: Status; color: string }[] = [];
  if (ticket.status === 'open') {
    allowedNextSteps = [{ label: 'Start Progress', status: 'in_progress', color: '#F59E0B' }];
  } else if (ticket.status === 'in_progress') {
    allowedNextSteps = [{ label: 'Mark Resolved', status: 'resolved', color: '#10B981' }];
  } else if (ticket.status === 'resolved') {
    allowedNextSteps = [{ label: 'Re-open Ticket', status: 'open', color: '#3B82F6' }];
  }

  const isAssignedToMe = currentAgent && ticket.assigned_to === currentAgent.id;
  const canClaim = !isAssignedToMe && ticket.status !== 'resolved' && ticket.status !== 'closed';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' }]}
      contentContainerStyle={styles.content}
    >
      {/* Back button header */}
      <Pressable
        onPress={() => router.replace('/(tabs)/tickets' as any)}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back to tickets list"
      >
        <Text style={[styles.backBtnText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
          ← Back to Queue
        </Text>
      </Pressable>

      {/* Header Info */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.topRow}>
          <Text style={[styles.ticketId, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {ticket.external_id}
          </Text>
          <CountdownBadge
            createdAt={ticket.created_at}
            priority={ticket.priority}
            status={ticket.status}
          />
        </View>

        <Text style={[styles.subject, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          {ticket.subject || '(No Subject)'}
        </Text>

        {/* Customer & Plan row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Customer
            </Text>
            <Text style={[styles.metaVal, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
              {ticket.customer_id}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Plan
            </Text>
            <Text
              style={[
                styles.metaVal,
                { color: ticket.customer_plan === 'enterprise' ? '#DB2777' : isDark ? '#E2E8F0' : '#1E293B' },
              ]}
            >
              {ticket.customer_plan.toUpperCase()}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Priority
            </Text>
            <Text style={[styles.metaVal, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
              {ticket.priority}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Status
            </Text>
            <Text style={[styles.metaVal, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
              {ticket.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Assignee banner */}
        <View style={styles.assigneeRow}>
          <Text style={[styles.assigneeLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Assigned to:
          </Text>
          <Text style={[styles.assigneeValue, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
            {ticket.assigned_to ? ticket.assigned_to : 'Unassigned'}
            {isAssignedToMe ? ' (You)' : ''}
          </Text>
        </View>
      </View>

      {/* Action Buttons: Claim and Status Transitions */}
      <View style={styles.actionsContainer}>
        {canClaim && (
          <Pressable
            onPress={handleClaim}
            disabled={isMutating}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: '#2563EB', opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Claim Ticket"
          >
            <Text style={styles.actionBtnText}>Claim This Ticket</Text>
          </Pressable>
        )}

        {allowedNextSteps.map((step) => (
          <Pressable
            key={step.status}
            onPress={() => handleStatusChange(step.status)}
            disabled={isMutating}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: step.color, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={step.label}
          >
            <Text style={styles.actionBtnText}>{step.label}</Text>
          </Pressable>
        ))}

        {ticket.status === 'closed' && (
          <View style={styles.closedNotice}>
            <Text style={styles.closedText}>This ticket is archived and closed.</Text>
          </View>
        )}
      </View>

      {/* AI Triage Card */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.aiHeader}>
          <Text style={styles.aiIcon}>🤖</Text>
          <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            AI Triage Analysis
          </Text>
        </View>

        <View style={styles.aiDetailRow}>
          <Text style={[styles.aiLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Decision:</Text>
          <View
            style={[
              styles.aiBadge,
              {
                backgroundColor:
                  ticket.triage_decision === 'auto_accept' ? '#DCFCE7' : '#FEF3C7',
              },
            ]}
          >
            <Text
              style={[
                styles.aiBadgeText,
                {
                  color:
                    ticket.triage_decision === 'auto_accept' ? '#166534' : '#B45309',
                },
              ]}
            >
              {ticket.triage_decision.toUpperCase()}
            </Text>
          </View>
        </View>

        {ticket.review_reason && (
          <View style={styles.aiDetailRow}>
            <Text style={[styles.aiLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Reason:
            </Text>
            <Text style={[styles.aiValue, { color: isDark ? '#CBD5E1' : '#334155' }]}>
              {ticket.review_reason}
            </Text>
          </View>
        )}

        <View style={styles.aiSummaryContainer}>
          <Text style={[styles.aiLabel, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 4 }]}>
            Summary:
          </Text>
          {/* AI summary sanitized in case AI output contained malicious markup (T-2011) */}
          <HtmlViewer html={ticket.summary} fallbackText="(No AI summary provided)" />
        </View>
      </View>

      {/* Customer Body (HTML Safe Rendering) */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 10 }]}>
          Customer Message
        </Text>
        <HtmlViewer html={ticket.body} fallbackText="(Customer did not provide a message body)" />
      </View>

      {/* Attachment Link */}
      {ticket.attachment_url && (
        <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 8 }]}>
            Attachment
          </Text>
          <Pressable
            onPress={() => handleOpenAttachment(ticket.attachment_url)}
            style={styles.attachmentBtn}
            accessibilityRole="link"
            accessibilityLabel={`Open attachment: ${ticket.attachment_url}`}
          >
            <Text style={styles.attachmentIcon}>📎</Text>
            <Text style={styles.attachmentText} numberOfLines={1} ellipsizeMode="middle">
              {ticket.attachment_url}
            </Text>
          </Pressable>
        </View>
      )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  backBtn: {
    marginBottom: 12,
    paddingVertical: 6,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
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
  },
  ticketId: {
    fontSize: 14,
    fontWeight: '700',
  },
  subject: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 25,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
    paddingTop: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    minWidth: 65,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
    paddingTop: 8,
  },
  assigneeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  assigneeValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 14,
  },
  actionBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  closedNotice: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  closedText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  aiIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  aiDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  aiLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  aiValue: {
    fontSize: 13,
    flex: 1,
  },
  aiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  aiSummaryContainer: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  attachmentIcon: {
    fontSize: 16,
  },
  attachmentText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
