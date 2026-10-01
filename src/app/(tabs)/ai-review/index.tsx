import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/store';
import { ticketUpdatedFromRemote } from '@/store/slices/ticketsSlice';
import { showToast } from '@/store/slices/offlineSlice';
import { fakeApi } from '@/services/api/fakeApiServer';
import { syncQueue } from '@/services/offline/syncQueue';
import { Priority, Ticket } from '@/types/ticket';

const CATEGORIES = ['account_access', 'billing', 'bug', 'feature_request', 'other', 'urgent_billing'];
const ALL_PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];

export default function AiReviewScreen() {
  const dispatch = useAppDispatch();

  const tickets = useAppSelector((state) => state.tickets.items);
  const isOnline = useAppSelector((state) => state.offline.isOnline);
  const currentAgent = useAppSelector((state) => state.auth.agent);

  const [activeTab, setActiveTab] = useState<'needs_review' | 'all'>('needs_review');

  const needsReviewTickets = useMemo(() => {
    return tickets.filter((t) => t.triage_decision !== 'auto_accept');
  }, [tickets]);

  const displayedTickets = activeTab === 'needs_review' ? needsReviewTickets : tickets.slice(0, 30);

  // Modal State for Changing Category / Priority
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('P1');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const openChangeModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setSelectedCategory(ticket.category);
    setSelectedPriority(ticket.priority);
    setReason('');
  };

  const closeModal = () => {
    setSelectedTicket(null);
    setReason('');
    setIsSubmitting(false);
  };

  // 1. Accept AI's Answer
  const handleAcceptAi = async (ticket: Ticket) => {
    if (!currentAgent) return;

    try {
      const payload = {
        category: ticket.category,
        priority: ticket.priority,
        review_reason: 'Accepted by agent review',
        triage_decision: 'auto_accept' as const,
      };

      if (!isOnline) {
        await syncQueue.enqueue({
          type: 'TRIAGE_REVIEW',
          ticketId: ticket.external_id,
          agentId: currentAgent.id,
          payload,
          previousState: { triage_decision: ticket.triage_decision },
        });
        dispatch(
          ticketUpdatedFromRemote({
            ...ticket,
            triage_decision: 'auto_accept',
            isOptimistic: true,
          })
        );
        dispatch(showToast({ message: 'AI answer accepted offline.', type: 'info' }));
        return;
      }

      const updated = await fakeApi.updateTriage(ticket.external_id, payload);
      dispatch(ticketUpdatedFromRemote(updated));
      dispatch(showToast({ message: 'AI triage accepted!', type: 'success' }));
    } catch (err: any) {
      dispatch(showToast({ message: `Failed to accept: ${err.message}`, type: 'error' }));
    }
  };

  // 2. Change Category or Priority with Reason
  const handleSubmitChanges = async () => {
    if (!selectedTicket || !currentAgent) return;

    if (reason.trim().length < 10) {
      Alert.alert('Reason Too Short', 'Please enter a written explanation of at least 10 characters.');
      return;
    }

    if (
      selectedTicket.customer_plan === 'enterprise' &&
      (selectedPriority === 'P2' || selectedPriority === 'P3')
    ) {
      Alert.alert(
        'Policy Violation',
        'Enterprise tickets must always stay at least P1. You cannot downgrade to P2 or P3.'
      );
      return;
    }

    setIsSubmitting(true);
    const payload = {
      category: selectedCategory,
      priority: selectedPriority,
      review_reason: reason.trim(),
      triage_decision: 'auto_accept' as const,
    };

    const previousState: Partial<Ticket> = {
      category: selectedTicket.category,
      priority: selectedTicket.priority,
      triage_decision: selectedTicket.triage_decision,
      review_reason: selectedTicket.review_reason,
    };

    if (!isOnline) {
      await syncQueue.enqueue({
        type: 'TRIAGE_REVIEW',
        ticketId: selectedTicket.external_id,
        agentId: currentAgent.id,
        payload,
        previousState,
      });

      dispatch(
        ticketUpdatedFromRemote({
          ...selectedTicket,
          category: selectedCategory,
          priority: selectedPriority,
          review_reason: reason.trim(),
          triage_decision: 'auto_accept',
          isOptimistic: true,
        })
      );

      dispatch(showToast({ message: 'Changes queued offline.', type: 'info' }));
      closeModal();
      return;
    }

    try {
      const updated = await fakeApi.updateTriage(selectedTicket.external_id, payload);
      dispatch(ticketUpdatedFromRemote(updated));
      dispatch(showToast({ message: 'AI triage updated successfully!', type: 'success' }));
      closeModal();
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Update Failed', err.message || 'Server rejected changes.');
    }
  };

  const renderTicketCard = ({ item }: { item: Ticket }) => {
    const isMaybe = item.triage_decision === 'maybe';
    const decisionBadgeBg = isMaybe ? '#FEF3C7' : '#FFEDD5';
    const decisionBadgeText = isMaybe ? '#B45309' : '#C2410C';
    const decisionLabel = isMaybe ? 'Maybe' : 'Manual Review';

    return (
      <View style={styles.card}>
        {/* Top Row: Ticket ID + Decision Badge */}
        <View style={styles.cardTopRow}>
          <Text style={styles.ticketId}>{item.external_id}</Text>
          <View style={[styles.decisionBadge, { backgroundColor: decisionBadgeBg }]}>
            <Text style={[styles.decisionBadgeText, { color: decisionBadgeText }]}>
              {decisionLabel}
            </Text>
          </View>
        </View>

        {/* Issue Subject */}
        <Text style={styles.subjectText} numberOfLines={2}>
          {item.subject || '(No subject provided)'}
        </Text>

        {/* AI Suggestion Box */}
        <View style={styles.aiSuggestionBox}>
          <Text style={styles.aiSuggestionTitle}>AI Suggestion</Text>
          <Text style={styles.aiLine}>
            <Text style={styles.aiLabel}>Category: </Text>
            {item.category.replace('_', ' ')}
          </Text>
          <Text style={styles.aiLine}>
            <Text style={styles.aiLabel}>Priority: </Text>
            {item.priority}
          </Text>
          <Text style={styles.aiLine}>
            <Text style={styles.aiLabel}>Confidence: </Text>
            {item.review_reason ? item.review_reason : '78%'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => handleAcceptAi(item)}
            style={styles.acceptBtn}
            accessibilityRole="button"
          >
            <Text style={styles.acceptBtnText}>Accept AI</Text>
          </Pressable>

          <Pressable
            onPress={() => openChangeModal(item)}
            style={styles.changeBtn}
            accessibilityRole="button"
          >
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Blue Top App Bar matching Screen 9 */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>AI Review</Text>
      </View>

      {/* Segmented Pill Tabs */}
      <View style={styles.tabsHeader}>
        <Pressable
          onPress={() => setActiveTab('needs_review')}
          style={[styles.tabBtn, activeTab === 'needs_review' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabBtnText, activeTab === 'needs_review' && styles.tabBtnTextActive]}>
            Needs Review ({needsReviewTickets.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('all')}
          style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>
            All (24)
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={displayedTickets}
        keyExtractor={(item) => item.external_id}
        renderItem={renderTicketCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>Queue Clear!</Text>
            <Text style={styles.emptySubtitle}>
              All AI triage decisions have been reviewed.
            </Text>
          </View>
        }
      />

      {/* Change Modal */}
      {selectedTicket && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={closeModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Modify AI Triage</Text>
                  <Pressable onPress={closeModal}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                </View>

                <Text style={styles.inputHeading}>SELECT CATEGORY</Text>
                <View style={styles.chipsWrap}>
                  {CATEGORIES.map((cat) => {
                    const isSel = selectedCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        style={[styles.chip, isSel && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.inputHeading, { marginTop: 14 }]}>SELECT PRIORITY</Text>
                {selectedTicket.customer_plan === 'enterprise' && (
                  <Text style={styles.enterpriseNotice}>
                    ⚠️ Enterprise tickets must stay at least P1
                  </Text>
                )}
                <View style={styles.chipsWrap}>
                  {ALL_PRIORITIES.map((p) => {
                    const isSel = selectedPriority === p;
                    const isDisabled =
                      selectedTicket.customer_plan === 'enterprise' && (p === 'P2' || p === 'P3');
                    return (
                      <Pressable
                        key={p}
                        disabled={isDisabled}
                        onPress={() => setSelectedPriority(p)}
                        style={[
                          styles.chip,
                          isSel && styles.chipActive,
                          isDisabled && { opacity: 0.35 },
                        ]}
                      >
                        <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                          {p}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.inputHeading, { marginTop: 14 }]}>
                  WRITTEN REASON (MIN 10 CHARACTERS)
                </Text>
                <TextInput
                  style={styles.reasonInput}
                  multiline
                  numberOfLines={3}
                  placeholder="Explain why you are changing the AI proposal..."
                  placeholderTextColor="#94A3B8"
                  value={reason}
                  onChangeText={setReason}
                  maxLength={300}
                />
                <Text style={styles.charCount}>{reason.trim().length} / 10 min chars</Text>

                <View style={styles.modalBtnRow}>
                  <Pressable onPress={closeModal} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSubmitChanges}
                    disabled={isSubmitting}
                    style={styles.saveBtn}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
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
  tabsHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  tabBtn: {
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#2563EB',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  decisionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  decisionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subjectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 20,
    marginBottom: 12,
  },
  aiSuggestionBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  aiSuggestionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  aiLine: {
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 2,
  },
  aiLabel: {
    fontWeight: '600',
    color: '#64748B',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  changeBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  enterpriseNotice: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
