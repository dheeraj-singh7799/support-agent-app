import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  useColorScheme,
} from 'react-native';
import { Priority, Status, TicketFilters } from '@/types/ticket';

interface FilterBarProps {
  filters: TicketFilters;
  onChangeFilters: (updated: Partial<TicketFilters>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

const STATUS_OPTIONS: { label: string; value: Status | 'all' }[] = [
  { label: 'All Status', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

const PRIORITY_OPTIONS: { label: string; value: Priority | 'all' }[] = [
  { label: 'All Priorities', value: 'all' },
  { label: 'P0 Urgent', value: 'P0' },
  { label: 'P1 High', value: 'P1' },
  { label: 'P2 Medium', value: 'P2' },
  { label: 'P3 Low', value: 'P3' },
];

export function FilterBar({
  filters,
  onChangeFilters,
  onReset,
  hasActiveFilters,
}: FilterBarProps) {
  const isDark = useColorScheme() === 'dark';
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
          borderBottomColor: isDark ? '#334155' : '#E2E8F0',
        },
      ]}
    >
      {/* Search Input & Quick Controls */}
      <View style={styles.topRow}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#CBD5E1',
              color: isDark ? '#F8FAFC' : '#0F172A',
            },
          ]}
          placeholder="Search subject, ID, customer..."
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={filters.searchQuery || ''}
          onChangeText={(text) => onChangeFilters({ searchQuery: text })}
          clearButtonMode="while-editing"
          accessibilityLabel="Search tickets"
        />

        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          style={[
            styles.filterToggleBtn,
            {
              backgroundColor: hasActiveFilters
                ? '#3B82F6'
                : isDark
                ? '#1E293B'
                : '#FFFFFF',
              borderColor: hasActiveFilters ? '#2563EB' : isDark ? '#334155' : '#CBD5E1',
            },
          ]}
        >
          <Text
            style={[
              styles.filterToggleText,
              { color: hasActiveFilters ? '#FFFFFF' : isDark ? '#CBD5E1' : '#334155' },
            ]}
          >
            {isExpanded ? 'Hide' : 'Filters'}
            {hasActiveFilters ? ' •' : ''}
          </Text>
        </Pressable>
      </View>

      {/* "My Tickets" Switch Row */}
      <View style={styles.mineRow}>
        <View style={styles.mineLabelGroup}>
          <Text style={[styles.mineLabel, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>
            My Tickets
          </Text>
          <Text style={[styles.mineSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Only tickets assigned to me
          </Text>
        </View>
        <Switch
          value={Boolean(filters.mineOnly)}
          onValueChange={(val) => onChangeFilters({ mineOnly: val })}
          trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
          thumbColor={filters.mineOnly ? '#FFFFFF' : '#F1F5F9'}
          accessibilityLabel="Toggle My Tickets filter"
        />
      </View>

      {/* Expanded Status & Priority Filter Chips */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          {/* Status Chips */}
          <Text style={[styles.sectionTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            STATUS
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = (filters.status || 'all') === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onChangeFilters({ status: opt.value })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? '#3B82F6'
                        : isDark
                        ? '#1E293B'
                        : '#FFFFFF',
                      borderColor: isSelected
                        ? '#2563EB'
                        : isDark
                        ? '#334155'
                        : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Priority Chips */}
          <Text style={[styles.sectionTitle, { color: isDark ? '#94A3B8' : '#64748B', marginTop: 10 }]}>
            PRIORITY
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {PRIORITY_OPTIONS.map((opt) => {
              const isSelected = (filters.priority || 'all') === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onChangeFilters({ priority: opt.value })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? '#3B82F6'
                        : isDark
                        ? '#1E293B'
                        : '#FFFFFF',
                      borderColor: isSelected
                        ? '#2563EB'
                        : isDark
                        ? '#334155'
                        : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {hasActiveFilters && (
            <Pressable onPress={onReset} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Clear All Filters</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  filterToggleBtn: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  mineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
  },
  mineLabelGroup: {
    flex: 1,
  },
  mineLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  mineSub: {
    fontSize: 12,
  },
  expandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  resetBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
