import { KNOWN_AGENTS, Priority, Status, Ticket, TicketFilters } from '@/types/ticket';
import { deduplicateTickets, generateSyntheticTickets, RAW_TEST_TICKETS } from './mockData';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiServerConfig {
  simulateLatency: boolean;
  minLatencyMs: number;
  maxLatencyMs: number;
  simulateErrors: boolean; // ~1 in 10 requests fails
  simulateClaimConflicts: boolean; // ~1 in 4 claims fails with 409
  enableBackgroundActivity: boolean; // 5-10s background events
}

type TicketEventListener = (event: { type: 'new_ticket' | 'ticket_updated'; ticket: Ticket }) => void;

class FakeApiServer {
  private tickets: Map<string, Ticket> = new Map();
  private listeners: Set<TicketEventListener> = new Set();
  private backgroundTimer: ReturnType<typeof setTimeout> | null = null;
  private config: ApiServerConfig = {
    simulateLatency: true,
    minLatencyMs: 300,
    maxLatencyMs: 1500,
    simulateErrors: true,
    simulateClaimConflicts: true,
    enableBackgroundActivity: true,
  };

  constructor() {
    this.initDatabase();
  }

  public initDatabase() {
    this.tickets.clear();

    // 1. Ingest test tickets (deduplicated)
    const cleanTestTickets = deduplicateTickets(RAW_TEST_TICKETS);
    cleanTestTickets.forEach((ticket) => {
      this.tickets.set(ticket.external_id, { ...ticket });
    });

    // 2. Ingest 5,000 synthetic tickets
    const synthetic = generateSyntheticTickets(5000);
    synthetic.forEach((ticket) => {
      this.tickets.set(ticket.external_id, { ...ticket });
    });
  }

  public setConfig(customConfig: Partial<ApiServerConfig>) {
    this.config = { ...this.config, ...customConfig };
    if (!this.config.enableBackgroundActivity && this.backgroundTimer) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }
  }

  public subscribe(listener: TicketEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: { type: 'new_ticket' | 'ticket_updated'; ticket: Ticket }) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in ticket event listener:', err);
      }
    });
  }

  public startBackgroundSimulation() {
    if (this.backgroundTimer) return;

    const scheduleNext = () => {
      const delay = Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds
      this.backgroundTimer = setTimeout(() => {
        if (!this.config.enableBackgroundActivity) return;
        this.runBackgroundStep();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  public stopBackgroundSimulation() {
    if (this.backgroundTimer) {
      clearTimeout(this.backgroundTimer);
      this.backgroundTimer = null;
    }
  }

  private runBackgroundStep() {
    const action = Math.random();

    if (action < 0.35) {
      // 35% chance: A new ticket arrives (occasionally P0 urgent!)
      const isUrgentP0 = Math.random() < 0.25;
      const newId = `T-${Date.now().toString().slice(-6)}`;
      const newTicket: Ticket = {
        external_id: newId,
        customer_id: `C-${Math.floor(Math.random() * 900) + 100}`,
        customer_plan: isUrgentP0 ? 'enterprise' : 'pro',
        subject: isUrgentP0 ? 'CRITICAL: Database connection pool exhausted' : 'Assistance with webhook setup',
        body: isUrgentP0
          ? 'Production database returning HTTP 503 across all services.'
          : 'Can we get guidance on configuring signature headers?',
        attachment_url: null,
        created_at: new Date().toISOString(),
        status: 'open',
        assigned_to: null,
        category: isUrgentP0 ? 'bug' : 'other',
        priority: isUrgentP0 ? 'P0' : 'P2',
        summary: isUrgentP0 ? 'Urgent outage: Database connection failure' : 'Webhook signature setup question',
        triage_decision: 'auto_accept',
        review_reason: null,
      };

      this.tickets.set(newId, newTicket);
      this.emit({ type: 'new_ticket', ticket: newTicket });
    } else {
      // 65% chance: Another agent claims or closes a random open/in-progress ticket
      const ticketList = Array.from(this.tickets.values());
      const eligible = ticketList.filter((t) => t.status === 'open' || t.status === 'in_progress');
      if (eligible.length > 0) {
        const target = eligible[Math.floor(Math.random() * eligible.length)];
        const agent = KNOWN_AGENTS[Math.floor(Math.random() * KNOWN_AGENTS.length)];

        if (target.status === 'open') {
          target.status = 'in_progress';
          target.assigned_to = agent.id;
        } else {
          target.status = 'resolved';
        }
        target.updated_at = new Date().toISOString();
        this.tickets.set(target.external_id, target);
        this.emit({ type: 'ticket_updated', ticket: target });
      }
    }
  }

  private async simulateNetwork(isClaimRequest: boolean = false) {
    if (this.config.simulateLatency) {
      const delay =
        Math.floor(Math.random() * (this.config.maxLatencyMs - this.config.minLatencyMs)) +
        this.config.minLatencyMs;
      await new Promise((res) => setTimeout(res, delay));
    }

    // 1 request in 10 fails with random error (10%)
    if (this.config.simulateErrors && Math.random() < 0.1) {
      throw new ApiError(500, 'Internal Server Error (Simulated 10% rate)');
    }

    // About 1 claim in 4 fails with 409 (25%)
    if (isClaimRequest && this.config.simulateClaimConflicts && Math.random() < 0.25) {
      throw new ApiError(409, 'Conflict: Another agent claimed this ticket first');
    }
  }

  // --- API Endpoints ---

  /**
   * POST /login
   */
  public async login(agentId: string, pin: string): Promise<{ token: string; agent: { id: string; name: string } }> {
    await this.simulateNetwork();

    const agent = KNOWN_AGENTS.find((a) => a.id === agentId);
    if (!agent) {
      throw new ApiError(404, 'Unknown agent');
    }

    // Brief specifies: use 1234 for everyone
    if (pin !== '1234') {
      throw new ApiError(401, 'Invalid 4-digit PIN. (Hint: PIN is 1234)');
    }

    const token = `session_${agentId}_${Date.now()}`;
    return { token, agent };
  }

  /**
   * GET /tickets
   */
  public async getTickets(
    filters: TicketFilters = {},
    page: number = 1,
    limit: number = 25,
    currentAgentId?: string
  ): Promise<PaginatedResult<Ticket>> {
    await this.simulateNetwork();

    let items = Array.from(this.tickets.values());

    // 1. Status Filter
    if (filters.status && filters.status !== 'all') {
      items = items.filter((t) => t.status === filters.status);
    }

    // 2. Priority Filter
    if (filters.priority && filters.priority !== 'all') {
      items = items.filter((t) => t.priority === filters.priority);
    }

    // 3. "Mine" Switch
    if (filters.mineOnly && currentAgentId) {
      items = items.filter((t) => t.assigned_to === currentAgentId);
    }

    // 4. Search Query (subject or customer_id)
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase();
      items = items.filter(
        (t) =>
          (t.subject && t.subject.toLowerCase().includes(q)) ||
          (t.customer_id && t.customer_id.toLowerCase().includes(q)) ||
          t.external_id.toLowerCase().includes(q)
      );
    }

    // Sort by created_at descending (latest first)
    items.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime() || 0;
      const dateB = new Date(b.created_at).getTime() || 0;
      return dateB - dateA;
    });

    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const startIdx = (page - 1) * limit;
    const pagedData = items.slice(startIdx, startIdx + limit);

    return {
      data: pagedData,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  /**
   * GET /tickets/:id
   */
  public async getTicketById(id: string): Promise<Ticket> {
    await this.simulateNetwork();

    const ticket = this.tickets.get(id);
    if (!ticket) {
      throw new ApiError(404, `Ticket ${id} not found`);
    }
    return { ...ticket };
  }

  /**
   * POST /tickets/:id/claim
   */
  public async claimTicket(id: string, agentId: string): Promise<Ticket> {
    // Check simulated claim conflict & latency
    await this.simulateNetwork(true);

    const ticket = this.tickets.get(id);
    if (!ticket) {
      throw new ApiError(404, `Ticket ${id} not found`);
    }

    // API rule: cannot claim if already assigned to someone else
    if (ticket.assigned_to && ticket.assigned_to !== agentId) {
      throw new ApiError(409, `Conflict: Ticket already claimed by ${ticket.assigned_to}`);
    }

    // Validate agent exists
    if (!KNOWN_AGENTS.some((a) => a.id === agentId)) {
      throw new ApiError(400, 'Invalid agent ID');
    }

    ticket.assigned_to = agentId;
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    ticket.updated_at = new Date().toISOString();

    this.tickets.set(id, ticket);
    this.emit({ type: 'ticket_updated', ticket });

    return { ...ticket };
  }

  /**
   * PATCH /tickets/:id/status
   * Rule: Offer only allowed next steps:
   * open -> in_progress -> resolved, and resolved -> open
   */
  public async updateStatus(id: string, newStatus: Status, agentId: string): Promise<Ticket> {
    await this.simulateNetwork();

    const ticket = this.tickets.get(id);
    if (!ticket) {
      throw new ApiError(404, `Ticket ${id} not found`);
    }

    // Validate allowed status transitions
    const current = ticket.status;
    const isAllowed =
      (current === 'open' && newStatus === 'in_progress') ||
      (current === 'in_progress' && newStatus === 'resolved') ||
      (current === 'resolved' && newStatus === 'open');

    if (!isAllowed) {
      throw new ApiError(
        400,
        `Invalid status move: cannot transition from "${current}" to "${newStatus}". Allowed: open -> in_progress -> resolved, or resolved -> open.`
      );
    }

    ticket.status = newStatus;
    if (newStatus === 'in_progress' && !ticket.assigned_to) {
      ticket.assigned_to = agentId;
    }
    ticket.updated_at = new Date().toISOString();

    this.tickets.set(id, ticket);
    this.emit({ type: 'ticket_updated', ticket });

    return { ...ticket };
  }

  /**
   * PATCH /tickets/:id/triage
   * Rule: An agent changes the AI's category or priority, with a reason (at least 10 characters).
   * Rule: Enterprise tickets must always stay at least P1.
   */
  public async updateTriage(
    id: string,
    updates: { category?: string; priority?: Priority; review_reason: string; triage_decision?: 'auto_accept' | 'manual_review' }
  ): Promise<Ticket> {
    await this.simulateNetwork();

    const ticket = this.tickets.get(id);
    if (!ticket) {
      throw new ApiError(404, `Ticket ${id} not found`);
    }

    // Check reason requirement
    if (!updates.review_reason || updates.review_reason.trim().length < 10) {
      throw new ApiError(400, 'Triage modification requires a written reason of at least 10 characters.');
    }

    // Check Enterprise rule: Enterprise tickets must always stay at least P1
    const targetPriority = updates.priority ?? ticket.priority;
    if (ticket.customer_plan === 'enterprise' && (targetPriority === 'P2' || targetPriority === 'P3' || targetPriority === 'P5')) {
      throw new ApiError(400, 'Policy violation: Enterprise tickets must always stay at least P1.');
    }

    if (updates.category) {
      ticket.category = updates.category;
    }

    if (updates.priority) {
      // Record original AI priority if changed
      if (!ticket.ai_priority) {
        ticket.ai_priority = ticket.priority;
      }
      ticket.priority = updates.priority;
    }

    ticket.review_reason = updates.review_reason.trim();
    ticket.triage_decision = updates.triage_decision ?? 'auto_accept';
    ticket.updated_at = new Date().toISOString();

    this.tickets.set(id, ticket);
    this.emit({ type: 'ticket_updated', ticket });

    return { ...ticket };
  }

  /**
   * GET /tickets/updates?since=
   */
  public async getUpdates(sinceIsoString: string): Promise<Ticket[]> {
    await this.simulateNetwork();

    const sinceDate = new Date(sinceIsoString).getTime();
    if (isNaN(sinceDate)) {
      throw new ApiError(400, 'Invalid "since" ISO date parameter');
    }

    const items = Array.from(this.tickets.values()).filter((t) => {
      const updatedTime = t.updated_at ? new Date(t.updated_at).getTime() : 0;
      const createdTime = new Date(t.created_at).getTime() || 0;
      return updatedTime > sinceDate || createdTime > sinceDate;
    });

    return items;
  }
}

export class ApiError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Global singleton instance
export const fakeApi = new FakeApiServer();
