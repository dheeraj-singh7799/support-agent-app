import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Agent } from '@/types/ticket';
import { fakeApi } from '@/services/api/fakeApiServer';

const AUTH_STORAGE_KEY = 'support_agent_auth_session_v1';

interface AuthState {
  agent: Agent | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

const initialState: AuthState = {
  agent: null,
  token: null,
  isLoading: false,
  error: null,
  isInitialized: false,
};

export const checkSavedSession = createAsyncThunk('auth/checkSavedSession', async () => {
  const data = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (data) {
    const parsed = JSON.parse(data);
    return parsed as { token: string; agent: Agent };
  }
  return null;
});

export const loginAgent = createAsyncThunk(
  'auth/loginAgent',
  async ({ agentId, pin }: { agentId: string; pin: string }, { rejectWithValue }) => {
    try {
      const res = await fakeApi.login(agentId, pin);
      const sessionData = { token: res.token, agent: res.agent };
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
      return sessionData;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Login failed');
    }
  }
);

export const logoutAgent = createAsyncThunk('auth/logoutAgent', async () => {
  // Page 3: "Signing out removes everything the app saved about that agent."
  await AsyncStorage.multiRemove([
    AUTH_STORAGE_KEY,
    'support_agent_outbox_queue_v1',
    'support_agent_cached_tickets_v1',
    'support_agent_seen_p0_tickets_v1',
  ]);
  return true;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Check saved session
      .addCase(checkSavedSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.token = action.payload.token;
          state.agent = action.payload.agent;
        }
        state.isInitialized = true;
      })
      .addCase(checkSavedSession.rejected, (state) => {
        state.isInitialized = true;
      })
      // Login
      .addCase(loginAgent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginAgent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.agent = action.payload.agent;
      })
      .addCase(loginAgent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Logout
      .addCase(logoutAgent.fulfilled, (state) => {
        state.agent = null;
        state.token = null;
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
