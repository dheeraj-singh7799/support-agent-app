import { calculateSla, formatTime, parseDateSafe } from '../src/services/sla/slaService';

describe('SLA Deadline Calculations & Robust Date Parsing', () => {
  const baseTime = new Date('2026-09-29T12:00:00Z');

  test('calculates correct countdown and badge for P0 (1 hour SLA)', () => {
    // Created 30 mins ago -> 30 mins remaining (50% remaining -> on_track)
    const createdAt = new Date('2026-09-29T11:30:00Z').toISOString();
    const sla = calculateSla(createdAt, 'P0', 'open', baseTime);

    expect(sla.totalSeconds).toBe(3600);
    expect(sla.remainingSeconds).toBe(1800);
    expect(sla.isOverdue).toBe(false);
    expect(sla.isAtRisk).toBe(false);
    expect(sla.badgeType).toBe('on_track');
    expect(sla.formattedCountdown).toBe('30:00');
  });

  test('flags ticket as "At Risk" when less than 20% of SLA remains', () => {
    // P0 total = 3600s, 20% = 720s (12 mins). Created 50 mins ago -> 10 mins remaining (< 12 mins)
    const createdAt = new Date('2026-09-29T11:10:00Z').toISOString();
    const sla = calculateSla(createdAt, 'P0', 'open', baseTime);

    expect(sla.remainingSeconds).toBe(600);
    expect(sla.isOverdue).toBe(false);
    expect(sla.isAtRisk).toBe(true);
    expect(sla.badgeType).toBe('at_risk');
    expect(sla.statusText).toBe('At Risk');
  });

  test('flags ticket as "Late" when deadline has elapsed', () => {
    // Created 2 hours ago for P0 (overdue by 1 hour)
    const createdAt = new Date('2026-09-29T10:00:00Z').toISOString();
    const sla = calculateSla(createdAt, 'P0', 'open', baseTime);

    expect(sla.isOverdue).toBe(true);
    expect(sla.badgeType).toBe('late');
    expect(sla.statusText).toBe('Late');
    expect(sla.formattedCountdown).toBe('-01:00:00');
  });

  test('handles edge case T-2004: unexpected priority P5 with graceful fallback', () => {
    const createdAt = new Date('2026-09-29T11:00:00Z').toISOString();
    const sla = calculateSla(createdAt, 'P5', 'open', baseTime);

    // Does not crash, defaults to standard fallback SLA
    expect(sla.totalSeconds).toBeGreaterThan(0);
    expect(sla.isOverdue).toBe(false);
  });

  test('handles edge case T-2008: future created_at timestamp gracefully', () => {
    // Created in 2027
    const futureDate = '2027-01-01T00:00:00Z';
    const sla = calculateSla(futureDate, 'P3', 'open', baseTime);

    expect(sla.isOverdue).toBe(false);
    expect(sla.badgeType).toBe('future');
    expect(sla.statusText).toBe('Future Ticket');
  });

  test('handles edge case T-2007: non-standard date format missing "T" and "Z"', () => {
    const nonStandard = '2026-09-20 11:30:00';
    const parsed = parseDateSafe(nonStandard);

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8); // September = 8 (0-indexed)
  });

  test('freezes countdown when ticket is resolved or closed', () => {
    const createdAt = new Date('2026-09-29T08:00:00Z').toISOString();
    const slaResolved = calculateSla(createdAt, 'P0', 'resolved', baseTime);
    expect(slaResolved.isOverdue).toBe(false);
    expect(slaResolved.formattedCountdown).toBe('Done');

    const slaClosed = calculateSla(createdAt, 'P0', 'closed', baseTime);
    expect(slaClosed.isOverdue).toBe(false);
    expect(slaClosed.formattedCountdown).toBe('Closed');
  });
});
