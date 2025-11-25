# Messaging Socket Events Reference

This document summarizes the real-time messaging events exposed by the backend. All socket connections must provide a valid JWT during the Socket.IO handshake (`io.use` middleware already enforces this). Once connected, each user is placed into a personal room `user:{userId}` and can optionally join thread rooms `thread:{threadId}` for active conversations.

## Outgoing Events

| Event | Emitted To | Payload |
|-------|------------|---------|
| `new_message` | `thread:{threadId}`, `user:{recipientId}` | [`NewMessageEvent`](../src/infrastructure/realtime/messaging-events.ts) |
| `message_sent` | `user:{senderId}` | [`MessageSentEvent`](../src/infrastructure/realtime/messaging-events.ts) |
| `message_read` | `thread:{threadId}`, `user:{senderId}` | [`MessageReadEvent`](../src/infrastructure/realtime/messaging-events.ts) |
| `user_typing` | `thread:{threadId}` (excluding origin socket) | [`TypingEvent`](../src/infrastructure/realtime/messaging-events.ts) |
| `user_presence` | All clients | [`PresenceEvent`](../src/infrastructure/realtime/messaging-events.ts) |
| `connected` | Origin socket | `{ message, userId, userEmail }` |
| `thread_joined` / `thread_left` | Origin socket | `{ threadId }` |
| `thread_join_error` | Origin socket | `{ threadId, reason }` |
| `message_read_error` | Origin socket | `{ reason: string }` |

## Incoming Events

- `join_thread` – Payload: `threadId` (string). Joins the thread room after access validation.
- `leave_thread` – Payload: `threadId` (string). Removes the socket from the thread room.
- `typing_start`, `typing_stop` – Payload: `{ threadId }`. Broadcasts typing state to the thread room.
- `mark_message_read` – Payload: `{ messageId: string }`. Marks a message as read. Triggers `message_read` event. **Recommended:** Use this instead of REST endpoint.
- `ping` – Heartbeat helper; server responds with `pong`.

## REST Endpoints Affecting Sockets

- `POST /messages` → Triggers `new_message` and `message_sent` events.
- `POST /messages/support-requests` → Stores support request and pushes `new_message` notification.
- `POST /messages/tips` → Records TIPS transfer and emits `new_message` with `messageType: 'send-tips'`.
- `POST /messages/{messageId}/read` → **[DEPRECATED]** Use `mark_message_read` socket event instead. Calls `markMessageAsRead`, broadcasting `message_read`.

## Rooms Summary

- `user:{userId}` – Personal notifications (message arrivals, presence updates).
- `thread:{threadId}` – Live conversation updates (messages, typing, read receipts).

Use these event contracts when updating the frontend client or automated tests. Refer to the TypeScript interfaces in [`src/infrastructure/realtime/messaging-events.ts`](../src/infrastructure/realtime/messaging-events.ts) for the exact schema.*** End Patch to docs/MESSAGING_SOCKET_EVENTS.md***

