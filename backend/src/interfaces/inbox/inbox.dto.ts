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

export type MessageType = 'message' | 'support-request' | 'send-tips';

export interface SenderUser {
  id: string;
  senderName: string;
  senderTitle: string;
  senderAvatar: string;
}

export interface Message {
  id: string;
  sender: SenderUser;
  lastMessage: string;
  timestamp: string;
  isUnread: boolean;
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
  sender: SenderUser;
  type: SupportType;
  message: string;
  amount: number;
  status: SupportRequestStatus;
  timestamp: string;
  threadId?: string | null; // Accept edilmişse thread ID, yoksa null. Support chat açılırken GET /messages/{threadId} ile mesajlar yüklenir.
  requestId?: string;
  fromUserId: string; // Request'i oluşturan kullanıcı ID'si (required)
  toUserId: string; // Request'in gönderildiği kullanıcı ID'si (required)
}

export interface TipsInfo {
  id: string;
  sender: SenderUser;
  amount: number;
  message: string;
  timestamp: string;
}

export interface MessageFeedItem {
  id: string;
  type: MessageType;
  data: Message | SupportRequest | TipsInfo;
}

export interface MessageFeed {
  messages: MessageFeedItem[];
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
