/**
 * @openapi
 * components:
 *   schemas:
 *     SupportType:
 *       type: string
 *       enum: [GENERAL, TECHNICAL, PRODUCT]
 *     SupportRequestStatus:
 *       type: string
 *       enum: [pending, accepted, rejected]
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

export type SupportRequestStatus = 'pending' | 'accepted' | 'rejected';

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

export interface SupportRequest {
  id: string;
  sender: SenderUser;
  type: SupportType;
  message: string;
  amount: number;
  status: SupportRequestStatus;
  timestamp: string;
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

