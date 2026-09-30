import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { fakeApi } from '@/services/api/fakeApiServer';
import { useAppDispatch } from '@/store';
import { ticketUpdatedFromRemote } from '@/store/slices/ticketsSlice';

const SEEN_P0_TICKETS_KEY = 'support_agent_seen_p0_tickets_v1';

// Configure notification presentation when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useUrgentAlerts() {
  const dispatch = useAppDispatch();
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 1. Request notification permissions
    async function setupNotifications() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }

        // On Android, configure high importance channel for urgent P0 alerts
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('urgent-tickets', {
            name: 'Urgent P0 Tickets',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        // Load seen P0 tickets from storage to prevent duplicate alerts
        const stored = await AsyncStorage.getItem(SEEN_P0_TICKETS_KEY);
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          seenIdsRef.current = new Set(parsed);
        }
      } catch (err) {
        console.warn('Notification setup notice:', err);
      }
    }

    setupNotifications();

    // 2. Listen to tap on notification to navigate to ticket screen
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const ticketId = response.notification.request.content.data?.ticketId;
      if (ticketId) {
        router.push(`/tickets/${ticketId}` as any);
      }
    });

    // 3. Subscribe to fakeApi for new tickets
    const unsubscribeApi = fakeApi.subscribe(async (event) => {
      const ticket = event.ticket;

      // Update Redux state with newly arrived or changed ticket
      dispatch(ticketUpdatedFromRemote(ticket));

      // Check if it's a P0 ticket that hasn't been alerted yet
      if (ticket.priority === 'P0' && !seenIdsRef.current.has(ticket.external_id)) {
        seenIdsRef.current.add(ticket.external_id);

        // Persist seen set to AsyncStorage
        try {
          await AsyncStorage.setItem(
            SEEN_P0_TICKETS_KEY,
            JSON.stringify(Array.from(seenIdsRef.current))
          );
        } catch (e) {
          console.error('Failed to save seen P0 ticket:', e);
        }

        // Trigger Urgent Alert
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🚨 URGENT P0 TICKET: ${ticket.external_id}`,
              body: ticket.subject || 'A new critical P0 ticket requires immediate attention.',
              data: { ticketId: ticket.external_id },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null, // trigger immediately
          });
        } catch (notifErr) {
          console.warn('Could not schedule local notification:', notifErr);
        }
      }
    });

    return () => {
      responseSubscription.remove();
      unsubscribeApi();
    };
  }, [dispatch]);
}
