import { syncQueue } from '../src/services/offline/syncQueue';
import { fakeApi } from '../src/services/api/fakeApiServer';

// Mock AsyncStorage in-memory for testing
let mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, val: string) => {
    if (!mockStorage) mockStorage = {};
    mockStorage[key] = val;
  }),
  getItem: jest.fn(async (key: string) => {
    return (mockStorage && mockStorage[key]) || null;
  }),
  removeItem: jest.fn(async (key: string) => {
    if (mockStorage) delete mockStorage[key];
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    if (mockStorage) {
      keys.forEach((k) => delete mockStorage[k]);
    }
  }),
}));

describe('Offline Synchronization & Mutation Queue ("Server Is Always Right")', () => {
  beforeAll(() => {
    fakeApi.setConfig({
      simulateLatency: false,
      simulateErrors: false,
      simulateClaimConflicts: false,
      enableBackgroundActivity: false,
    });
  });

  beforeEach(async () => {
    fakeApi.initDatabase();
    await syncQueue.clearAllCache();
  });

  test('enqueues mutations into the persistent outbox', async () => {
    await syncQueue.enqueue({
      type: 'CLAIM',
      ticketId: 'T-2001',
      agentId: 'agent-1',
      payload: {},
    });

    expect(syncQueue.getPendingCount()).toBe(1);
    const queued = syncQueue.getQueue();
    expect(queued[0].ticketId).toBe('T-2001');
    expect(queued[0].agentId).toBe('agent-1');
  });

  test('successfully drains valid mutations when connection returns', async () => {
    await syncQueue.enqueue({
      type: 'CLAIM',
      ticketId: 'T-2001',
      agentId: 'agent-1',
      payload: {},
    });

    const result = await syncQueue.drainQueue();
    expect(result.processed).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(syncQueue.getPendingCount()).toBe(0);

    // Verify ticket on server
    const serverTicket = await fakeApi.getTicketById('T-2001');
    expect(serverTicket.assigned_to).toBe('agent-1');
  });

  test('handles 409 conflict on claim: discards mutation and triggers conflict rollback callback', async () => {
    // T-2005 is already assigned to agent-2 on the server
    await syncQueue.enqueue({
      type: 'CLAIM',
      ticketId: 'T-2005',
      agentId: 'agent-1',
      payload: {},
      previousState: { assigned_to: null },
    });

    let conflictFired = false;
    let conflictErrorStatus = 0;
    const unsub = syncQueue.onConflict((mutation, error) => {
      conflictFired = true;
      conflictErrorStatus = error.status;
    });

    const result = await syncQueue.drainQueue();

    unsub();

    expect(conflictFired).toBe(true);
    expect(conflictErrorStatus).toBe(409);
    expect(result.conflicts).toBe(1);
    // Discarded from queue
    expect(syncQueue.getPendingCount()).toBe(0);
  });
});
