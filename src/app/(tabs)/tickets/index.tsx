import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  useColorScheme,
  Platform,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchTickets,
  loadMoreTickets,
  setFilters,
  resetFilters,
} from '@/store/slices/ticketsSlice';
import { TicketCard } from '@/components/TicketCard';
import { FilterBar } from '@/components/FilterBar';
import { Ticket, TicketFilters } from '@/types/ticket';

export default function TicketListScreen() {
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';

  const { items, filters, isLoading, isRefreshing, isLoadingMore, error, hasMore } =
    useAppSelector((state) => state.tickets);
  const currentAgent = useAppSelector((state) => state.auth.agent);

  // Load initial page or when filters change
  useEffect(() => {
    dispatch(fetchTickets({ filters, page: 1, agentId: currentAgent?.id }));
  }, [dispatch, filters, currentAgent?.id]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    dispatch(fetchTickets({ filters, page: 1, isRefresh: true, agentId: currentAgent?.id }));
  }, [dispatch, filters, currentAgent?.id]);

  // Infinite scroll: Load more
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading && !isLoadingMore && !isRefreshing) {
      dispatch(loadMoreTickets({ filters, agentId: currentAgent?.id }));
    }
  }, [dispatch, hasMore, isLoading, isLoadingMore, isRefreshing, filters, currentAgent?.id]);

  const handleFilterChange = (updated: Partial<TicketFilters>) => {
    dispatch(setFilters(updated));
  };

  const handleResetFilters = () => {
    dispatch(resetFilters());
  };

  const hasActiveFilters = Boolean(
    (filters.status && filters.status !== 'all') ||
      (filters.priority && filters.priority !== 'all') ||
      filters.mineOnly ||
      (filters.searchQuery && filters.searchQuery.trim().length > 0)
  );

  const renderItem = useCallback(
    ({ item }: { item: Ticket }) => (
      <TicketCard ticket={item} currentAgentId={currentAgent?.id} />
    ),
    [currentAgent?.id]
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC' }]}>
      {/* Filter and Search Bar */}
      <FilterBar
        filters={filters}
        onChangeFilters={handleFilterChange}
        onReset={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Error state with retry */}
      {error && items.length === 0 && !isLoading && (
        <View style={styles.stateCenter}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.stateTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            Unable to Load Queue
          </Text>
          <Text style={[styles.stateSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {error}
          </Text>
          <Pressable
            onPress={handleRefresh}
            style={[styles.retryBtn, { backgroundColor: '#2563EB' }]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading tickets"
          >
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </Pressable>
        </View>
      )}

      {/* Initial Loading */}
      {isLoading && items.length === 0 && (
        <View style={styles.stateCenter}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={[styles.stateSubtitle, { color: isDark ? '#94A3B8' : '#64748B', marginTop: 12 }]}>
            Fetching live tickets...
          </Text>
        </View>
      )}

      {/* Ticket FlatList */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.external_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          !isLoading && !error ? (
            <View style={styles.stateCenter}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={[styles.stateTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                No Tickets Found
              </Text>
              <Text style={[styles.stateSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {hasActiveFilters
                  ? 'No tickets match the selected filters. Try clearing some filters.'
                  : 'The queue is currently empty.'}
              </Text>
              {hasActiveFilters && (
                <Pressable onPress={handleResetFilters} style={styles.clearFiltersBtn}>
                  <Text style={styles.clearFiltersText}>Clear Filters</Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={[styles.footerText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Loading more tickets...
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 10,
    flexGrow: 1,
  },
  stateCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 60,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  clearFiltersBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearFiltersText: {
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 14,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
