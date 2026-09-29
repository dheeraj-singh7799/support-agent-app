export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | string;
export type Status = 'open' | 'in_progress' | 'resolved' | 'closed';
export type CustomerPlan = 'free' | 'pro' | 'enterprise' | 'platinum' | string;
export type TriageDecision = 'auto_accept' | 'manual_review' | string;

export interface Ticket {
  external_id: string;
  customer_id: string;
  customer_plan: CustomerPlan;
  subject: string;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
  status: Status;
  assigned_to: string | null;
  category: string;
  priority: Priority;
  ai_priority?: Priority;
  summary: string | null;
  triage_decision: TriageDecision;
  review_reason: string | null;
  updated_at?: string;
  // Local flags
  isOptimistic?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
}

export const KNOWN_AGENTS: Agent[] = [
  { id: 'agent-1', name: 'Priya' },
  { id: 'agent-2', name: 'Rahul' },
  { id: 'agent-3', name: 'Meera' },
];

export interface SlaInfo {
  totalSeconds: number;
  remainingSeconds: number;
  isOverdue: boolean;
  isAtRisk: boolean; // less than 20% time left
  statusText: string;
  badgeType: 'late' | 'at_risk' | 'on_track' | 'future';
  formattedCountdown: string;
}

export interface TicketFilters {
  status?: Status | 'all';
  priority?: Priority | 'all';
  mineOnly?: boolean;
  searchQuery?: string;
}

export type OutboxActionType = 'CLAIM' | 'UPDATE_STATUS' | 'TRIAGE_REVIEW';

export interface OutboxMutation {
  id: string;
  type: OutboxActionType;
  ticketId: string;
  agentId: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  previousState?: Partial<Ticket>;
}
