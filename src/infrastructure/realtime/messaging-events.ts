export type MessageEventType = 'message' | 'support-request' | 'send-tips';

export interface NewMessageEvent {
  messageId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: MessageEventType;
  timestamp: string;
}

export interface MessageSentEvent extends NewMessageEvent {}

export interface MessageReadEvent {
  messageId: string;
  threadId: string;
  readBy: string;
  timestamp: string;
}

export interface TypingEvent {
  userId: string;
  threadId: string;
  isTyping: boolean;
}

export interface PresenceEvent {
  userId: string;
  status: 'online' | 'offline';
  timestamp: string;
}

