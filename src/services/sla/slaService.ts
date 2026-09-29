import { Priority, SlaInfo, Status } from '@/types/ticket';

// SLA Durations in seconds according to specification
export const SLA_DURATIONS_SECONDS: Record<string, number> = {
  P0: 1 * 60 * 60, // 1 hour = 3600s
  P1: 4 * 60 * 60, // 4 hours = 14400s
  P2: 24 * 60 * 60, // 24 hours = 86400s
  P3: 72 * 60 * 60, // 72 hours = 259200s
};

// Default fallback for unexpected priorities like P5
export const DEFAULT_FALLBACK_SLA_SECONDS = 72 * 60 * 60;

/**
 * Robustly parses date strings, supporting ISO with offset, missing 'T', or missing 'Z'
 */
export function parseDateSafe(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  let d = new Date(trimmed);

  if (!isNaN(d.getTime())) {
    return d;
  }

  // Handle format like "2026-09-20 11:30:00" -> replace space with T and append Z
  const isoFixed = trimmed.replace(' ', 'T');
  d = new Date(isoFixed.endsWith('Z') || isoFixed.includes('+') ? isoFixed : `${isoFixed}Z`);

  if (!isNaN(d.getTime())) {
    return d;
  }

  return null;
}

/**
 * Calculates deadline metrics based on created_at and priority
 */
export function calculateSla(
  createdAtStr: string,
  priority: Priority,
  status: Status = 'open',
  now: Date = new Date()
): SlaInfo {
  const createdDate = parseDateSafe(createdAtStr);
  const totalSeconds = SLA_DURATIONS_SECONDS[priority] ?? DEFAULT_FALLBACK_SLA_SECONDS;

  // Handle unparseable date
  if (!createdDate) {
    return {
      totalSeconds,
      remainingSeconds: 0,
      isOverdue: false,
      isAtRisk: false,
      statusText: 'No Date',
      badgeType: 'on_track',
      formattedCountdown: '--:--',
    };
  }

  const nowMs = now.getTime();
  const createdMs = createdDate.getTime();
  const deadlineMs = createdMs + totalSeconds * 1000;
  const remainingSeconds = Math.floor((deadlineMs - nowMs) / 1000);

  // If ticket is already resolved or closed, SLA is fulfilled / frozen
  if (status === 'resolved' || status === 'closed') {
    return {
      totalSeconds,
      remainingSeconds: Math.max(0, remainingSeconds),
      isOverdue: false,
      isAtRisk: false,
      statusText: status === 'resolved' ? 'Resolved' : 'Closed',
      badgeType: 'on_track',
      formattedCountdown: status === 'resolved' ? 'Done' : 'Closed',
    };
  }

  // Future ticket case (e.g., T-2008 created in 2027)
  if (createdMs > nowMs) {
    return {
      totalSeconds,
      remainingSeconds,
      isOverdue: false,
      isAtRisk: false,
      statusText: 'Future Ticket',
      badgeType: 'future',
      formattedCountdown: formatTime(remainingSeconds),
    };
  }

  // Overdue / Late
  if (remainingSeconds <= 0) {
    const overdueSeconds = Math.abs(remainingSeconds);
    return {
      totalSeconds,
      remainingSeconds,
      isOverdue: true,
      isAtRisk: false,
      statusText: 'Late',
      badgeType: 'late',
      formattedCountdown: `-${formatTime(overdueSeconds)}`,
    };
  }

  // At Risk: less than 20% of the total time left
  const atRiskThreshold = totalSeconds * 0.2;
  const isAtRisk = remainingSeconds < atRiskThreshold;

  return {
    totalSeconds,
    remainingSeconds,
    isOverdue: false,
    isAtRisk,
    statusText: isAtRisk ? 'At Risk' : 'On Track',
    badgeType: isAtRisk ? 'at_risk' : 'on_track',
    formattedCountdown: formatTime(remainingSeconds),
  };
}

/**
 * Formats seconds into HH:MM:SS or DDd HH:MM
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, '0')}h`;
  }

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
