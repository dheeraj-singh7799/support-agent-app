import { fakeApi, ApiError } from '../src/services/api/fakeApiServer';

describe('Fake API Server Rule Enforcement', () => {
  beforeAll(() => {
    // Disable random latency, errors, and claim conflicts for deterministic testing
    fakeApi.setConfig({
      simulateLatency: false,
      simulateErrors: false,
      simulateClaimConflicts: false,
      enableBackgroundActivity: false,
    });
  });

  beforeEach(() => {
    fakeApi.initDatabase();
  });

  describe('Enterprise Priority Policy Rule', () => {
    test('enforces enterprise tickets must stay at least P1', async () => {
      // T-2001 is an enterprise ticket
      await expect(
        fakeApi.updateTriage('T-2001', {
          priority: 'P3',
          review_reason: 'Testing downgrade on enterprise customer',
        })
      ).rejects.toThrow('Enterprise tickets must always stay at least P1');
    });

    test('permits updating enterprise priority to P0 or P1', async () => {
      const updated = await fakeApi.updateTriage('T-2001', {
        priority: 'P1',
        review_reason: 'Valid enterprise priority update',
      });
      expect(updated.priority).toBe('P1');
    });
  });

  describe('Allowed Status Transition Rules', () => {
    test('allows standard flow: open -> in_progress -> resolved -> open', async () => {
      // 1. open -> in_progress
      const step1 = await fakeApi.updateStatus('T-2001', 'in_progress', 'agent-1');
      expect(step1.status).toBe('in_progress');

      // 2. in_progress -> resolved
      const step2 = await fakeApi.updateStatus('T-2001', 'resolved', 'agent-1');
      expect(step2.status).toBe('resolved');

      // 3. resolved -> open
      const step3 = await fakeApi.updateStatus('T-2001', 'open', 'agent-1');
      expect(step3.status).toBe('open');
    });

    test('rejects disallowed moves like open -> resolved directly', async () => {
      await expect(fakeApi.updateStatus('T-2001', 'resolved', 'agent-1')).rejects.toThrow(
        'Invalid status move'
      );
    });
  });

  describe('Claim Validation & 409 Conflict', () => {
    test('rejects claiming a ticket already taken by another agent with 409', async () => {
      // T-2005 is already assigned to agent-2 in test data
      await expect(fakeApi.claimTicket('T-2005', 'agent-1')).rejects.toThrow(
        'Conflict: Ticket already claimed by agent-2'
      );
    });

    test('allows claiming an open unassigned ticket', async () => {
      const ticket = await fakeApi.claimTicket('T-2001', 'agent-1');
      expect(ticket.assigned_to).toBe('agent-1');
      expect(ticket.status).toBe('in_progress');
    });
  });

  describe('Authentication & PIN Check', () => {
    test('accepts valid 1234 PIN and returns session token', async () => {
      const res = await fakeApi.login('agent-1', '1234');
      expect(res.token).toBeDefined();
      expect(res.agent.name).toBe('Priya');
    });

    test('rejects invalid PIN with 401 Unauthorized', async () => {
      await expect(fakeApi.login('agent-1', '9999')).rejects.toThrow('Invalid 4-digit PIN');
    });
  });
});
