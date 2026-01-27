/**
 * @openapi
 * components:
 *   schemas:
 *     SupportType:
 *       type: string
 *       enum: [GENERAL, TECHNICAL, PRODUCT]
 *     SupportRequestStatus:
 *       type: string
 *       enum: [pending, accepted, rejected, canceled, awaiting_completion, completed, reported]
 *     MessageType:
 *       type: string
 *       enum: [message, support-request, send-tips]
 *     SenderUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         senderName:
 *           type: string
 *         senderTitle:
 *           type: string
 *         senderAvatar:
 *           type: string
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         sender:
 *           $ref: '#/components/schemas/SenderUser'
 *         lastMessage:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         isUnread:
 *           type: boolean
 *     SupportChatMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         senderId:
 *           type: string
 *         message:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *     SupportRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         sender:
 *           $ref: '#/components/schemas/SenderUser'
 *         type:
 *           $ref: '#/components/schemas/SupportType'
 *         message:
 *           type: string
 *         amount:
 *           type: number
 *         status:
 *           $ref: '#/components/schemas/SupportRequestStatus'
 *         timestamp:
 *           type: string
 *           format: date-time
 *         threadId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: |
 *             Support request'in bağlı olduğu support thread ID.
 *             - status: "pending" → threadId: null (henüz accept edilmemiş, thread oluşturulmamış)
 *             - status: "accepted" → threadId: "uuid" (accept edildiğinde oluşturulan unique support thread ID)
 *             - status: "rejected" → threadId: null
 *             
 *             Her support request accept edildiğinde yeni bir unique support thread oluşturulur (is_support_thread=true) 
 *             ve bu thread ID'si DMRequest.threadId field'ına kaydedilir. 
 *             Bu ID ile support chat açılır ve GET /messages/{threadId} endpoint'i ile sadece SUPPORT context'li mesajlar yüklenir.
 *     TipsInfo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         sender:
 *           $ref: '#/components/schemas/SenderUser'
 *         amount:
 *           type: number
 *         message:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *     MessageFeedItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           $ref: '#/components/schemas/MessageType'
 *         data:
 *           oneOf:
 *             - $ref: '#/components/schemas/Message'
 *             - $ref: '#/components/schemas/SupportRequest'
 *             - $ref: '#/components/schemas/TipsInfo'
 *     MessageFeed:
 *       type: object
 *       properties:
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MessageFeedItem'
 *     SupportRequestCreate:
 *       type: object
 *       required:
 *         - senderUserId
 *         - recipientUserId
 *         - type
 *         - message
 *         - amount
 *         - status
 *         - timestamp
 *       properties:
 *         senderUserId:
 *           type: string
 *           format: uuid
 *         recipientUserId:
 *           type: string
 *           format: uuid
 *         type:
 *           $ref: '#/components/schemas/SupportType'
 *         message:
 *           type: string
 *         amount:
 *           type: string
 *         status:
 *           $ref: '#/components/schemas/SupportRequestStatus'
 *         timestamp:
 *           type: string
 *           format: date-time
 *     SendTipsCreate:
 *       type: object
 *       required:
 *         - senderUserId
 *         - recipientUserId
 *         - message
 *         - amount
 *         - timestamp
 *       properties:
 *         senderUserId:
 *           type: string
 *           format: uuid
 *         recipientUserId:
 *           type: string
 *           format: uuid
 *         message:
 *           type: string
 *         amount:
 *           type: number
 *         timestamp:
 *           type: string
 *           format: date-time
 */

export type SupportType = 'GENERAL' | 'TECHNICAL' | 'PRODUCT';

export type SupportRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled' | 'awaiting_completion' | 'completed' | 'reported';

export type MessageType = 'message' | 'image' | 'support-request' | 'send-tips';

export interface SenderUser {
  id: string;
  senderName: string;
  senderTitle: string;
  senderAvatar: string;
}

export interface Message {
  id: string;
  senderId: string; // Sadece senderId (participants'tan alınacak)
  sender?: SenderUser; // Geriye dönük uyumluluk için (deprecated, participants kullanın)
  message?: string; // Normal mesaj için zorunlu, image için opsiyonel (caption olarak kullanılabilir)
  lastMessage?: string; // Geriye dönük uyumluluk için (deprecated, message kullanın)
  timestamp: string;
  isUnread: boolean;
  // Image için media field'ları (opsiyonel)
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
  // Gruplanmış mesajlar (DEPRECATED - artık kullanılmıyor, her mesaj tek tek gelir)
  groupedMessages?: Array<{
    id: string;
    type: MessageType; // Mesaj tipi (message, image, send-tips, support-request)
    message?: string;
    mediaUrl?: string | null;
    thumbnailUrl?: string | null;
    caption?: string | null;
    timestamp: string;
    isUnread: boolean;
    // send-tips için
    amount?: number;
    // support-request için
    supportType?: SupportType;
    supportStatus?: SupportRequestStatus;
    supportAmount?: number;
  }>;
}

/**
 * Support request mesaj grubunun içerisinde yer alan bireysel mesajlar
 */
export interface SupportChatMessage {
  id: string;
  senderId: string;
  message: string;
  timestamp: string;
}

/**
 * Support request (DM ekranında sadece özet gösterilir)
 * Support chat açılırken threadId ile GET /messages/{threadId} çağrısı yapılarak mesajlar yüklenir.
 */
export interface SupportRequest {
  id: string;
  senderId: string; // Sadece senderId (participants'tan alınacak)
  sender?: SenderUser; // Geriye dönük uyumluluk için (deprecated, participants kullanın)
  type: SupportType;
  message: string;
  amount: number;
  status: SupportRequestStatus;
  timestamp: string;
  threadId?: string | null; // Accept edilmişse thread ID, yoksa null. Support chat açılırken GET /messages/{threadId} ile mesajlar yüklenir.
  requestId?: string;
  fromUserId: string; // Request'i oluşturan kullanıcı ID'si (required)
  toUserId: string; // Request'in gönderildiği kullanıcı ID'si (required)
  isUnread?: boolean; // Opsiyonel, default: false
}

export interface TipsInfo {
  id: string;
  senderId: string; // Sadece senderId (participants'tan alınacak)
  sender?: SenderUser; // Geriye dönük uyumluluk için (deprecated, participants kullanın)
  amount: number;
  message?: string; // Opsiyonel
  timestamp: string;
  isUnread?: boolean; // Opsiyonel, default: false
}

export interface MessageFeedItem {
  id: string;
  type: MessageType;
  data: Message | SupportRequest | TipsInfo; // Message artık image için de kullanılabilir (type: "image" olduğunda)
}

export interface ThreadParticipant {
  id: string;
  name: string;
  title: string;
  avatar: string;
  isOnline?: boolean; // Opsiyonel - online durumu
  lastSeen?: string; // Opsiyonel - son görülme zamanı
}

export interface ThreadParticipants {
  userOne: ThreadParticipant;
  userTwo: ThreadParticipant;
}

// Yeni yapı: Key-value format (user-1, user-2)
export interface ThreadParticipantsMap {
  [userId: string]: ThreadParticipant;
}

export interface MessageFeed {
  messages: MessageFeedItem[];
}

export interface PaginatedMessageFeed {
  items: MessageFeedItem[];
  pagination: {
    cursor?: string; // Timestamp veya message ID (son item'ın timestamp'i)
    hasMore: boolean;
    limit: number;
  };
}

export interface SupportRequestCreate {
  senderUserId: string;
  recipientUserId: string;
  type: SupportType;
  message: string;
  amount: string;
  status: SupportRequestStatus;
  timestamp: string;
}

export interface SendTipsCreate {
  senderUserId: string;
  recipientUserId: string;
  message: string;
  amount: number;
  timestamp: string;
}

export interface UpdateMessageRequest {
  message: string;
}

export interface MessageDetail {
  id: string;
  threadId: string;
  senderId: string;
  message: string;
  messageType: 'message' | 'image' | 'video' | 'audio' | 'file' | 'send-tips' | 'support-request';
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'audio' | 'file' | null;
  thumbnailUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  caption?: string | null;
  replyToMessageId?: string | null;
  replyToMessage?: {
    id: string;
    message: string;
    senderName: string;
  } | null;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  isDeleted: boolean;
  isEdited: boolean;
  editedAt?: string | null;
  sentAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  sender: SenderUser;
  reactions?: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
}

export interface AddReactionRequest {
  emoji: string;
}

export interface AddReactionResponse {
  reactionId: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface RemoveReactionResponse {
  messageId: string;
  reactionId: string;
  deletedAt: string;
}

/**
 * Yeni thread response yapısı - WhatsApp/Instagram tarzı
 */
export interface ThreadInfo {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface DateInfo {
  timestamp: string; // ISO date string (00:00:00.000Z)
  displayText: string; // "Today", "Yesterday", "15 Jan 2024" gibi
  dayKey: string; // "2024-01-15" formatında
}

export interface MessageContent {
  // Text mesaj için
  text?: string;
  // Image mesaj için
  mediaUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  fileSize?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  // TIPS için
  amount?: number;
  currency?: string;
  // Support request için
  type?: SupportType;
  message?: string;
  status?: SupportRequestStatus;
  threadId?: string | null;
}

export interface GroupedMessage {
  id: string;
  type: 'message' | 'image' | 'send-tips' | 'support-request';
  sentAt: string;
  isRead: boolean;
  readAt?: string | null;
  content: MessageContent;
}

export interface MessageGroup {
  groupId: string;
  senderId: string;
  startTime: string; // İlk mesajın timestamp'i
  endTime: string; // Son mesajın timestamp'i
  messages: GroupedMessage[];
}

export interface DateGroup {
  date: DateInfo;
  messageGroups: MessageGroup[];
}

export interface ThreadMessagesResponse {
  thread: ThreadInfo;
  participants: ThreadParticipantsMap; // Key-value format: { "user-1": {...}, "user-2": {...} }
  dateGroups: DateGroup[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    totalCount?: number;
  };
}

export interface GetReactionsResponse {
  messageId: string;
  reactions: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
}

export interface EditMessageRequest {
  message: string;
}

export interface EditMessageResponse {
  messageId: string;
  message: string;
  editedAt: string;
}

export interface DeleteMessageResponse {
  messageId: string;
  deletedAt: string;
}

export interface MediaUploadRequest {
  mediaType: 'image' | 'video' | 'audio' | 'file';
  caption?: string;
  fileName?: string;
  fileSize?: number;
}

export interface MediaUploadResponse {
  messageId: string;
  threadId: string;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  caption?: string | null;
  sentAt: string;
}

export interface SearchMessagesRequest {
  q: string;
  limit?: number;
  offset?: number;
}

export interface SearchMessagesResponse {
  messages: MessageDetail[];
  total: number;
  hasMore: boolean;
}
