import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const { items, filters, isLoading, isRefreshing, isLoadingMore, error, hasMore } =
    useAppSelector((state) => state.tickets);
  const currentAgent = useAppSelector((state) => state.auth.agent);

  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

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
    <View style={styles.container}>
      {/* Signature Blue Top App Bar matching Screen 2 */}
      <View style={styles.topAppBar}>
        <Text style={styles.appBarTitle}>Tickets</Text>
        <View style={styles.appBarActions}>
          <Pressable
            onPress={() => setShowSearch(!showSearch)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Search tickets"
          >
            <Ionicons name="search" size={22} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Filter tickets"
          >
            <Ionicons name="funnel-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Filter Bar with Horizontal Pill Tabs */}
      <FilterBar
        filters={filters}
        onChangeFilters={handleFilterChange}
        onReset={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        showSearch={showSearch}
        showFilters={showFilters}
        onToggleSearch={() => setShowSearch(!showSearch)}
        onToggleFilters={() => setShowFilters(!showFilters)}
      />

      {/* Error state with retry */}
      {error && items.length === 0 && !isLoading && (
        <View style={styles.stateCenter}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.stateTitle}>Unable to Load Queue</Text>
          <Text style={styles.stateSubtitle}>{error}</Text>
          <Pressable
            onPress={handleRefresh}
            style={styles.retryBtn}
            accessibilityRole="button"
            accessibilityLabel="Retry loading tickets"
          >
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </Pressable>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <View style={styles.stateCenter}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.stateTitle}>No Tickets Found</Text>
          <Text style={styles.stateSubtitle}>
            {hasActiveFilters
              ? 'No tickets match your active filters.'
              : 'There are no active tickets in the queue.'}
          </Text>
          {hasActiveFilters && (
            <Pressable onPress={handleResetFilters} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear Filters</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Initial Loading Skeleton */}
      {isLoading && items.length === 0 && (
        <View style={styles.stateCenter}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading tickets...</Text>
        </View>
      )}

      {/* Virtualized Ticket List */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.external_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingMoreText}>Loading more tickets...</Text>
            </View>
          ) : null
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topAppBar: {
    height: 56,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  appBarTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    padding: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  stateCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  clearBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
