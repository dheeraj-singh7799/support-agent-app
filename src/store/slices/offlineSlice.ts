import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  toastMessage: string | null;
  toastType: 'info' | 'error' | 'success' | null;
}

const initialState: OfflineState = {
  isOnline: true,
  pendingCount: 0,
  toastMessage: null,
  toastType: null,
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setIsOnline: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setPendingCount: (state, action: PayloadAction<number>) => {
      state.pendingCount = action.payload;
    },
    showToast: (
      state,
      action: PayloadAction<{ message: string; type?: 'info' | 'error' | 'success' }>
    ) => {
      state.toastMessage = action.payload.message;
      state.toastType = action.payload.type || 'info';
    },
    hideToast: (state) => {
      state.toastMessage = null;
      state.toastType = null;
    },
  },
});

export const { setIsOnline, setPendingCount, showToast, hideToast } = offlineSlice.actions;
export default offlineSlice.reducer;
