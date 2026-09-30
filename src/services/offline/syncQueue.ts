import AsyncStorage from '@react-native-async-storage/async-storage';
import { OutboxMutation, Ticket } from '@/types/ticket';
import { fakeApi, ApiError } from '../api/fakeApiServer';

const OUTBOX_STORAGE_KEY = 'support_agent_outbox_queue_v1';
const CACHED_TICKETS_KEY = 'support_agent_cached_tickets_v1';

type ConflictCallback = (mutation: OutboxMutation, error: ApiError) => void;

class SyncQueueManager {
  private queue: OutboxMutation[] = [];
  private isProcessing: boolean = false;
  private conflictListeners: Set<ConflictCallback> = new Set();
  private queueChangeListeners: Set<(count: number) => void> = new Set();

  constructor() {
    this.loadQueueFromDisk();
  }

  public onConflict(callback: ConflictCallback): () => void {
    this.conflictListeners.add(callback);
    return () => this.conflictListeners.delete(callback);
  }

  public onQueueChange(callback: (count: number) => void): () => void {
    this.queueChangeListeners.add(callback);
    return () => this.queueChangeListeners.delete(callback);
  }

  private notifyQueueChange() {
    const count = this.queue.length;
    this.queueChangeListeners.forEach((cb) => cb(count));
  }

  public async loadQueueFromDisk(): Promise<OutboxMutation[]> {
    try {
      const stored = await AsyncStorage.getItem(OUTBOX_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        this.notifyQueueChange();
      }
    } catch (err) {
      console.error('Failed to load outbox queue from disk:', err);
    }
    return this.queue;
  }

  private async persistQueue() {
    try {
      await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifyQueueChange();
    } catch (err) {
      console.error('Failed to save outbox queue to disk:', err);
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getQueue(): OutboxMutation[] {
    return [...this.queue];
  }

  /**
   * Adds a mutation to the persistent outbox
   */
  public async enqueue(mutation: Omit<OutboxMutation, 'id' | 'timestamp' | 'retryCount'>): Promise<OutboxMutation> {
    const fullMutation: OutboxMutation = {
      ...mutation,
      id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(fullMutation);
    await this.persistQueue();
    return fullMutation;
  }

  /**
   * Processes all pending mutations in the outbox sequentially
   */
  public async drainQueue(onSuccessUpdate?: (ticket: Ticket) => void): Promise<{ processed: number; conflicts: number }> {
    if (this.isProcessing || this.queue.length === 0) {
      return { processed: 0, conflicts: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let conflicts = 0;

    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];
        try {
          let updatedTicket: Ticket;

          if (item.type === 'CLAIM') {
            updatedTicket = await fakeApi.claimTicket(item.ticketId, item.agentId);
          } else if (item.type === 'UPDATE_STATUS') {
            updatedTicket = await fakeApi.updateStatus(item.ticketId, item.payload.status, item.agentId);
          } else if (item.type === 'TRIAGE_REVIEW') {
            updatedTicket = await fakeApi.updateTriage(item.ticketId, item.payload);
          } else {
            // Unknown mutation type, pop and ignore
            this.queue.shift();
            await this.persistQueue();
            continue;
          }

          // Successfully processed on server
          processed++;
          this.queue.shift();
          await this.persistQueue();

          if (onSuccessUpdate) {
            onSuccessUpdate(updatedTicket);
          }
        } catch (err: any) {
          if (err instanceof ApiError) {
            if (err.status === 409 || err.status === 400) {
              // Server rejected definitively (Conflict or Policy Violation).
              // "The server is always right" -> Discard mutation, notify listeners to rollback UI!
              conflicts++;
              this.queue.shift();
              await this.persistQueue();

              this.conflictListeners.forEach((listener) => {
                try {
                  listener(item, err);
                } catch (e) {
                  console.error('Error in conflict listener:', e);
                }
              });
              continue;
            }
          }

          // Network drop or transient 500 error: stop draining and wait for next sync trigger
          item.retryCount = (item.retryCount || 0) + 1;
          await this.persistQueue();
          break;
        }
      }
    } finally {
      this.isProcessing = false;
      this.notifyQueueChange();
    }

    return { processed, conflicts };
  }

  // --- Offline Ticket Cache ---

  public async saveCachedTickets(tickets: Ticket[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHED_TICKETS_KEY, JSON.stringify(tickets.slice(0, 200)));
    } catch (err) {
      console.error('Failed to cache tickets to disk:', err);
    }
  }

  public async getCachedTickets(): Promise<Ticket[]> {
    try {
      const data = await AsyncStorage.getItem(CACHED_TICKETS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to read cached tickets:', err);
      return [];
    }
  }

  public async clearAllCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([OUTBOX_STORAGE_KEY, CACHED_TICKETS_KEY]);
      this.queue = [];
      this.notifyQueueChange();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  }
}

export const syncQueue = new SyncQueueManager();
