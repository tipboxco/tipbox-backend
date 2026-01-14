# Messages/Tips Transaction Integration

## 📊 Genel Bakış

`POST /messages/tips` endpoint'i artık **TransactionService** ile entegre edildi.

### ✅ Yapılan İyileştirmeler

Önceden:
- ❌ Sadece `TipsTokenTransfer` tablosuna kayıt
- ❌ Transaction tablosuna kayıt yok
- ❌ Notification gönderilmiyor
- ✅ Wallet balance güncelleniyor (manuel)

Şimdi:
- ✅ **Transaction** tablosuna kayıt (TIP_SEND & TIP_RECEIVE)
- ✅ **Wallet balance** güncelleniyor (otomatik)
- ✅ **Notification** gönderiliyor (sender & recipient)
- ✅ `TransactionService.sendTip` kullanılıyor (merkezi yönetim)

---

## 🔄 Entegrasyon

### Önceki Kod (Manuel)

```typescript
// ❌ Eski yöntem - Manuel işlemler
async sendTips(senderId, recipientId, amount, message) {
  // 1. Wallet kontrol
  const senderWallet = await getWallet(senderId);
  if (!senderWallet.hasBalance(amount)) {
    throw new Error('Insufficient balance');
  }

  // 2. TipsTokenTransfer kayıt
  const transfer = await prisma.tipsTokenTransfer.create({
    data: { fromUserId: senderId, toUserId: recipientId, amount }
  });

  // 3. Balance güncelle (manuel)
  await updateBalance(senderWallet.id, -amount);
  await updateBalance(recipientWallet.id, amount);

  // ❌ Transaction tablosuna kayıt yok
  // ❌ Notification yok
}
```

### Yeni Kod (TransactionService)

```typescript
// ✅ Yeni yöntem - TransactionService kullanımı
async sendTips(senderId, recipientId, amount, message) {
  // TransactionService.sendTip tüm işlemleri halleder:
  // - Wallet balance check
  // - Transaction create (SEND & RECEIVE)
  // - Balance update
  // - Notifications
  const { transaction } = await this.transactionService.sendTip({
    fromUserId: senderId,
    toUserId: recipientId,
    amount,
    reason: message || 'TIPS via messaging',
  });

  // Transaction ID ile devam et
  logger.info({ transactionId: transaction.id });
}
```

---

## 🎯 TransactionService.sendTip

### Ne Yapar?

1. **Validation**
   - Amount > 0
   - fromUserId ≠ toUserId
   - Wallet exists

2. **Balance Check**
   - Sender wallet balance kontrolü
   - Available balance = balance - lockedBalance

3. **Transaction Creation**
   - **TIP_SEND** transaction (sender wallet)
   - **TIP_RECEIVE** transaction (recipient wallet)

4. **Balance Update**
   - Sender: balance -= amount
   - Recipient: balance += amount
   - Atomik işlem (transaction içinde)

5. **Notifications**
   - **TIPS_SENT**: Gönderici için
   - **TIPS_RECEIVED**: Alıcı için

---

## 💾 Database Changes

### Transaction Tablosu

**Her TIPS işlemi için 2 transaction kaydı:**

#### Sender Transaction (TIP_SEND)
```sql
INSERT INTO transactions (
  wallet_id,
  action_type,
  status,
  amount,
  from_address,
  to_address,
  metadata,
  provider
) VALUES (
  'sender-wallet-id',
  'TIP_SEND',
  'confirmed',
  50,
  'sender-public-address',
  'recipient-public-address',
  '{"reason": "Great advice!", "recipientUserId": "user-123"}',
  'backend'
);
```

#### Recipient Transaction (TIP_RECEIVE)
```sql
INSERT INTO transactions (
  wallet_id,
  action_type,
  status,
  amount,
  from_address,
  to_address,
  metadata,
  provider
) VALUES (
  'recipient-wallet-id',
  'TIP_RECEIVE',
  'confirmed',
  50,
  'sender-public-address',
  'recipient-public-address',
  '{"reason": "Great advice!", "senderUserId": "user-456"}',
  'backend'
);
```

### Wallet Balances

```sql
-- Sender wallet
UPDATE wallets
SET balance = balance - 50
WHERE id = 'sender-wallet-id';

-- Recipient wallet
UPDATE wallets
SET balance = balance + 50
WHERE id = 'recipient-wallet-id';
```

---

## 📬 Notifications

### Sender Notification (TIPS_SENT)

```javascript
{
  type: 'TIPS_SENT',
  userId: 'sender-user-id',
  data: {
    recipientName: 'John Doe',
    amount: 50,
    reason: 'Great advice!',
    transactionId: 'tx-123'
  }
}
```

**Message**: "You sent 50 TIPS to John Doe"

### Recipient Notification (TIPS_RECEIVED)

```javascript
{
  type: 'TIPS_RECEIVED',
  userId: 'recipient-user-id',
  data: {
    senderName: 'Jane Smith',
    amount: 50,
    reason: 'Great advice!',
    transactionId: 'tx-124'
  }
}
```

**Message**: "You received 50 TIPS from Jane Smith"

---

## 🔍 Flow Diagram

```
User A → POST /messages/tips
  ↓
messagingService.sendTips()
  ↓
transactionService.sendTip()
  ├─ Validate amount & users
  ├─ Get wallets
  ├─ Check balance
  ├─ Create TIP_SEND transaction
  ├─ Create TIP_RECEIVE transaction
  ├─ Update sender balance (-amount)
  ├─ Update recipient balance (+amount)
  ├─ Send TIPS_SENT notification
  └─ Send TIPS_RECEIVED notification
  ↓
Create DM message
  ↓
Update thread timestamp
  ↓
Emit socket event (new_message)
  ↓
Response: 201 Created
```

---

## 📱 Frontend Impact

### Transaction History

Artık `/wallet/transactions` endpoint'i messaging tips'leri gösterecek:

```json
{
  "transactions": [
    {
      "id": "tx-123",
      "actionType": "TIP_SEND",
      "amount": 50,
      "status": "confirmed",
      "metadata": {
        "reason": "Great advice!",
        "recipientUserId": "user-123"
      },
      "createdAt": "2026-01-14T10:30:00Z"
    }
  ]
}
```

### Notifications

Kullanıcılar artık TIPS gönderimi için bildirim alacak:

```javascript
// Notification listesinde
{
  type: 'TIPS_SENT',
  title: 'TIPS Sent',
  message: 'You sent 50 TIPS to John Doe',
  timestamp: '2026-01-14T10:30:00Z'
}
```

---

## 🧪 Test Scenarios

### Test 1: Successful Tips

```bash
# Request
POST /messages/tips
{
  "senderUserId": "user-a",
  "recipientUserId": "user-b",
  "amount": 50,
  "message": "Thanks!",
  "timestamp": "2026-01-14T10:30:00Z"
}

# Expected Results:
# 1. Database
SELECT * FROM transactions WHERE metadata->>'recipientUserId' = 'user-b';
# → 2 transactions (SEND & RECEIVE)

SELECT * FROM wallets WHERE user_id IN ('user-a', 'user-b');
# → Balances updated

# 2. Notifications
SELECT * FROM notifications WHERE user_id = 'user-a' AND type = 'TIPS_SENT';
# → 1 notification

SELECT * FROM notifications WHERE user_id = 'user-b' AND type = 'TIPS_RECEIVED';
# → 1 notification

# 3. Messaging
SELECT * FROM dm_messages WHERE thread_id = (thread between A & B);
# → 1 message "Sent 50 TIPS: Thanks!"
```

### Test 2: Insufficient Balance

```bash
# Request
POST /messages/tips
{
  "senderUserId": "user-a",
  "recipientUserId": "user-b",
  "amount": 10000,  # More than balance
  "message": "Thanks!",
  "timestamp": "2026-01-14T10:30:00Z"
}

# Expected Response:
HTTP 400 Bad Request
{
  "message": "Insufficient balance. Available: 100 TIPS"
}

# Expected Results:
# - No transactions created
# - No balance changes
# - No notifications sent
# - No DM message created
```

### Test 3: Wallet Not Found

```bash
# Request (user without wallet)
POST /messages/tips
{
  "senderUserId": "user-no-wallet",
  "recipientUserId": "user-b",
  "amount": 50,
  "message": "Thanks!",
  "timestamp": "2026-01-14T10:30:00Z"
}

# Expected Response:
HTTP 404 Not Found
{
  "message": "Sender wallet not found"
}
```

---

## 📝 Code Changes

### messaging.service.ts

```typescript
// Import TransactionService
import { TransactionService } from '../transaction/transaction.service';

export class MessagingService {
  private transactionService = new TransactionService();

  async sendTips(senderId, recipientId, amount, message) {
    // Use TransactionService instead of manual operations
    const { transaction } = await this.transactionService.sendTip({
      fromUserId: senderId,
      toUserId: recipientId,
      amount,
      reason: message || 'TIPS via messaging',
    });

    // Continue with messaging logic
    // ...
  }
}
```

**Removed**:
- ❌ Manual wallet balance checks
- ❌ Manual `TipsTokenTransfer` creation
- ❌ Manual `updateBalance` calls
- ❌ Manual notification logic (none existed)

**Added**:
- ✅ `TransactionService` integration
- ✅ Automatic transaction creation
- ✅ Automatic balance updates
- ✅ Automatic notifications

---

## ✅ Benefits

1. **Consistency**: TIPS gönderme her yerde aynı şekilde çalışıyor
2. **Transaction History**: Messaging tips artık transaction history'de
3. **Notifications**: Kullanıcılar bildirim alıyor
4. **Maintainability**: Tek bir merkezi service (TransactionService)
5. **Web3 Ready**: TransactionService Web3'e geçişte güncellenecek

---

## 🔗 Related Endpoints

### Affected Endpoints

1. ✅ **POST /messages/tips** - Tips gönderme (güncellendi)
2. ✅ **GET /wallet/transactions** - Transaction history (şimdi tips dahil)
3. ✅ **GET /notifications** - Notifications (şimdi tips notifications dahil)

### Related Documentation

- `TransactionService` - Core tip logic
- `WalletService` - Balance management
- `NotificationFactory` - Notification templates

---

## 🎉 Summary

Messages/tips endpoint artık:
- ✅ Transaction tablosuna kayıt yapıyor
- ✅ Wallet balance güncelliyor (merkezi service ile)
- ✅ Notification gönderiyor (sender & recipient)
- ✅ TransactionService kullanıyor (consistency)
- ✅ Web3'e hazır mimari

**Kullanıcı deneyimi**:
- ✅ TIPS geçmişi transaction history'de
- ✅ TIPS bildirimleri notification'larda
- ✅ Tutarlı bakiye yönetimi

---

**Hazırlayan**: Backend Team  
**Tarih**: 14 Ocak 2026  
**Durum**: ✅ Production Ready
