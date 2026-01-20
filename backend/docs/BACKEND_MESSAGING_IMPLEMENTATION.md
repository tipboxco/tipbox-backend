# Backend Messaging Implementation Guide

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Database Schema](#database-schema)
3. [REST API Endpoints](#rest-api-endpoints)
4. [Socket.IO Events](#socketio-events)
5. [Authentication & Authorization](#authentication--authorization)
6. [Error Handling](#error-handling)
7. [Real-time Logic](#real-time-logic)
8. [Performance Optimizations](#performance-optimizations)
9. [Security Considerations](#security-considerations)

---

## 🎯 Genel Bakış

Bu dokümantasyon, gerçek zamanlı mesajlaşma uygulaması için backend implementasyonunu detaylandırır. Express.js ve Socket.IO kullanılarak geliştirilmiştir.

### Teknoloji Stack
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: PostgreSQL (veya MongoDB)
- **Authentication**: JWT (Access Token + Refresh Token)
- **File Storage**: AWS S3 / Cloudinary / Local Storage

### Temel Özellikler
- ✅ Direct Messages (DM)
- ✅ 1-on-1 Support Requests
- ✅ TIPS (Gift) Messages
- ✅ Message Pagination & Infinite Scroll
- ✅ Media Upload (Image, Video, Audio, File)
- ✅ Message Deletion
- ✅ Message Editing
- ✅ Message Reply/Threading
- ✅ Message Search
- ✅ Message Reactions
- ✅ Typing Indicators
- ✅ Read Receipts
- ✅ Delivery Status Tracking
- ✅ Offline Message Queue Support

---

## 🗄️ Database Schema

### Messages Table

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL DEFAULT 'message', -- 'message', 'image', 'video', 'audio', 'file', 'send-tips', 'support-request'
  message TEXT,
  media_url TEXT,
  media_type VARCHAR(50), -- 'image', 'video', 'audio', 'file'
  thumbnail_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  caption TEXT,
  
  -- Reply/Threading
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  
  -- Status Tracking
  status VARCHAR(20) DEFAULT 'sent', -- 'sending', 'sent', 'delivered', 'read'
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id),
  
  -- Editing
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP,
  
  -- Timestamps
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  
  -- Indexes
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_message_id);
CREATE INDEX idx_messages_thread_sent_at ON messages(thread_id, sent_at DESC);
CREATE INDEX idx_messages_search ON messages USING gin(to_tsvector('turkish', message));
```

### Threads Table

```sql
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP,
  unread_count_participant_1 INT DEFAULT 0,
  unread_count_participant_2 INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: Her iki kullanıcı arasında sadece bir thread olabilir
  UNIQUE(participant_1_id, participant_2_id)
);

CREATE INDEX idx_threads_participant_1 ON threads(participant_1_id);
CREATE INDEX idx_threads_participant_2 ON threads(participant_2_id);
CREATE INDEX idx_threads_last_message_at ON threads(last_message_at DESC);
```

### Message Reactions Table

```sql
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL, -- Emoji string (örn: "👍", "❤️")
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Bir kullanıcı aynı mesaja aynı emoji ile sadece bir kez reaksiyon verebilir
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_reactions_user_id ON message_reactions(user_id);
```

### Support Requests Table

```sql
CREATE TABLE support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  support_type VARCHAR(100) NOT NULL, -- 'Product Authentication', 'Technical Support', etc.
  message TEXT NOT NULL,
  amount DECIMAL(10, 2),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'canceled', 'awaiting_completion', 'completed', 'reported'
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  canceled_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_requests_thread_id ON support_requests(thread_id);
CREATE INDEX idx_support_requests_from_user ON support_requests(from_user_id);
CREATE INDEX idx_support_requests_to_user ON support_requests(to_user_id);
CREATE INDEX idx_support_requests_status ON support_requests(status);
```

### Message Read Receipts Table

```sql
CREATE TABLE message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Bir kullanıcı bir mesajı sadece bir kez okuyabilir (unique constraint)
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_read_receipts_message_id ON message_read_receipts(message_id);
CREATE INDEX idx_read_receipts_user_id ON message_read_receipts(user_id);
```

---

## 🔌 REST API Endpoints

### Base URL
```
https://api.tipbox.com/api/v1
```

### Authentication
Tüm endpoint'ler (public olanlar hariç) `Authorization: Bearer <access_token>` header'ı gerektirir.

---

### 1. Get or Create Thread

**Endpoint**: `GET /messages/threads/:recipientUserId`

**Description**: Belirtilen kullanıcı ile thread'i getirir, yoksa oluşturur.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "thread": {
    "id": "uuid",
    "participant1Id": "uuid",
    "participant2Id": "uuid",
    "lastMessage": {
      "id": "uuid",
      "message": "Son mesaj metni",
      "sentAt": "2024-01-15T10:30:00Z"
    },
    "unreadCount": 0,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Status Codes**:
- `200 OK`: Thread bulundu veya oluşturuldu
- `401 Unauthorized`: Token geçersiz
- `404 Not Found`: Recipient user bulunamadı

---

### 2. Get Thread Messages (Pagination)

**Endpoint**: `GET /messages/threads/:threadId/messages`

**Description**: Thread mesajlarını pagination ile getirir.

**Query Parameters**:
- `limit` (optional, default: 50): Sayfa başına mesaj sayısı
- `cursor` (optional): Pagination cursor (timestamp veya message ID)
- `offset` (optional, default: 0): Atlanacak mesaj sayısı

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "messages": [
    {
      "id": "uuid",
      "threadId": "uuid",
      "senderId": "uuid",
      "message": "Mesaj metni",
      "messageType": "message",
      "mediaUrl": null,
      "mediaType": null,
      "thumbnailUrl": null,
      "replyToMessageId": null,
      "replyToMessage": {
        "id": "uuid",
        "message": "Yanıtlanan mesaj",
        "senderName": "Kullanıcı Adı"
      },
      "status": "read",
      "isDeleted": false,
      "isEdited": false,
      "editedAt": null,
      "sentAt": "2024-01-15T10:30:00Z",
      "deliveredAt": "2024-01-15T10:30:05Z",
      "readAt": "2024-01-15T10:31:00Z",
      "sender": {
        "id": "uuid",
        "senderName": "Kullanıcı Adı",
        "senderTitle": "Ünvan",
        "senderAvatar": "avatar_url"
      },
      "reactions": [
        {
          "emoji": "👍",
          "count": 3,
          "users": ["uuid1", "uuid2", "uuid3"]
        }
      ]
    }
  ],
  "hasMore": true,
  "nextCursor": "2024-01-15T10:00:00Z",
  "total": 150
}
```

**Status Codes**:
- `200 OK`: Başarılı
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Thread'e erişim yok
- `404 Not Found`: Thread bulunamadı

**Pagination Logic**:
```javascript
// Backend implementation example
const getThreadMessages = async (req, res) => {
  const { threadId } = req.params;
  const { limit = 50, cursor, offset = 0 } = req.query;
  const userId = req.user.id;
  
  // Thread'e erişim kontrolü
  const thread = await Thread.findOne({
    where: {
      id: threadId,
      [Op.or]: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    }
  });
  
  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }
  
  // Cursor-based pagination
  const whereClause = {
    threadId,
    isDeleted: false
  };
  
  if (cursor) {
    whereClause.sentAt = {
      [Op.lt]: new Date(cursor)
    };
  }
  
  const messages = await Message.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'name', 'title', 'avatar']
      },
      {
        model: MessageReaction,
        as: 'reactions',
        include: [{
          model: User,
          as: 'users',
          attributes: ['id']
        }]
      }
    ],
    order: [['sentAt', 'DESC']],
    limit: parseInt(limit) + 1, // +1 to check if there are more
    offset: parseInt(offset)
  });
  
  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? resultMessages[resultMessages.length - 1].sentAt : null;
  
  res.json({
    messages: resultMessages.reverse(), // En eski mesajlar başta
    hasMore,
    nextCursor,
    total: await Message.count({ where: { threadId, isDeleted: false } })
  });
};
```

---

### 3. Send Direct Message

**Endpoint**: `POST /messages/send`

**Description**: Direct message gönderir.

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "recipientUserId": "uuid",
  "message": "Mesaj metni",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "message": "Mesaj metni",
  "sentAt": "2024-01-15T10:30:00Z"
}
```

**Status Codes**:
- `201 Created`: Mesaj gönderildi
- `400 Bad Request`: Geçersiz request
- `401 Unauthorized`: Token geçersiz
- `404 Not Found`: Recipient user bulunamadı

---

### 4. Upload Media

**Endpoint**: `POST /messages/threads/:threadId/media`

**Description**: Thread'e medya (görsel, video, ses, dosya) yükler.

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Form Data**:
- `media` (file): Medya dosyası
- `mediaType` (string): 'image', 'video', 'audio', 'file'
- `caption` (string, optional): Caption/metin
- `fileName` (string, optional): Dosya adı
- `fileSize` (number, optional): Dosya boyutu (bytes)

**Response**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "mediaUrl": "https://cdn.tipbox.com/media/uuid.jpg",
  "thumbnailUrl": "https://cdn.tipbox.com/thumbnails/uuid.jpg",
  "mediaType": "image",
  "caption": "Caption metni",
  "sentAt": "2024-01-15T10:30:00Z"
}
```

**Status Codes**:
- `201 Created`: Medya yüklendi
- `400 Bad Request`: Geçersiz dosya veya format
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Thread'e erişim yok
- `413 Payload Too Large`: Dosya çok büyük

**File Upload Logic**:
```javascript
const uploadMedia = async (req, res) => {
  const { threadId } = req.params;
  const userId = req.user.id;
  const { mediaType = 'image', caption, fileName, fileSize } = req.body;
  const file = req.file;
  
  // Thread erişim kontrolü
  const thread = await Thread.findOne({
    where: {
      id: threadId,
      [Op.or]: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    }
  });
  
  if (!thread) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // File validation
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_FILE_SIZE) {
    return res.status(413).json({ error: 'File too large' });
  }
  
  // Upload to storage (AWS S3, Cloudinary, etc.)
  const uploadResult = await storageService.upload(file, {
    folder: `messages/${threadId}`,
    generateThumbnail: mediaType === 'image' || mediaType === 'video'
  });
  
  // Create message
  const message = await Message.create({
    threadId,
    senderId: userId,
    messageType: mediaType,
    message: caption || '',
    mediaUrl: uploadResult.url,
    mediaType,
    thumbnailUrl: uploadResult.thumbnailUrl,
    fileName: fileName || file.originalname,
    fileSize: fileSize || file.size,
    sentAt: new Date()
  });
  
  // Update thread
  await thread.update({
    lastMessageId: message.id,
    lastMessageAt: message.sentAt
  });
  
  // Emit socket event
  io.to(threadId).emit('new_message', {
    messageId: message.id,
    threadId,
    senderId: userId,
    message: caption || '',
    messageType: mediaType,
    mediaUrl: uploadResult.url,
    thumbnailUrl: uploadResult.thumbnailUrl,
    timestamp: message.sentAt
  });
  
  res.status(201).json({
    messageId: message.id,
    threadId,
    mediaUrl: uploadResult.url,
    thumbnailUrl: uploadResult.thumbnailUrl,
    mediaType,
    caption: caption || '',
    sentAt: message.sentAt
  });
};
```

---

### 5. Delete Message

**Endpoint**: `DELETE /messages/:messageId`

**Description**: Mesajı siler (soft delete).

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "messageId": "uuid",
  "deletedAt": "2024-01-15T10:35:00Z"
}
```

**Status Codes**:
- `200 OK`: Mesaj silindi
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Mesaj sahibi değilsiniz
- `404 Not Found`: Mesaj bulunamadı

**Implementation**:
```javascript
const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;
  
  const message = await Message.findOne({
    where: { id: messageId, senderId: userId }
  });
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  // Soft delete
  await message.update({
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId,
    message: 'Bu mesaj silindi'
  });
  
  // Emit socket event
  io.to(message.threadId).emit('message_deleted', {
    messageId,
    threadId: message.threadId,
    deletedAt: message.deletedAt
  });
  
  res.json({
    messageId,
    deletedAt: message.deletedAt
  });
};
```

---

### 6. Edit Message

**Endpoint**: `PATCH /messages/:messageId`

**Description**: Mesajı düzenler.

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "message": "Düzenlenmiş mesaj metni"
}
```

**Response**:
```json
{
  "messageId": "uuid",
  "message": "Düzenlenmiş mesaj metni",
  "editedAt": "2024-01-15T10:40:00Z"
}
```

**Status Codes**:
- `200 OK`: Mesaj düzenlendi
- `400 Bad Request`: Geçersiz request
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Mesaj sahibi değilsiniz
- `404 Not Found`: Mesaj bulunamadı

**Implementation**:
```javascript
const editMessage = async (req, res) => {
  const { messageId } = req.params;
  const { message: newMessage } = req.body;
  const userId = req.user.id;
  
  const message = await Message.findOne({
    where: { id: messageId, senderId: userId, isDeleted: false }
  });
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  // Edit time limit (örn: 15 dakika)
  const EDIT_TIME_LIMIT = 15 * 60 * 1000; // 15 dakika
  const timeSinceSent = Date.now() - new Date(message.sentAt).getTime();
  
  if (timeSinceSent > EDIT_TIME_LIMIT) {
    return res.status(400).json({ error: 'Message cannot be edited after 15 minutes' });
  }
  
  await message.update({
    message: newMessage,
    isEdited: true,
    editedAt: new Date()
  });
  
  // Emit socket event
  io.to(message.threadId).emit('message_edited', {
    messageId,
    threadId: message.threadId,
    message: newMessage,
    editedAt: message.editedAt
  });
  
  res.json({
    messageId,
    message: newMessage,
    editedAt: message.editedAt
  });
};
```

---

### 7. Search Messages

**Endpoint**: `GET /messages/threads/:threadId/search`

**Description**: Thread içinde mesaj arama yapar.

**Query Parameters**:
- `q` (required): Arama sorgusu
- `limit` (optional, default: 50): Maksimum sonuç sayısı
- `offset` (optional, default: 0): Atlanacak sonuç sayısı

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "messages": [
    {
      "id": "uuid",
      "message": "Arama sonucu mesaj",
      "sentAt": "2024-01-15T10:30:00Z",
      "sender": {
        "id": "uuid",
        "senderName": "Kullanıcı Adı"
      }
    }
  ],
  "total": 25,
  "hasMore": false
}
```

**Status Codes**:
- `200 OK`: Başarılı
- `400 Bad Request`: Query parametresi eksik
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Thread'e erişim yok

**Implementation** (PostgreSQL Full-Text Search):
```javascript
const searchMessages = async (req, res) => {
  const { threadId } = req.params;
  const { q, limit = 50, offset = 0 } = req.query;
  const userId = req.user.id;
  
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  
  // Thread erişim kontrolü
  const thread = await Thread.findOne({
    where: {
      id: threadId,
      [Op.or]: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    }
  });
  
  if (!thread) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Full-text search (PostgreSQL)
  const messages = await Message.findAll({
    where: {
      threadId,
      isDeleted: false,
      [Op.or]: [
        {
          message: {
            [Op.iLike]: `%${q}%`
          }
        },
        Sequelize.literal(`to_tsvector('turkish', message) @@ plainto_tsquery('turkish', :query)`)
      ]
    },
    include: [{
      model: User,
      as: 'sender',
      attributes: ['id', 'name']
    }],
    order: [['sentAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
    replacements: { query: q }
  });
  
  const total = await Message.count({
    where: {
      threadId,
      isDeleted: false,
      message: {
        [Op.iLike]: `%${q}%`
      }
    }
  });
  
  res.json({
    messages,
    total,
    hasMore: (parseInt(offset) + messages.length) < total
  });
};
```

---

### 8. Add Reaction

**Endpoint**: `POST /messages/:messageId/reactions`

**Description**: Mesaja emoji reaksiyon ekler.

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "emoji": "👍"
}
```

**Response**:
```json
{
  "reactionId": "uuid",
  "messageId": "uuid",
  "userId": "uuid",
  "emoji": "👍",
  "createdAt": "2024-01-15T10:45:00Z"
}
```

**Status Codes**:
- `201 Created`: Reaksiyon eklendi
- `400 Bad Request`: Geçersiz emoji
- `401 Unauthorized`: Token geçersiz
- `404 Not Found`: Mesaj bulunamadı

**Implementation**:
```javascript
const addReaction = async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user.id;
  
  // Emoji validation
  if (!emoji || emoji.trim().length === 0) {
    return res.status(400).json({ error: 'Emoji is required' });
  }
  
  const message = await Message.findOne({
    where: { id: messageId, isDeleted: false }
  });
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  // Check if user already reacted with this emoji
  const existingReaction = await MessageReaction.findOne({
    where: { messageId, userId, emoji }
  });
  
  if (existingReaction) {
    return res.status(400).json({ error: 'Already reacted with this emoji' });
  }
  
  // Create reaction
  const reaction = await MessageReaction.create({
    messageId,
    userId,
    emoji
  });
  
  // Emit socket event
  io.to(message.threadId).emit('message_reaction', {
    messageId,
    threadId: message.threadId,
    emoji,
    action: 'add',
    userId,
    reactionId: reaction.id
  });
  
  res.status(201).json({
    reactionId: reaction.id,
    messageId,
    userId,
    emoji,
    createdAt: reaction.createdAt
  });
};
```

---

### 9. Remove Reaction

**Endpoint**: `DELETE /messages/:messageId/reactions/:reactionId`

**Description**: Mesajdan emoji reaksiyon kaldırır.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "messageId": "uuid",
  "reactionId": "uuid",
  "deletedAt": "2024-01-15T10:46:00Z"
}
```

**Status Codes**:
- `200 OK`: Reaksiyon kaldırıldı
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Reaksiyon sahibi değilsiniz
- `404 Not Found`: Reaksiyon bulunamadı

---

### 10. Get Message Reactions

**Endpoint**: `GET /messages/:messageId/reactions`

**Description**: Mesajın tüm reaksiyonlarını getirir.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "messageId": "uuid",
  "reactions": [
    {
      "emoji": "👍",
      "count": 3,
      "users": ["uuid1", "uuid2", "uuid3"]
    },
    {
      "emoji": "❤️",
      "count": 1,
      "users": ["uuid4"]
    }
  ]
}
```

**Status Codes**:
- `200 OK`: Başarılı
- `401 Unauthorized`: Token geçersiz
- `404 Not Found`: Mesaj bulunamadı

**Implementation**:
```javascript
const getMessageReactions = async (req, res) => {
  const { messageId } = req.params;
  
  const message = await Message.findOne({
    where: { id: messageId, isDeleted: false }
  });
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  // Group reactions by emoji
  const reactions = await MessageReaction.findAll({
    where: { messageId },
    attributes: [
      'emoji',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      [Sequelize.fn('ARRAY_AGG', Sequelize.col('user_id')), 'users']
    ],
    group: ['emoji']
  });
  
  res.json({
    messageId,
    reactions: reactions.map(r => ({
      emoji: r.emoji,
      count: parseInt(r.count),
      users: r.users
    }))
  });
};
```

---

## 🔌 Socket.IO Events

### Connection & Authentication

Socket.IO bağlantısı JWT token ile authenticate edilir:

```javascript
// Client-side connection
const socket = io('https://api.tipbox.com', {
  auth: {
    token: accessToken
  }
});

// Server-side authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.userId = user.id;
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});
```

---

### Client → Server Events

#### 1. Join Thread

**Event**: `join_thread`

**Payload**:
```json
{
  "threadId": "uuid"
}
```

**Server Logic**:
```javascript
socket.on('join_thread', async (data) => {
  const { threadId } = data;
  const userId = socket.userId;
  
  // Thread erişim kontrolü
  const thread = await Thread.findOne({
    where: {
      id: threadId,
      [Op.or]: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    }
  });
  
  if (!thread) {
    socket.emit('thread_join_error', {
      threadId,
      error: 'Access denied'
    });
    return;
  }
  
  // Socket room'a join et
  socket.join(threadId);
  
  // Typing state'i temizle
  socket.typingThreadId = null;
  
  socket.emit('thread_joined', {
    threadId,
    userId
  });
});
```

---

#### 2. Leave Thread

**Event**: `leave_thread`

**Payload**:
```json
{
  "threadId": "uuid"
}
```

**Server Logic**:
```javascript
socket.on('leave_thread', (data) => {
  const { threadId } = data;
  socket.leave(threadId);
  socket.typingThreadId = null;
  
  socket.emit('thread_left', {
    threadId,
    userId: socket.userId
  });
});
```

---

#### 3. Send Message

**Event**: `send_message`

**Payload**:
```json
{
  "recipientId": "uuid",
  "message": "Mesaj metni",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Server Logic**:
```javascript
socket.on('send_message', async (data) => {
  const { recipientId, message, timestamp } = data;
  const senderId = socket.userId;
  
  try {
    // Get or create thread
    let thread = await Thread.findOne({
      where: {
        [Op.or]: [
          { participant1Id: senderId, participant2Id: recipientId },
          { participant1Id: recipientId, participant2Id: senderId }
        ]
      }
    });
    
    if (!thread) {
      thread = await Thread.create({
        participant1Id: senderId,
        participant2Id: recipientId
      });
    }
    
    // Create message
    const messageRecord = await Message.create({
      threadId: thread.id,
      senderId,
      messageType: 'message',
      message,
      sentAt: new Date(timestamp || Date.now()),
      status: 'sent'
    });
    
    // Update thread
    await thread.update({
      lastMessageId: messageRecord.id,
      lastMessageAt: messageRecord.sentAt,
      unreadCountParticipant1: thread.participant1Id === senderId ? thread.unreadCountParticipant1 : thread.unreadCountParticipant1 + 1,
      unreadCountParticipant2: thread.participant2Id === senderId ? thread.unreadCountParticipant2 : thread.unreadCountParticipant2 + 1
    });
    
    // Emit to thread room
    io.to(thread.id).emit('new_message', {
      messageId: messageRecord.id,
      threadId: thread.id,
      senderId,
      message,
      messageType: 'message',
      timestamp: messageRecord.sentAt
    });
    
    // Confirm to sender
    socket.emit('message_sent', {
      messageId: messageRecord.id,
      threadId: thread.id,
      message,
      timestamp: messageRecord.sentAt
    });
    
  } catch (error) {
    socket.emit('message_send_error', {
      error: error.message
    });
  }
});
```

---

#### 4. Start Typing

**Event**: `start_typing`

**Payload**:
```json
{
  "threadId": "uuid"
}
```

**Server Logic**:
```javascript
socket.on('start_typing', (data) => {
  const { threadId } = data;
  socket.typingThreadId = threadId;
  
  // Diğer kullanıcılara bildir (sender hariç)
  socket.to(threadId).emit('user_typing', {
    threadId,
    userId: socket.userId,
    userName: socket.user.name
  });
});
```

---

#### 5. Stop Typing

**Event**: `stop_typing`

**Payload**:
```json
{
  "threadId": "uuid"
}
```

**Server Logic**:
```javascript
socket.on('stop_typing', (data) => {
  const { threadId } = data;
  socket.typingThreadId = null;
  
  socket.to(threadId).emit('user_stopped_typing', {
    threadId,
    userId: socket.userId
  });
});
```

---

#### 6. Mark Message as Read

**Event**: `mark_message_read`

**Payload**:
```json
{
  "messageId": "uuid"
}
```

**Server Logic**:
```javascript
socket.on('mark_message_read', async (data) => {
  const { messageId } = data;
  const userId = socket.userId;
  
  const message = await Message.findOne({
    where: { id: messageId }
  });
  
  if (!message || message.senderId === userId) {
    return; // Kendi mesajını okuma olarak işaretleme
  }
  
  // Read receipt oluştur
  await MessageReadReceipt.findOrCreate({
    where: { messageId, userId },
    defaults: {
      messageId,
      userId,
      readAt: new Date()
    }
  });
  
  // Message status güncelle
  if (message.status !== 'read') {
    await message.update({
      status: 'read',
      readAt: new Date()
    });
  }
  
  // Sender'a bildir
  io.to(message.threadId).emit('message_read', {
    messageId,
    threadId: message.threadId,
    userId,
    readAt: new Date()
  });
});
```

---

### Server → Client Events

#### 1. New Message

**Event**: `new_message`

**Payload**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "senderId": "uuid",
  "message": "Mesaj metni",
  "messageType": "message",
  "mediaUrl": null,
  "thumbnailUrl": null,
  "replyToMessageId": null,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### 2. Message Sent (Confirmation)

**Event**: `message_sent`

**Payload**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "message": "Mesaj metni",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### 3. Message Deleted

**Event**: `message_deleted`

**Payload**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "deletedAt": "2024-01-15T10:35:00Z"
}
```

---

#### 4. Message Edited

**Event**: `message_edited`

**Payload**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "message": "Düzenlenmiş mesaj",
  "editedAt": "2024-01-15T10:40:00Z"
}
```

---

#### 5. Message Reaction

**Event**: `message_reaction`

**Payload**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "emoji": "👍",
  "action": "add", // or "remove"
  "userId": "uuid",
  "reactionId": "uuid"
}
```

---

#### 6. Message Delivered

**Event**: `message_delivered`

**Payload**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "deliveredAt": "2024-01-15T10:30:05Z"
}
```

---

#### 7. Message Read

**Event**: `message_read`

**Payload**:
```json
{
  "messageId": "uuid",
  "threadId": "uuid",
  "userId": "uuid",
  "readAt": "2024-01-15T10:31:00Z"
}
```

---

#### 8. User Typing

**Event**: `user_typing`

**Payload**:
```json
{
  "threadId": "uuid",
  "userId": "uuid",
  "userName": "Kullanıcı Adı"
}
```

---

#### 9. User Stopped Typing

**Event**: `user_stopped_typing`

**Payload**:
```json
{
  "threadId": "uuid",
  "userId": "uuid"
}
```

---

## 🔐 Authentication & Authorization

### JWT Token Structure

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "iat": 1705315200,
  "exp": 1705318800
}
```

### Authorization Middleware

```javascript
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

### Thread Access Control

```javascript
const checkThreadAccess = async (req, res, next) => {
  const { threadId } = req.params;
  const userId = req.user.id;
  
  const thread = await Thread.findOne({
    where: {
      id: threadId,
      [Op.or]: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    }
  });
  
  if (!thread) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  req.thread = thread;
  next();
};
```

---

## ⚠️ Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Error Codes

- `AUTH_REQUIRED`: Authentication required
- `AUTH_INVALID`: Invalid token
- `ACCESS_DENIED`: Access denied
- `THREAD_NOT_FOUND`: Thread not found
- `MESSAGE_NOT_FOUND`: Message not found
- `INVALID_INPUT`: Invalid input data
- `FILE_TOO_LARGE`: File size exceeds limit
- `UNSUPPORTED_FILE_TYPE`: Unsupported file type
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded

### Error Handler Middleware

```javascript
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      code: 'INVALID_INPUT',
      details: err.errors
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTH_INVALID'
    });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
};
```

---

## ⚡ Real-time Logic

### Message Delivery Status Flow

1. **Sending**: Mesaj gönderildiğinde `status: 'sending'`
2. **Sent**: Backend'e ulaştığında `status: 'sent'`, `sentAt` set edilir
3. **Delivered**: Recipient online ve mesajı aldığında `status: 'delivered'`, `deliveredAt` set edilir
4. **Read**: Recipient mesajı okuduğunda `status: 'read'`, `readAt` set edilir

```javascript
// Delivery tracking
const trackDelivery = async (messageId, threadId) => {
  const message = await Message.findById(messageId);
  
  // Check if recipient is online
  const recipientId = message.thread.participant1Id === message.senderId 
    ? message.thread.participant2Id 
    : message.thread.participant1Id;
  
  const recipientSocket = await getSocketByUserId(recipientId);
  
  if (recipientSocket) {
    // Recipient is online, mark as delivered
    await message.update({
      status: 'delivered',
      deliveredAt: new Date()
    });
    
    io.to(threadId).emit('message_delivered', {
      messageId,
      threadId,
      deliveredAt: message.deliveredAt
    });
  }
};
```

### Typing Indicator Logic

```javascript
// Typing timeout (3 saniye)
const typingTimeouts = new Map();

socket.on('start_typing', (data) => {
  const { threadId } = data;
  const key = `${socket.userId}-${threadId}`;
  
  // Clear existing timeout
  if (typingTimeouts.has(key)) {
    clearTimeout(typingTimeouts.get(key));
  }
  
  // Emit typing event
  socket.to(threadId).emit('user_typing', {
    threadId,
    userId: socket.userId,
    userName: socket.user.name
  });
  
  // Auto-stop after 3 seconds
  const timeout = setTimeout(() => {
    socket.to(threadId).emit('user_stopped_typing', {
      threadId,
      userId: socket.userId
    });
    typingTimeouts.delete(key);
  }, 3000);
  
  typingTimeouts.set(key, timeout);
});
```

---

## 🚀 Performance Optimizations

### 1. Database Indexing

Tüm sorgu pattern'leri için index'ler oluşturulmalı:
- Thread lookup (participant1Id, participant2Id)
- Message lookup (threadId, sentAt)
- Search queries (full-text search index)

### 2. Caching Strategy

```javascript
// Redis caching for frequently accessed data
const getThread = async (threadId) => {
  const cacheKey = `thread:${threadId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const thread = await Thread.findById(threadId);
  await redis.setex(cacheKey, 300, JSON.stringify(thread)); // 5 dakika cache
  
  return thread;
};
```

### 3. Pagination Optimization

- Cursor-based pagination kullan (offset-based yerine)
- Limit maximum 100 mesaj
- Database query'leri optimize et (N+1 problem'i önle)

### 4. Socket.IO Optimization

- Room-based broadcasting (tüm client'lara değil, sadece thread room'una)
- Event throttling (typing events için)
- Connection pooling

---

## 🔒 Security Considerations

### 1. Input Validation

```javascript
const { body, validationResult } = require('express-validator');

const validateMessage = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
  body('recipientUserId')
    .isUUID()
    .withMessage('Invalid recipient user ID')
];
```

### 2. File Upload Security

- File type validation (whitelist)
- File size limits (50MB max)
- Virus scanning
- Secure file storage (S3 with signed URLs)

### 3. Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const messageRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 30, // 30 mesaj
  message: 'Too many messages, please try again later'
});
```

### 4. SQL Injection Prevention

- Parameterized queries kullan (Sequelize ORM)
- Input sanitization
- Prepared statements

### 5. XSS Prevention

- User input'ları sanitize et
- HTML escape
- Content Security Policy (CSP)

---

## 📝 Best Practices

1. **Transaction Management**: Database işlemlerini transaction içinde yap
2. **Error Logging**: Tüm hataları logla (Sentry, Winston, etc.)
3. **Monitoring**: Performance ve error monitoring (New Relic, Datadog)
4. **Documentation**: API dokümantasyonu (Swagger/OpenAPI)
5. **Testing**: Unit tests, integration tests, load tests
6. **Code Review**: Pull request review process
7. **Versioning**: API versioning (v1, v2, etc.)

---

## 🎯 Sonuç

Bu dokümantasyon, gerçek zamanlı mesajlaşma uygulaması için backend implementasyonunun tüm detaylarını içerir. Express.js ve Socket.IO kullanılarak production-ready bir sistem kurulabilir.

**Önemli Notlar**:
- Tüm endpoint'ler authentication gerektirir
- Socket.IO bağlantıları JWT ile authenticate edilir
- Database transaction'ları kullanılmalı
- Error handling ve logging kritik öneme sahiptir
- Performance optimization sürekli yapılmalıdır
