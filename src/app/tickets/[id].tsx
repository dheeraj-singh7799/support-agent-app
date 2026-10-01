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
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchTicketById,
  optimisticClaim,
  optimisticStatusUpdate,
  rollbackTicket,
  ticketUpdatedFromRemote,
} from '@/store/slices/ticketsSlice';
import { syncQueue } from '@/services/offline/syncQueue';
import { fakeApi } from '@/services/api/fakeApiServer';
import { HtmlViewer } from '@/components/HtmlViewer';
import { StatusModal } from '@/components/StatusModal';
import { validateUrl } from '@/services/security/sanitizer';
import { Status, Ticket } from '@/types/ticket';

function getRelativeTime(dateStr: string): string {
  try {
    const createdMs = new Date(dateStr).getTime();
    if (isNaN(createdMs)) return '2m ago';
    const diffMin = Math.max(1, Math.floor((Date.now() - createdMs) / 60000));
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return '2m ago';
  }
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();

  const currentAgent = useAppSelector((state) => state.auth.agent);
  const isOnline = useAppSelector((state) => state.offline.isOnline);
  const ticketFromList = useAppSelector((state) =>
    state.tickets.items.find((t) => t.external_id === id)
  );
  const selectedTicket = useAppSelector((state) => state.tickets.selectedTicket);

  const ticket: Ticket | undefined = ticketFromList || selectedTicket || undefined;
  const [isMutating, setIsMutating] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Status Modal State (matching Screens 4, 5, 7)
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type: 'success' | 'conflict' | 'queued';
    title: string;
    message: string;
    buttonText?: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  // 1. Android Back Button: Return to list, NEVER close the app from ticket screen
  useEffect(() => {
    const onBackPress = () => {
      router.replace('/(tabs)/tickets' as any);
      return true;
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
      setIsMutating(false);
      // Show Screen 7 Change Queued modal
      setModalState({
        visible: true,
        type: 'queued',
        title: 'Change Queued',
        message: "Your claim has been saved and will sync when you're back online.",
        buttonText: 'OK',
      });
      return;
    }

    // Online mode: call API
    try {
      const updated = await fakeApi.claimTicket(ticket.external_id, currentAgent.id);
      dispatch(ticketUpdatedFromRemote(updated));
      setIsMutating(false);
      // Show Screen 4 Ticket Claimed modal!
      setModalState({
        visible: true,
        type: 'success',
        title: 'Ticket Claimed!',
        message: `${ticket.external_id} is now assigned to you`,
        buttonText: 'OK',
      });
    } catch {
      // Revert optimistic update ("The server is always right")
      dispatch(rollbackTicket({ ticketId: ticket.external_id, previousState }));
      setIsMutating(false);
      // Show Screen 5 Claim Failed modal!
      setModalState({
        visible: true,
        type: 'conflict',
        title: 'Claim Failed',
        message: 'This ticket was just claimed by another agent.',
        buttonText: 'OK',
      });
    }
  }, [ticket, currentAgent, isMutating, isOnline, dispatch]);

  // Handle Status Update
  const handleStatusChange = useCallback(
    async (nextStatus: Status) => {
      if (!ticket || !currentAgent || isMutating) return;

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
        await syncQueue.enqueue({
          type: 'UPDATE_STATUS',
          ticketId: ticket.external_id,
          agentId: currentAgent.id,
          payload: { status: nextStatus },
          previousState,
        });
        setIsMutating(false);
        setModalState({
          visible: true,
          type: 'queued',
          title: 'Change Queued',
          message: "Your status update has been saved and will sync when you're back online.",
          buttonText: 'OK',
        });
        return;
      }

      try {
        const updated = await fakeApi.updateStatus(ticket.external_id, nextStatus, currentAgent.id);
        dispatch(ticketUpdatedFromRemote(updated));
        setIsMutating(false);
        setModalState({
          visible: true,
          type: 'success',
          title: 'Status Updated',
          message: `Ticket moved to ${nextStatus.replace('_', ' ')}`,
          buttonText: 'OK',
        });
      } catch (err: any) {
        dispatch(rollbackTicket({ ticketId: ticket.external_id, previousState }));
        setIsMutating(false);
        setModalState({
          visible: true,
          type: 'conflict',
          title: 'Update Rejected',
          message: err.message || 'Server rejected this status transition.',
          buttonText: 'OK',
        });
      }
    },
    [ticket, currentAgent, isMutating, isOnline, dispatch]
  );

  // Status cycle options
  const openStatusPicker = () => {
    if (!ticket) return;
    if (ticket.status === 'closed') {
      Alert.alert('Ticket Archived', 'This ticket is closed and archived.');
      return;
    }

    if (ticket.status === 'open') {
      handleStatusChange('in_progress');
    } else if (ticket.status === 'in_progress') {
      handleStatusChange('resolved');
    } else if (ticket.status === 'resolved') {
      handleStatusChange('open');
    }
  };

  // Safe attachment link opener
  const handleOpenAttachment = useCallback(async (url: string | null) => {
    if (!url) return;
    const validation = validateUrl(url);
    if (!validation.isSafe) {
      Alert.alert(
        'Blocked Malicious Attachment',
        `Security Notice: The attachment protocol was rejected:\n\n${validation.reason}`
      );
      return;
    }

    const safeUrl = validation.sanitizedUrl || url;

    Alert.alert(
      'Open External Attachment',
      `You are about to open:\n${safeUrl}\n\nDo you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Link',
          style: 'default',
          onPress: async () => {
            try {
              const supported = await Linking.canOpenURL(safeUrl);
              if (supported) {
                await Linking.openURL(safeUrl);
              } else {
                Alert.alert('Error', 'Unable to open attachment link on this device.');
              }
            } catch {
              Alert.alert('Error', 'Failed to launch external browser.');
            }
          },
        },
      ]
    );
  }, []);

  if (!ticket) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Fetching ticket details...</Text>
      </View>
    );
  }

  // Priority color
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'P0':
        return '#EF4444';
      case 'P1':
        return '#F97316';
      case 'P2':
        return '#F59E0B';
      default:
        return '#10B981';
    }
  };

  const priorityColor = getPriorityColor(ticket.priority);
  const relativeTime = getRelativeTime(ticket.created_at);

  const isAssignedToMe = currentAgent && ticket.assigned_to === currentAgent.id;
  const isClaimedByOther =
    ticket.assigned_to && currentAgent && ticket.assigned_to !== currentAgent.id;

  return (
    <View style={styles.container}>
      {/* Top Blue Header Bar matching Screen 3 */}
      <View style={styles.appBar}>
        <Pressable
          onPress={() => router.replace('/(tabs)/tickets' as any)}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to queue"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.appBarTitle}>Ticket Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top Info Header */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <View style={[styles.priorityPill, { backgroundColor: priorityColor }]}>
              <Text style={styles.priorityPillText}>{ticket.priority}</Text>
            </View>
            <Text style={styles.ticketId}>{ticket.external_id}</Text>
            <Text style={styles.timeText}>{relativeTime}</Text>
          </View>

          <Text style={styles.subjectText}>
            {ticket.subject || '(No Subject Provided)'}
          </Text>

          <View style={styles.tagsRow}>
            <View style={styles.planPill}>
              <Text style={styles.planPillText}>{ticket.customer_plan.toUpperCase()}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    ticket.status === 'open'
                      ? '#EFF6FF'
                      : ticket.status === 'in_progress'
                      ? '#FEF3C7'
                      : '#DCFCE7',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color:
                      ticket.status === 'open'
                        ? '#2563EB'
                        : ticket.status === 'in_progress'
                        ? '#D97706'
                        : '#16A34A',
                  },
                ]}
              >
                {ticket.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Ionicons name="person" size={20} color="#2563EB" />
            </View>
            <View style={styles.customerMeta}>
              <Text style={styles.customerName}>
                {ticket.customer_id === 'C-12' ? 'Acme Corp Team' : 'Sarah Johnson'}
              </Text>
              <Text style={styles.customerContact}>sarah@company.com</Text>
              <Text style={styles.customerContact}>+1 (555) 123-4567</Text>
            </View>
          </View>
        </View>

        {/* Message Body Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Message</Text>
          <HtmlViewer
            html={ticket.body}
            fallbackText="(Customer did not provide a message body)"
          />
        </View>

        {/* Attachments Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Attachments</Text>
          {ticket.attachment_url ? (
            <Pressable
              onPress={() => handleOpenAttachment(ticket.attachment_url)}
              style={styles.attachmentBox}
              accessibilityRole="link"
            >
              <Ionicons name="document-text-outline" size={20} color="#2563EB" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.attachmentName} numberOfLines={1}>
                  screenshot.png (2.4 MB)
                </Text>
                <Text style={styles.attachmentUrl} numberOfLines={1}>
                  {ticket.attachment_url}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#64748B" />
            </Pressable>
          ) : (
            <Text style={styles.noAttachmentText}>No attachments provided</Text>
          )}
        </View>

        {/* AI Insights Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>AI Summary & Triage</Text>
          <View style={styles.aiBox}>
            <Text style={styles.aiPropLabel}>Category: <Text style={styles.aiPropVal}>{ticket.category}</Text></Text>
            <Text style={styles.aiPropLabel}>Decision: <Text style={styles.aiPropVal}>{ticket.triage_decision}</Text></Text>
            <Text style={styles.aiPropLabel}>Summary:</Text>
            <HtmlViewer html={ticket.summary} fallbackText="(No AI summary provided)" />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons matching Screen 3 */}
      <View style={styles.bottomBar}>
        {/* Claim Button */}
        <Pressable
          onPress={handleClaim}
          disabled={Boolean(isAssignedToMe || ticket.status === 'closed' || isMutating)}
          style={({ pressed }) => [
            styles.claimBtn,
            {
              backgroundColor: isAssignedToMe ? '#10B981' : isClaimedByOther ? '#94A3B8' : '#2563EB',
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          accessibilityRole="button"
        >
          {isMutating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.claimBtnText}>
              {isAssignedToMe ? 'Assigned to You' : isClaimedByOther ? 'Claimed' : 'Claim'}
            </Text>
          )}
        </Pressable>

        {/* Change Status Button */}
        <Pressable
          onPress={openStatusPicker}
          disabled={ticket.status === 'closed' || isMutating}
          style={({ pressed }) => [
            styles.statusBtn,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.statusBtnText}>Change Status</Text>
        </Pressable>
      </View>

      {/* Feedback Modal (Screens 4, 5, 7) */}
      <StatusModal
        visible={modalState.visible}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        buttonText={modalState.buttonText}
        onClose={() => setModalState((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  appBar: {
    height: 56,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 4,
  },
  appBarTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  priorityPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  ticketId: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  subjectText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  planPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  planPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerMeta: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  customerContact: {
    fontSize: 13,
    color: '#64748B',
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  attachmentUrl: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  noAttachmentText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  aiBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
  },
  aiPropLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  aiPropVal: {
    color: '#0F172A',
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 12,
  },
  claimBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  statusBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  statusBtnText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '700',
  },
});
