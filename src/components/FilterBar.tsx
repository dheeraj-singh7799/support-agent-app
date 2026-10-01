import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Priority, Status, TicketFilters } from '@/types/ticket';

interface FilterBarProps {
  filters: TicketFilters;
  onChangeFilters: (updated: Partial<TicketFilters>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  totalTicketsCount?: number;
  showSearch: boolean;
  showFilters: boolean;
  onToggleSearch: () => void;
  onToggleFilters: () => void;
}

const PILL_OPTIONS: { label: string; priority: Priority | 'all' }[] = [
  { label: 'All (5,000)', priority: 'all' },
  { label: 'P0 (245)', priority: 'P0' },
  { label: 'P1 (1,020)', priority: 'P1' },
  { label: 'P2 (2,341)', priority: 'P2' },
  { label: 'P3 (1,394)', priority: 'P3' },
];

const STATUS_OPTIONS: { label: string; value: Status | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

export function FilterBar({
  filters,
  onChangeFilters,
  onReset,
  hasActiveFilters,
  showSearch,
  showFilters,
  onToggleSearch,
  onToggleFilters,
}: FilterBarProps) {
  const currentPriority = filters.priority || 'all';

  return (
    <View style={styles.container}>
      {/* Search Input Bar (when search icon is tapped) */}
      {showSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets by ID, subject, or customer..."
            placeholderTextColor="#94A3B8"
            value={filters.searchQuery || ''}
            onChangeText={(text) => onChangeFilters({ searchQuery: text })}
            autoFocus
          />
          {filters.searchQuery ? (
            <Pressable onPress={() => onChangeFilters({ searchQuery: '' })}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Horizontal Pill Tabs matching Screen 2 */}
      <View style={styles.pillsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsScroll}
        >
          {PILL_OPTIONS.map((item) => {
            const isSelected = currentPriority === item.priority;
            return (
              <Pressable
                key={item.priority}
                onPress={() => onChangeFilters({ priority: item.priority })}
                style={[
                  styles.pill,
                  isSelected && styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    isSelected && styles.pillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Advanced Filter Drawer (when funnel icon is tapped) */}
      {showFilters && (
        <View style={styles.advancedDrawer}>
          {/* Status Filters */}
          <Text style={styles.drawerLabel}>STATUS</Text>
          <View style={styles.statusChipsRow}>
            {STATUS_OPTIONS.map((s) => {
              const isSelected = (filters.status || 'all') === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => onChangeFilters({ status: s.value })}
                  style={[
                    styles.statusChip,
                    isSelected && styles.statusChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      isSelected && styles.statusChipTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* My Tickets Switch */}
          <View style={styles.mineRow}>
            <Text style={styles.mineLabel}>Only Show My Assigned Tickets</Text>
            <Switch
              value={Boolean(filters.mineOnly)}
              onValueChange={(val) => onChangeFilters({ mineOnly: val })}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={filters.mineOnly ? '#2563EB' : '#FFFFFF'}
            />
          </View>

          {hasActiveFilters && (
            <Pressable onPress={onReset} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset All Filters</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  pillsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  pillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  pillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  advancedDrawer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 6,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  drawerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  statusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  statusChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },
  mineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  mineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  resetBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
});
