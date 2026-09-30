import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAppDispatch } from '@/store';
import { setIsOnline, setPendingCount, showToast } from '@/store/slices/offlineSlice';
import { rollbackTicket, ticketUpdatedFromRemote } from '@/store/slices/ticketsSlice';
import { syncQueue } from '@/services/offline/syncQueue';

export function useNetworkSync() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // 1. Initial queue count
    dispatch(setPendingCount(syncQueue.getPendingCount()));

    // 2. Listen to outbox queue count changes
    const unsubQueue = syncQueue.onQueueChange((count) => {
      dispatch(setPendingCount(count));
    });

    // 3. Listen to conflicts / rejections ("The server is always right")
    const unsubConflict = syncQueue.onConflict((mutation, error) => {
      // Rollback ticket in Redux
      if (mutation.previousState) {
        dispatch(
          rollbackTicket({
            ticketId: mutation.ticketId,
            previousState: mutation.previousState,
          })
        );
      }

      // Tell agent what happened
      dispatch(
        showToast({
          message: `Server Rejection (${mutation.ticketId}): ${error.message}`,
          type: 'error',
        })
      );
    });

    // 4. NetInfo subscription
    const unsubNet = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      dispatch(setIsOnline(online));

      if (online) {
        // Drain pending queue when connection comes back
        syncQueue
          .drainQueue((updatedTicket) => {
            dispatch(ticketUpdatedFromRemote(updatedTicket));
          })
          .then(({ processed, conflicts }) => {
            if (processed > 0) {
              dispatch(
                showToast({
                  message: `Synced ${processed} offline change${processed > 1 ? 's' : ''}`,
                  type: 'success',
                })
              );
            }
          });
      }
    });

    return () => {
      unsubQueue();
      unsubConflict();
      unsubNet();
    };
  }, [dispatch]);
}
