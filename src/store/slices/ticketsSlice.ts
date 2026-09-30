import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Status, Ticket, TicketFilters } from '@/types/ticket';
import { fakeApi } from '@/services/api/fakeApiServer';
import { syncQueue } from '@/services/offline/syncQueue';

interface TicketsState {
  items: Ticket[];
  selectedTicket: Ticket | null;
  filters: TicketFilters;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
}

const initialState: TicketsState = {
  items: [],
  selectedTicket: null,
  filters: {
    status: 'all',
    priority: 'all',
    mineOnly: false,
    searchQuery: '',
  },
  page: 1,
  hasMore: true,
  isLoading: false,
  isRefreshing: false,
  isLoadingMore: false,
  error: null,
};

// Fetch initial page or reload
export const fetchTickets = createAsyncThunk(
  'tickets/fetchTickets',
  async (
    {
      filters,
      page = 1,
      isRefresh = false,
      agentId,
    }: {
      filters: TicketFilters;
      page?: number;
      isRefresh?: boolean;
      agentId?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await fakeApi.getTickets(filters, page, 25, agentId);
      // Cache fresh data for offline use
      if (page === 1) {
        await syncQueue.saveCachedTickets(res.data);
      }
      return { res, isRefresh };
    } catch (err: any) {
      // If network fails, attempt to read cached tickets
      if (page === 1) {
        const cached = await syncQueue.getCachedTickets();
        if (cached && cached.length > 0) {
          return {
            res: {
              data: cached,
              total: cached.length,
              page: 1,
              totalPages: 1,
              hasMore: false,
            },
            isRefresh,
            isFromCache: true,
          };
        }
      }
      return rejectWithValue(err.message || 'Failed to fetch tickets');
    }
  }
);

// Load more (pagination infinite scroll)
export const loadMoreTickets = createAsyncThunk(
  'tickets/loadMoreTickets',
  async (
    { filters, agentId }: { filters: TicketFilters; agentId?: string },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { tickets: TicketsState };
    if (!state.tickets.hasMore || state.tickets.isLoadingMore) {
      return null;
    }
    const nextPage = state.tickets.page + 1;
    try {
      const res = await fakeApi.getTickets(filters, nextPage, 25, agentId);
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to load more');
    }
  }
);

// Fetch single ticket details
export const fetchTicketById = createAsyncThunk(
  'tickets/fetchTicketById',
  async (ticketId: string, { getState, rejectWithValue }) => {
    try {
      const ticket = await fakeApi.getTicketById(ticketId);
      return ticket;
    } catch (err: any) {
      // Check if ticket already exists in store memory/cache
      const state = getState() as { tickets: TicketsState };
      const local = state.tickets.items.find((t) => t.external_id === ticketId);
      if (local) {
        return local;
      }
      return rejectWithValue(err.message || 'Ticket not found');
    }
  }
);

const ticketsSlice = createSlice({
  name: 'tickets',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<TicketFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = {
        status: 'all',
        priority: 'all',
        mineOnly: false,
        searchQuery: '',
      };
    },
    // Optimistic Claim
    optimisticClaim: (state, action: PayloadAction<{ ticketId: string; agentId: string }>) => {
      const { ticketId, agentId } = action.payload;
      const index = state.items.findIndex((t) => t.external_id === ticketId);
      if (index !== -1) {
        state.items[index].assigned_to = agentId;
        if (state.items[index].status === 'open') {
          state.items[index].status = 'in_progress';
        }
        state.items[index].isOptimistic = true;
      }
      if (state.selectedTicket && state.selectedTicket.external_id === ticketId) {
        state.selectedTicket.assigned_to = agentId;
        if (state.selectedTicket.status === 'open') {
          state.selectedTicket.status = 'in_progress';
        }
        state.selectedTicket.isOptimistic = true;
      }
    },
    // Optimistic Status Update
    optimisticStatusUpdate: (
      state,
      action: PayloadAction<{ ticketId: string; newStatus: Status; agentId: string }>
    ) => {
      const { ticketId, newStatus, agentId } = action.payload;
      const index = state.items.findIndex((t) => t.external_id === ticketId);
      if (index !== -1) {
        state.items[index].status = newStatus;
        if (newStatus === 'in_progress' && !state.items[index].assigned_to) {
          state.items[index].assigned_to = agentId;
        }
        state.items[index].isOptimistic = true;
      }
      if (state.selectedTicket && state.selectedTicket.external_id === ticketId) {
        state.selectedTicket.status = newStatus;
        if (newStatus === 'in_progress' && !state.selectedTicket.assigned_to) {
          state.selectedTicket.assigned_to = agentId;
        }
        state.selectedTicket.isOptimistic = true;
      }
    },
    // Rollback if server rejected
    rollbackTicket: (state, action: PayloadAction<{ ticketId: string; previousState: Partial<Ticket> }>) => {
      const { ticketId, previousState } = action.payload;
      const index = state.items.findIndex((t) => t.external_id === ticketId);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...previousState, isOptimistic: false };
      }
      if (state.selectedTicket && state.selectedTicket.external_id === ticketId) {
        state.selectedTicket = { ...state.selectedTicket, ...previousState, isOptimistic: false };
      }
    },
    // Server or Remote updated ticket
    ticketUpdatedFromRemote: (state, action: PayloadAction<Ticket>) => {
      const ticket = action.payload;
      const index = state.items.findIndex((t) => t.external_id === ticket.external_id);
      if (index !== -1) {
        state.items[index] = { ...ticket, isOptimistic: false };
      } else {
        // Prepend new incoming ticket
        state.items.unshift({ ...ticket, isOptimistic: false });
      }
      if (state.selectedTicket && state.selectedTicket.external_id === ticket.external_id) {
        state.selectedTicket = { ...ticket, isOptimistic: false };
      }
    },
    clearSelectedTicket: (state) => {
      state.selectedTicket = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchTickets
      .addCase(fetchTickets.pending, (state, action) => {
        if (action.meta.arg.isRefresh) {
          state.isRefreshing = true;
        } else {
          state.isLoading = true;
        }
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isRefreshing = false;
        const { res } = action.payload;
        state.items = res.data;
        state.page = res.page;
        state.hasMore = res.hasMore;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.isLoading = false;
        state.isRefreshing = false;
        state.error = action.payload as string;
      })
      // loadMoreTickets
      .addCase(loadMoreTickets.pending, (state) => {
        state.isLoadingMore = true;
      })
      .addCase(loadMoreTickets.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        if (action.payload) {
          // Append and deduplicate
          const existingIds = new Set(state.items.map((t) => t.external_id));
          const newUnique = action.payload.data.filter((t) => !existingIds.has(t.external_id));
          state.items.push(...newUnique);
          state.page = action.payload.page;
          state.hasMore = action.payload.hasMore;
        }
      })
      .addCase(loadMoreTickets.rejected, (state) => {
        state.isLoadingMore = false;
      })
      // fetchTicketById
      .addCase(fetchTicketById.fulfilled, (state, action) => {
        state.selectedTicket = action.payload;
      });
  },
});

export const {
  setFilters,
  resetFilters,
  optimisticClaim,
  optimisticStatusUpdate,
  rollbackTicket,
  ticketUpdatedFromRemote,
  clearSelectedTicket,
} = ticketsSlice.actions;

export default ticketsSlice.reducer;
