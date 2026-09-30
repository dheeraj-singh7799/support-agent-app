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
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '@/store';
import { ticketUpdatedFromRemote } from '@/store/slices/ticketsSlice';
import { showToast } from '@/store/slices/offlineSlice';
import { fakeApi } from '@/services/api/fakeApiServer';
import { syncQueue } from '@/services/offline/syncQueue';
import { HtmlViewer } from '@/components/HtmlViewer';
import { Priority, Ticket } from '@/types/ticket';

const CATEGORIES = ['account_access', 'billing', 'bug', 'feature_request', 'other', 'urgent_billing'];
const ALL_PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];

export default function AiReviewScreen() {
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';

  const tickets = useAppSelector((state) => state.tickets.items);
  const isOnline = useAppSelector((state) => state.offline.isOnline);
  const currentAgent = useAppSelector((state) => state.auth.agent);

  // Filter tickets needing manual review (including invalid "maybe" triage decisions)
  const reviewTickets = useMemo(() => {
    return tickets.filter((t) => t.triage_decision !== 'auto_accept');
  }, [tickets]);

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

    // Validation: reason must be at least 10 characters
    if (reason.trim().length < 10) {
      Alert.alert('Reason Too Short', 'Please enter a written explanation of at least 10 characters.');
      return;
    }

    // Policy Rule: Enterprise tickets must always stay at least P1
    if (
      selectedTicket.customer_plan === 'enterprise' &&
      (selectedPriority === 'P2' || selectedPriority === 'P3' || selectedPriority === 'P5')
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
      dispatch(showToast({ message: 'Triage updated successfully!', type: 'success' }));
      closeModal();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: Ticket }) => {
    return (
      <View
        style={[
          styles.ticketCard,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.ticketId, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {item.external_id}
          </Text>
          <View
            style={[
              styles.planBadge,
              { backgroundColor: item.customer_plan === 'enterprise' ? '#FDF2F8' : '#F1F5F9' },
            ]}
          >
            <Text
              style={[
                styles.planText,
                { color: item.customer_plan === 'enterprise' ? '#BE185D' : '#475569' },
              ]}
            >
              {item.customer_plan.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={[styles.subject, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          {item.subject || '(No Subject)'}
        </Text>

        {/* AI proposal row */}
        <View style={styles.aiProposal}>
          <View style={styles.propItem}>
            <Text style={[styles.propLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              AI Category:
            </Text>
            <Text style={[styles.propVal, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
              {item.category}
            </Text>
          </View>
          <View style={styles.propItem}>
            <Text style={[styles.propLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              AI Priority:
            </Text>
            <Text style={[styles.propVal, { color: '#DC2626' }]}>{item.priority}</Text>
          </View>
        </View>

        {/* AI Flag Reason */}
        <View style={styles.reasonBox}>
          <Text style={[styles.propLabel, { color: '#B45309' }]}>
            Flag Reason: {item.review_reason || 'Manual review required'}
          </Text>
        </View>

        {/* AI Summary */}
        <View style={styles.summaryBox}>
          <Text style={[styles.propLabel, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 2 }]}>
            Summary:
          </Text>
          <HtmlViewer html={item.summary} fallbackText="(No summary provided)" />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => handleAcceptAi(item)}
            style={[styles.btn, styles.acceptBtn]}
            accessibilityRole="button"
            accessibilityLabel={`Accept AI proposal for ${item.external_id}`}
          >
            <Text style={styles.acceptBtnText}>✓ Accept AI</Text>
          </Pressable>

          <Pressable
            onPress={() => openChangeModal(item)}
            style={[styles.btn, styles.changeBtn]}
            accessibilityRole="button"
            accessibilityLabel={`Change AI triage for ${item.external_id}`}
          >
            <Text style={styles.changeBtnText}>✎ Change</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          AI Triage Review
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          {reviewTickets.length} ticket{reviewTickets.length === 1 ? '' : 's'} waiting for human review
        </Text>
      </View>

      <FlatList
        data={reviewTickets}
        keyExtractor={(item) => item.external_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={[styles.emptyTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              All Caught Up!
            </Text>
            <Text style={[styles.emptySubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              No tickets currently require manual AI triage review.
            </Text>
          </View>
        }
      />

      {/* Change Triage Modal */}
      <Modal visible={Boolean(selectedTicket)} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Modify AI Triage
                </Text>
                <Pressable onPress={closeModal} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </View>

              {selectedTicket && (
                <>
                  <Text style={[styles.modalSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Ticket: {selectedTicket.external_id} ({selectedTicket.customer_plan.toUpperCase()})
                  </Text>

                  {/* Category Picker */}
                  <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                    SELECT CATEGORY
                  </Text>
                  <View style={styles.chipsWrap}>
                    {CATEGORIES.map((cat) => {
                      const isSel = selectedCategory === cat;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => setSelectedCategory(cat)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isSel ? '#3B82F6' : isDark ? '#334155' : '#F1F5F9',
                              borderColor: isSel ? '#2563EB' : 'transparent',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: isSel ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569' },
                            ]}
                          >
                            {cat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Priority Picker with Enterprise Rule Enforcement */}
                  <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#334155', marginTop: 14 }]}>
                    SELECT PRIORITY
                  </Text>
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
                            {
                              backgroundColor: isDisabled
                                ? isDark
                                  ? '#1E293B'
                                  : '#E2E8F0'
                                : isSel
                                ? '#3B82F6'
                                : isDark
                                ? '#334155'
                                : '#F1F5F9',
                              opacity: isDisabled ? 0.4 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: isSel ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569' },
                            ]}
                          >
                            {p}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Written Reason Field (>= 10 chars required) */}
                  <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#334155', marginTop: 14 }]}>
                    WRITTEN REASON (MINIMUM 10 CHARACTERS)
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        color: isDark ? '#F8FAFC' : '#0F172A',
                      },
                    ]}
                    placeholder="Explain why you are changing the category or priority..."
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    multiline
                    numberOfLines={4}
                    value={reason}
                    onChangeText={setReason}
                    accessibilityLabel="Written explanation for triage change"
                  />
                  <Text
                    style={[
                      styles.charCount,
                      { color: reason.trim().length >= 10 ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {reason.trim().length} / 10 min characters
                  </Text>

                  {/* Action buttons */}
                  <View style={styles.modalBtnRow}>
                    <Pressable onPress={closeModal} style={[styles.modalBtn, styles.cancelBtn]}>
                      <Text style={[styles.cancelBtnText, { color: isDark ? '#CBD5E1' : '#64748B' }]}>
                        Cancel
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleSubmitChanges}
                      disabled={isSubmitting || reason.trim().length < 10}
                      style={[
                        styles.modalBtn,
                        styles.submitModalBtn,
                        { opacity: reason.trim().length < 10 || isSubmitting ? 0.5 : 1 },
                      ]}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.submitModalBtnText}>Save Changes</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  ticketCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketId: {
    fontSize: 13,
    fontWeight: '700',
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subject: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 10,
  },
  aiProposal: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  propItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  propLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  propVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  reasonBox: {
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryBox: {
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  changeBtn: {
    backgroundColor: '#3B82F6',
  },
  changeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  enterpriseNotice: {
    color: '#BE185D',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    fontWeight: '600',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  submitModalBtn: {
    backgroundColor: '#2563EB',
  },
  submitModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
