import { useEffect, useRef } from 'react';
import { Alert, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import { fakeApi } from '@/services/api/fakeApiServer';
import { useAppDispatch, useAppSelector } from '@/store';
import { ticketUpdatedFromRemote } from '@/store/slices/ticketsSlice';
import { showToast } from '@/store/slices/offlineSlice';

const SEEN_P0_TICKETS_KEY = 'support_agent_seen_p0_tickets_v1';

export function useUrgentAlerts() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const tokenRef = useRef<string | null>(token);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    let notificationsModule: any = null;

    async function setupNotifications() {
      // Load seen P0 tickets from storage to prevent duplicate alerts
      try {
        const stored = await AsyncStorage.getItem(SEEN_P0_TICKETS_KEY);
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          seenIdsRef.current = new Set(parsed);
        }
      } catch (err) {
        console.warn('Failed to load seen P0 tickets:', err);
      }

      // If running in Expo Go on Android, expo-notifications remote push was removed in SDK 53+.
      // We only attempt to initialize expo-notifications in standalone/dev builds.
      if (!isRunningInExpoGo()) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          notificationsModule = require('expo-notifications');
          notificationsModule.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });

          const { status: existingStatus } = await notificationsModule.getPermissionsAsync();
          if (existingStatus !== 'granted') {
            await notificationsModule.requestPermissionsAsync();
          }

          await notificationsModule.setNotificationChannelAsync('urgent-tickets', {
            name: 'Urgent P0 Tickets',
            importance: notificationsModule.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        } catch {
          notificationsModule = null;
        }
      }
    }

    setupNotifications();

    // Subscribe to fakeApi for new incoming tickets
    const unsubscribeApi = fakeApi.subscribe(async (event) => {
      const ticket = event.ticket;

      // Update Redux state with newly arrived or changed ticket
      dispatch(ticketUpdatedFromRemote(ticket));

      // Check if it's a P0 ticket that hasn't been alerted yet
      if (ticket.priority === 'P0' && !seenIdsRef.current.has(ticket.external_id)) {
        seenIdsRef.current.add(ticket.external_id);

        // Persist seen set to AsyncStorage ("Never alert twice for the same ticket")
        try {
          await AsyncStorage.setItem(
            SEEN_P0_TICKETS_KEY,
            JSON.stringify(Array.from(seenIdsRef.current))
          );
        } catch (e) {
          console.error('Failed to save seen P0 ticket:', e);
        }

        // Only trigger audio/modal interruption if the agent is signed in
        if (tokenRef.current) {
          // Haptic / Sound feedback
          try {
            Vibration.vibrate([0, 250, 250, 250]);
          } catch {}

          // Global Alert Toast
          dispatch(
            showToast({
              message: `🚨 URGENT P0 TICKET: ${ticket.external_id} (${ticket.customer_plan.toUpperCase()})`,
              type: 'error',
            })
          );

          // Try local system notification if module is available (in dev builds)
          let didSendSystemNotif = false;
          if (notificationsModule?.scheduleNotificationAsync) {
            try {
              await notificationsModule.scheduleNotificationAsync({
                content: {
                  title: `🚨 URGENT P0 TICKET: ${ticket.external_id}`,
                  body: ticket.subject || 'A new critical P0 ticket requires immediate attention.',
                  data: { ticketId: ticket.external_id },
                  sound: true,
                },
                trigger: null,
              });
              didSendSystemNotif = true;
            } catch {
              didSendSystemNotif = false;
            }
          }

          // In Expo Go or if system notification is unavailable, show actionable Alert modal:
          // "Tapping the alert opens that ticket"
          if (!didSendSystemNotif) {
            Alert.alert(
              `🚨 URGENT P0 TICKET: ${ticket.external_id}`,
              `${ticket.subject || 'Critical incident reported.'}\n\nCustomer Plan: ${ticket.customer_plan.toUpperCase()}`,
              [
                { text: 'Dismiss', style: 'cancel' },
                {
                  text: 'Open Ticket',
                  style: 'default',
                  onPress: () => {
                    router.push(`/tickets/${ticket.external_id}` as any);
                  },
                },
              ]
            );
          }
        }
      }
    });

    return () => {
      unsubscribeApi();
    };
  }, [dispatch]);
}
