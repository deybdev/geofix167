import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import tw from 'twrnc';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/residentService';

export default function Notifications() {
  const [request, setRequest] = useState({ cursor: null, attempt: 0 });
  const [result, setResult] = useState(null);
  const [items, setItems] = useState([]);

  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  async function mark(id) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      if (id === null) await markAllNotificationsRead();
      else await markNotificationRead(id);
      setItems(previous => previous.map(item =>
        id === null || item.id === id ? { ...item, is_read: 1 } : item));
      setUnread(previous => id === null ? 0 : Math.max(0, previous - 1));
      setFailed(null);
    } catch {
      setFailed({ id });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    getNotifications({ signal: controller.signal, cursor: request.cursor })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setUnread(data.unread_count);
        setItems(previous => request.cursor
          ? [...previous, ...data.notifications.filter(item => !previous.some(existing => existing.id === item.id))]
          : data.notifications);
        setResult({ request, nextCursor: data.next_cursor });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        const status = error.response?.status ?? error.status;
        console.warn('Resident notifications request failed', {
          endpoint: 'GET /api/notifications',
          status: status ?? 'No HTTP status (network failure)',
        });
        setResult({ request, error: status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'Unable to load notifications. Please try again.' });
      });
    return () => controller.abort();
  }, [request]));

  const current = result?.request === request ? result : null;
  const visibleItems = request.cursor || (current && !current.error) ? items : [];

  return (
    <ScrollView contentContainerStyle={tw`p-4 pb-8`}>
      {unread > 0 && (
        <View style={tw`mb-3 flex-row justify-end`}>
          <Action
            label="Mark all as read"
            compact
            disabled={saving || !current || !!current.error}
            onPress={() => mark(null)}
          />
        </View>
      )}
      {failed && (
        <View style={tw`mb-3 rounded-2xl border border-red-100 bg-red-50 p-4`}>
          <Text accessibilityRole="alert" style={tw`text-xs font-semibold text-red-700`}>
            Could not update read status. Please try again.
          </Text>
          <Action
            label="Retry"
            compact
            style={tw`mt-2.5 self-start`}
            disabled={saving || !current || !!current.error}
            onPress={() => mark(failed.id)}
          />
        </View>
      )}
      {visibleItems.map(item => (
        <View
          key={item.id}
          style={[
            tw`mb-3 rounded-2xl border bg-white p-4`,
            item.is_read ? tw`border-slate-100` : tw`border-emerald-200`,
          ]}
        >
          <View style={tw`flex-row items-start justify-between gap-2`}>
            <Text style={tw`flex-1 text-base font-bold text-slate-900`}>
              {item.title || 'Notification'}
            </Text>
            {!item.is_read && (
              <View style={tw`mt-1.5 h-2.5 w-2.5 rounded-full bg-green-600`} />
            )}
          </View>

          {!!item.body && (
            <Text style={tw`mt-1.5 text-sm leading-5 text-slate-600`}>
              {item.body}
            </Text>
          )}

          <View style={tw`mt-3 flex-row items-center justify-between gap-3 border-t border-slate-100 pt-2.5`}>
            <Text style={tw`flex-1 text-xs text-slate-400`}>
              {item.created_at ? formatDate(item.created_at) : ''}
            </Text>

            {item.is_read ? (
              <Text style={tw`text-xs font-semibold text-slate-400`}>Read</Text>
            ) : (
              <Action
                label="Mark as read"
                compact
                disabled={saving || !current || !!current.error}
                onPress={() => mark(item.id)}
              />
            )}
          </View>
        </View>
      ))}
      {!current ? (
        <View style={tw`items-center py-8`}>
          <ActivityIndicator color="#1F7A4D" />
          <Text style={tw`mt-3 text-slate-600`}>Loading notifications...</Text>
        </View>
      ) : current.error ? (
        <View style={tw`rounded-2xl bg-white p-4`}>
          <Text accessibilityRole="alert" style={tw`text-slate-700`}>{current.error}</Text>
          <Action label="Retry" style={tw`mt-4 self-start`} onPress={() => setRequest(previous => ({ ...previous, attempt: previous.attempt + 1 }))} />
        </View>
      ) : (
        <>
          {!items.length && <Text style={tw`py-8 text-center text-slate-600`}>No notifications yet.</Text>}
          {!!current.nextCursor && <Action label="Load more" style={tw`mt-2 self-center`} disabled={saving} onPress={() => setRequest({ cursor: current.nextCursor, attempt: 0 })} />}
        </>
      )}
    </ScrollView>
  );
}

function Action({ label, onPress, disabled, compact = false, style }) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        tw`rounded-xl bg-green-700`,
        compact ? tw`px-3 py-1.5` : tw`px-4 py-3`,
        { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[tw`font-bold text-white`, compact ? tw`text-xs` : tw`text-sm`]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}
