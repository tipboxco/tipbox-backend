# Transaction System Audit Report

**Tarih:** 2026-03-18
**Son Guncelleme:** 2026-03-18 (Notification Veri Formati Iyilestirme - Phase 3)
**Kapsam:** TIP_SEND, WITHDRAW, DEPOSIT, Webhook lifecycle, Notification, Balance management, Komisyon/Fee yonetimi, Locked Balance, Entity Consistency, Notification Data Format & Enrichment

---

## FIX ILERLEME DURUMU

> **14/14 bug fixlendi** + 1 ek bug (Duplicate DEPOSIT/WITHDRAW) fixlendi.
> **10 yeni bug tespit edildi ve FIXLENDI** (Komisyon/Fee yonetimi + Notification mantik/hedefleme hatalari) — BUG-15 ~ BUG-24
> **5 CRITICAL bug tespit edildi ve FIXLENDI** (Kapsamli Sistem Analizi - Phase 2) — BUG-25 ~ BUG-29
> **5 notification veri formati bugi tespit edildi ve FIXLENDI** (Notification Data Format - Phase 3) — BUG-30 ~ BUG-34
> **1 pre-existing bug fixlendi** (Pagination testi: eksik test data)
> **82/82 E2E test PASSED** (2026-03-18)

| # | Bug | Durum | Fix Detayi |
|---|-----|-------|------------|
| 1 | Race condition: double spend | **FIXLENDI** | `walletRepo.lockBalance()` atomic method eklendi; `sendTip()` hemen lockedBalance artiriyor |
| 2 | Atomic olmayan SEND/RECEIVE cift | **FIXLENDI** | `prisma.$transaction()` ile SEND+RECEIVE tek atomic islemde olusturuluyor |
| 3 | Wallet balance pessimistic lock yok | **FIXLENDI** | `walletRepo.incrementBalance()` atomic increment; `updateBalance()` artik read-then-write yerine `{ increment: amount }` kullaniyor |
| 4 | Webhook errored status skip ediliyor | **FIXLENDI** | `errored` priority 1 → 3 olarak guncellendi (artik `sent`'ten yuksek) |
| 5 | Sync pending transaction'lari eziyor | **FIXLENDI** | `syncWalletBalanceFromChain()` pending/created transaction varken sync'i skip ediyor |
| 6 | Transaction GET authorization yok | **FIXLENDI** | `GET /:id` endpoint'ine wallet ownership kontrolu eklendi (403 Forbidden) |
| 7 | BOOST_POST notification eksik | **FIXLENDI** | `BOOST_POST` case eklendi, `TRANSACTION_CONFIRMED` notification gonderiyor |
| 8 | TIPS_RECEIVED sender gosterilmiyor | **FIXLENDI** | Template artik `senderUsername` parametresini kullaniyor: "You received X TIPS from username" |
| 9 | Force CONFIRMED balance olmadan | **FIXLENDI** | Force-confirm yerine retry mekanizmasi eklendi; once `confirmTransaction()` tekrar deneniyor |
| 10 | N+1 query transaction history | **FIXLENDI** | User ID'leri toplanip tek `findMany` sorgusunda getiriliyor, `Map` ile eslestiriliyor |
| 11 | CANCELLED = FAILED karisiyor | **FIXLENDI** | Cancel isleminde metadata'ya `cancelledByUser: true` flag'i ekleniyor |
| 12 | Hardcoded Turkce default isim | **FIXLENDI** | `'Kullanici'` → `'User'` olarak degistirildi (tum dosyalarda) |
| 13 | Metadata field tutarsizligi | **FIXLENDI** | Yeni islem `pairedTransactionId` kullaniyor; webhook service backward-compatible fallback: `pairedTransactionId \|\| receiveTransactionId \|\| linkedTransactionId` |
| 14 | Unhandled NFT transfer promise'ler | **FIXLENDI** | `Promise.all([...]).catch()` → `await Promise.all([...]).catch()` |
| EK | Duplicate DEPOSIT/WITHDRAW (internal TIP_SEND) | **FIXLENDI** | 3 webhook source'ta cross-source txHash guard eklendi (thirdweb, contract-event, alchemy) |
| 15 | TIP_RECEIVE amount = gross, net olmali | **FIXLENDI** | `sendTip()` icinde `getFeePercentage()` ile net tutar hesaplaniyor; RECEIVE `netAmount` ile olusturuluyor |
| 16 | confirmTransaction RECEIVE amount guncellemiyor | **FIXLENDI** | BUG-15 ile otomatik cozuldu; BUG-21 atomic guard da eklendi |
| 17 | Contract event RECEIVE amount duzeltmiyor | **FIXLENDI** | INTERNAL TRANSFER blogunda TIP_RECEIVE amount on-chain tutar ile guncelleniyor |
| 18 | TIP_RECEIVE notification yanlis tutar gosteriyor | **FIXLENDI** | BUG-15 ile otomatik — RECEIVE amount dogru olunca notification da dogru |
| 19 | Fail notification TIP_RECEIVE filtrelemiyor | **FIXLENDI** | `sendTransactionFailedNotification()` icine TIP_RECEIVE filtresi eklendi |
| 20 | FEE icin gereksiz TRANSACTION_CONFIRMED notification | **FIXLENDI** | FEE, DEPOSIT/WITHDRAW ile birlikte silent gruba tasindi |
| 21 | Worker + contract event race → cift notification riski | **FIXLENDI** | `confirmTransaction()` icinde Prisma `updateMany` ile atomic guard eklendi |
| 22 | TIPS_SENT notification avatar resolve edilemiyor | **FIXLENDI** | Enricher'a `recipientUserId` desteği eklendi |
| 23 | TIPS_SENT notification data'sinda `senderUserId` eksik | **FIXLENDI** | TIP_SEND notification data'sina `senderUserId` eklendi |
| 24 | FEE transaction metadata'sinda user ID yok | **FIXLENDI** | FEE metadata'sina `senderUserId` ve `pairedTransactionId` eklendi |
| 25 | **CRITICAL: Locked balance hic unlock edilmiyor** | **FIXLENDI** | `confirmTransaction()`, `failTransaction()`, `cancelTipSend()` icine `unlockBalance()` eklendi |
| 26 | **CRITICAL: failTransaction() status guard yok** | **FIXLENDI** | CONFIRMED tx fail edilemez — status guard eklendi, sessizce mevcut tx donuyor |
| 27 | **CRITICAL: 100% fee netAmount=0 yapiyor** | **FIXLENDI** | `feePercentage < 100` cap + `netAmount <= 0` ise minimum 1 token guarantee |
| 28 | Entity isSend() BOOST_POST eksik | **FIXLENDI** | `transaction.entity.ts` isSend() listesine BOOST_POST eklendi |
| 29 | Worker failSendOrBoth unlock bypass | **FIXLENDI** | `transactionService.failTransaction()` kullanilarak unlock otomatik tetikleniyor |
| 30 | TIPS_SENT notification gonderenin kendi avatarini gosteriyor | **FIXLENDI** | `senderUserId` TIPS_SENT data'sindan cikarildi; enricher artik `recipientUserId`'yi resolve eder |
| 31 | TIPS_SENT router enrichment gonderenin avatarini override ediyor | **FIXLENDI** | Router'da TIPS_SENT branch'i `recipientUserId` ile avatar yukluyor (senderUserId yerine) |
| 32 | System notification'larda kullanici avatari gosteriliyor | **FIXLENDI** | BOOST_POST, CLAIM_REWARD, SWAP_*, AIRDROP, CLAIM_BADGE, TRANSACTION_FAILED icin `isSystem: true` flag eklendi |
| 33 | TIPS_SENT enrichment'ta amount ve transactionId eksik | **FIXLENDI** | Router enrichment'a `amount` ve `transactionId` alanlari eklendi |
| 34 | TRANSACTION_FAILED enrichment'ta errorMessage eksik | **FIXLENDI** | Router enrichment'a `errorMessage` alani eklendi |

### Degistirilen Dosyalar

| Dosya | Fixler |
|-------|--------|
| `backend/src/infrastructure/repositories/wallet-prisma.repository.ts` | BUG-1,3: `incrementBalance()`, `lockBalance()`, `unlockBalance()` atomic methodlar |
| `backend/src/application/wallet/wallet.service.ts` | BUG-3: atomic increment; BUG-5: pending tx guard |
| `backend/src/application/transaction/transaction.service.ts` | BUG-1: lockBalance; BUG-2: $transaction; BUG-11: cancelledByUser; BUG-12,13,14; BUG-25: unlockBalance on confirm/fail/cancel; BUG-26: failTransaction status guard; BUG-27: fee cap |
| `backend/src/interfaces/thirdweb-webhook/thirdweb-webhook.dto.ts` | BUG-4: errored priority fix |
| `backend/src/application/thirdweb-webhook/thirdweb-webhook.service.ts` | BUG-13: pairedTransactionId; EK: cross-source txHash guard |
| `backend/src/application/thirdweb-webhook/contract-event.service.ts` | EK: cross-source txHash guard (normalized + legacy) |
| `backend/src/application/alchemy-webhook/alchemy-webhook.service.ts` | EK: cross-source txHash guard |
| `backend/src/interfaces/transaction/transaction.router.ts` | BUG-6: authorization; BUG-10: batch user lookup |
| `backend/src/application/transaction/transaction-notification.service.ts` | BUG-7: BOOST_POST; BUG-12: 'User'; BUG-30: senderUserId cikarildi; BUG-32: isSystem flag eklendi |
| `backend/src/application/notification/notification-factory.ts` | BUG-8: senderUsername template; BUG-30: TIPS_SENT recipientName null fallback |
| `backend/src/interfaces/notification/notification.router.ts` | BUG-31: TIPS_SENT recipient avatar; BUG-32: isSystem enrichment; BUG-33: amount/transactionId; BUG-34: errorMessage |
| `backend/src/infrastructure/workers/tip-send.worker.ts` | BUG-9: retry mekanizmasi; BUG-29: failSendOrBoth → transactionService.failTransaction |
| `backend/src/application/notification/notification-enricher.ts` | BUG-22: recipientUserId avatar desteği |
| `backend/src/domain/transaction/transaction.entity.ts` | BUG-28: isSend() BOOST_POST eklendi |
| `backend/tests/e2e/transaction-lifecycle.test.ts` | 35 yeni test + pagination fix: Fee, Atomic Guard, Notification, Failed Filter, Resilience, Cancel Metadata, Locked Balance, Status Guard, Fee Edge Cases, Entity Consistency, Notification Data Format (N1-N5) |
| `backend/tests/e2e/helpers.ts` | Prisma schema uyumu: isVerified/isActive → emailVerified |

### E2E Test Sonuclari (2026-03-18 — Phase 3)

```
Test Suites: 1 passed, 1 total
Tests:       82 passed, 0 failed, 82 total
Time:        ~25s
```

| Test Grubu | Test Sayisi | Sonuc | Aciklama |
|-----------|-------------|-------|----------|
| TIP_SEND (User → User) | 4 | **PASSED** | SEND/RECEIVE olusturma, queue job, confirm, fail |
| WITHDRAW (External) | 4 | **PASSED** | WITHDRAW olusturma, ERC20 transfer, no RECEIVE, confirm |
| DEPOSIT (Webhook) | 3 | **PASSED** | Incoming deposit, pending deposit, outgoing withdraw |
| Webhook Lifecycle | 5 | **PASSED** | Transition, revert, error, cancel, idempotency, log |
| Cancel Tip Send | 5 | **PASSED** | Cancel SEND, linked RECEIVE, pending reject, auth check, WITHDRAW |
| Edge Cases | 8 | **PASSED** | Zero amount, self-send, insufficient balance, no wallet, invalid address, locked balance |
| Backend Transactions | 3 | **PASSED** | Claim reward, boost post, insufficient balance |
| Wallet Service | 6 | **PASSED** | Balance +/-, reject negative, locked balance, get balance |
| Transaction History | 4 | **PASSED** | History listing, pagination, empty, grouped |
| Webhook Signature | 4 | **PASSED** | Valid/invalid signature, expired/invalid timestamp |
| Fee Calculation | 6 | **PASSED** | %25 komisyon, SDK kapali, WITHDRAW fee yok, %33 decimal floor, %17 small amount, %0 fee |
| Atomic Confirm Guard | 2 | **PASSED** | Double-confirm idempotent, duplicate notification yok |
| Notification Data | 3 | **PASSED** | TIPS_SENT recipientUserId (senderUserId yok), TIPS_RECEIVED senderUserId, DEPOSIT notification yok |
| Failed Notification Filter | 3 | **PASSED** | TIP_SEND fail → notif, TIP_RECEIVE fail → no notif (BUG-19), WITHDRAW fail → no notif |
| Notification Error Resilience | 2 | **PASSED** | Confirm basarili even if notification throws, fail basarili even if notification throws |
| Cancel Metadata Preservation | 1 | **PASSED** | Fee metadata (feeAmount, feePercentage) cancel sonrasi korunuyor |
| **Locked Balance Unlock (C1)** | **5** | **PASSED** | Confirm unlock, WITHDRAW unlock, fail unlock, cancel unlock, sequential tip lock tracking |
| **Fail Status Guard (C2)** | **2** | **PASSED** | CONFIRMED tx fail edilemez, CREATED tx normal fail edilir |
| **Fee Edge Cases (C3)** | **3** | **PASSED** | 100% fee = no-fee, netAmount >= 1 guarantee, normal %10 hesaplama |
| **Entity isSend/isReceive (C4)** | **3** | **PASSED** | BOOST_POST = send, DEPOSIT = receive, WITHDRAW = send |
| **Notification Data Format (N1-N5)** | **4** | **PASSED** | TIPS_SENT recipient avatar, BOOST_POST isSystem, TRANSACTION_FAILED isSystem+errorMessage, TIPS_RECEIVED no isSystem |

---

## KRITIK HATALAR (Immediate Fix)

### BUG-1: Race Condition — Concurrent sendTip() ile Double Spend — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction.service.ts:80-203`
**Fix:** `walletRepo.lockBalance()` ile atomic balance locking. `sendTip()` hemen `lockedBalance` artiriyor, worker calistiktan sonra lock otomatik cozuluyor. Ayrica `prisma.$transaction()` ile SEND+RECEIVE cift olusturma atomic hale getirildi.

**Problem:**
`sendTip()` senkron bakiye kontrolu yapar ama bakiye düsusunu ASYNC worker'a birakir. Worker 5+ saniye sonra calisir. Bu arada ikinci bir `sendTip()` cagrilirsa ayni bakiyeyi gorur ve ayni kontrolu gecer.

```typescript
// Line 91: Wallet DB'den okunuyor
const fromWallet = await this.walletRepo.findPreferredForReceivingByUserId(request.fromUserId);

// Line 121: Balance kontrolu — bu an icin dogru ama lock yok
if (!fromWallet.hasBalance(request.amount)) {
  throw new ValidationError(...);
}

// Line 177-188: Job kuyruğa ekleniyor — bakiye HENUZ dusurulmedi!
await queueProvider.addTipSendJob({ ... });
```

**Senaryo:**
1. Kullanici A'nin bakiyesi 100 TIPS
2. Request-1: sendTip(100 TIPS → User B) → balance=100 >= 100 ✓ → queue
3. Request-2: sendTip(100 TIPS → User C) → balance=100 >= 100 ✓ → queue (HALA 100!)
4. Her iki worker da calisir → toplam 200 TIPS gonderilir, 100 TIPS bakiye ile

**Etki:** Kullanicilar bakiyelerinden fazla TIPS gonderebilir.

**Cozum:**
`sendTip()` icinde bakiyeyi hemen "lock" etmeli. Atomic DB update ile:
```typescript
// Prisma atomic update — balance >= amount ise dusur
const result = await prisma.wallet.updateMany({
  where: { id: fromWallet.id, balance: { gte: request.amount + lockedBalance } },
  data: { lockedBalance: { increment: request.amount } }
});
if (result.count === 0) throw new ValidationError('Insufficient balance');
```

---

### BUG-2: Atomic Olmayan SEND/RECEIVE Cift Olusturma — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction.service.ts:133-171`
**Fix:** `prisma.$transaction()` icinde SEND + RECEIVE + metadata update tek islemde yapiliyor. Hata olursa tum islem rollback oluyor ve `lockBalance` geri aliniyor.

**Problem:**
SEND ve RECEIVE transaction'lari ayri ayri olusturuluyor, `$transaction` kullanilmiyor. Ararada hata olursa SEND olusur ama RECEIVE olusturulamaz.

```typescript
// Line 134: SEND olustur — basarili
const sendTransaction = await this.transactionRepo.create({...});

// Line 150: RECEIVE olustur — BURASI FAIL OLABILIR!
const receiveTransaction = await this.transactionRepo.create({...});

// Line 165: SEND metadata guncelle — BURASI DA FAIL OLABILIR!
await this.transactionRepo.updateMetadata(sendTransaction.id, {
  receiveTransactionId: receiveTransaction.id,
});
```

**Etki:** Orphaned SEND transaction'lar, alicinin RECEIVE'i hic olusturulamamis. Kullanici SEND gorur ama alici hicbir sey gormez.

**Cozum:**
```typescript
const { sendTx, receiveTx } = await prisma.$transaction(async (tx) => {
  const sendTx = await tx.transaction.create({...});
  const receiveTx = toWallet ? await tx.transaction.create({...}) : null;
  if (receiveTx) {
    await tx.transaction.update({ where: { id: sendTx.id }, data: { metadata: {..., receiveTransactionId: receiveTx.id} } });
  }
  return { sendTx, receiveTx };
});
```

---

### BUG-3: Wallet Balance Update'de Pessimistic Lock Yok — FIXLENDI

**Dosya:** `backend/src/application/wallet/wallet.service.ts:155-204`
**Fix:** `walletRepo.incrementBalance()` Prisma `{ increment: amount }` kullaniyor. Read-then-write pattern tamamen kaldirildi. Negatif balance korumasi: `updateMany` ile `balance >= abs(amount)` kontrolu atomic olarak yapiliyor.

**Problem:**
`updateBalance()` once wallet'i okur, sonra yeni balance hesaplar, sonra yazar. Iki concurrent islem ayni anda okursa ikisi de ayni baslangic degerini gorur.

```typescript
const wallet = await this.walletRepo.findById(walletId);         // Thread A: 100
const currentBalance = wallet.balance || 0;                       // Thread B: 100
const newBalance = currentBalance + amount;                       // Thread A: 80, Thread B: 70
const updatedWallet = await this.walletRepo.updateBalance(walletId, newBalance); // Son yazan kazanir!
```

**Senaryo:** Iki ayri tip confirm ediliyor, her ikisi de bakiyeyi okuyor (100), biri -20 yaziyor (80), digeri -30 yaziyor (70). Dogru sonuc 50 olmali ama 70 oluyor. 20 TIPS kaybolur!

**Cozum:**
```typescript
// Prisma atomic increment kullan:
await prisma.wallet.update({
  where: { id: walletId },
  data: { balance: { increment: amount } }  // amount negatif olabilir
});
```

---

### BUG-4: Webhook Idempotency Yetersiz — Ayni Status Tekrar Islenir — FIXLENDI

**Dosya:** `backend/src/application/thirdweb-webhook/thirdweb-webhook.service.ts:128-152`
**Fix:** `WEBHOOK_STATUS_PRIORITY` guncellendi: `errored: 3` (eskiden 1). Artik `errored` webhook'u `sent` sonrasinda geldiginde skip edilmiyor.

**Problem:**
Idempotency kontrolu PRIORITY bazli, tam duplicate kontrolu yok. Ayni `queueId` + ayni `status` tekrar gelirse `newPriority === existingPriority` → skip koşulu `<=` ile karşılanır. **ANCAK** `errored` (priority=1) webhook'u `sent` (priority=2) sonrasinda gelirse, `1 <= 2` oldugundan **skip edilir** — hata olustu ama sistem bunu gormez!

```typescript
export const WEBHOOK_STATUS_PRIORITY: Record<string, number> = {
  'mined': 4,
  'cancelled': 3,
  'sent': 2,
  'errored': 1  // ← En dusuk priority!
};

// Line 137: errored (1) <= sent (2) → SKIP!
if (newPriority <= existingPriority) {
  return { success: true, action: 'skipped', ... };
}
```

**Etki:** Transaction on-chain fail olsa bile, DB'de PENDING olarak kalir. Kullanici sonsuza dek "Processing..." gorur.

**Cozum:**
Priority sirasini degistir:
```typescript
export const WEBHOOK_STATUS_PRIORITY: Record<string, number> = {
  'mined': 4,
  'errored': 3,   // errored artik sent'ten yuksek
  'cancelled': 3,
  'sent': 2,
};
```
Veya `errored`/`cancelled` status'larini her zaman isleyen ozel mantik ekle.

---

### BUG-5: syncWalletBalanceFromChain Pending Transaction'lari Ezer — FIXLENDI

**Dosya:** `backend/src/application/wallet/wallet.service.ts:273-310`
**Fix:** `syncWalletBalanceFromChain()` basinda `transaction.count({ status: in ['pending','created'] })` kontrolu eklendi. Pending transaction varsa sync skip ediliyor ve `{ success: false, error: 'Pending transactions exist' }` donuyor.

**Problem:**
`syncWalletBalanceFromChain()` chain'den balance okur ve DB'ye **tamamen yazar** (`setBalance`). Eger chain henuz pending transaction'i reflect etmemisse, DB balance'i geri doner.

```typescript
// Line 289-291: Chain'den al, DB'ye TAMAMEN yaz
const balance = balanceResult.balanceFormatted ?? 0;
const lockedBalance = pendingResult.pendingFormatted ?? 0;
await this.walletRepo.setBalance(walletId, balance, lockedBalance);
```

Bu fonksiyon hem worker'dan (line 206 tip-send.worker.ts) hem webhook'tan (line 307 thirdweb-webhook.service.ts) **fire-and-forget** olarak çağrılıyor. Yani hemen return ettikten sonra arka planda balance'ı override edebilir.

**Senaryo:**
1. DB balance = 100
2. Worker: tip send basarili, confirmTransaction → balance update bekliyor
3. Worker: syncWalletBalanceFromChain fire-and-forget cagirdi
4. Chain hala eski state'de (100) → setBalance(100) → DB'yi 100'e geri yazdi!
5. confirmTransaction sonucu kayboldu

**Etki:** Balance degisiklikleri kaybolur, kullanicinin bakiyesi yanlis gosterilir.

**Cozum:**
- CREATED/PENDING transaction varken sync YAPMA
- Veya: `setBalance` yerine `increment`/`decrement` kullan
- Veya: Sync'i yalnizca transaction confirmed OLDUKTAN SONRA cagir (fire-and-forget yerine await)

---

## YUKSEK ONCELIKLI HATALAR (High Priority)

### BUG-6: GET /api/transactions/:id — Authorization Eksik — FIXLENDI

**Dosya:** `backend/src/interfaces/transaction/transaction.router.ts:408-429`
**Fix:** Endpoint'e wallet ownership kontrolu eklendi. `wallet.userId !== userId` ise `403 Forbidden` donuyor.

**Problem:**
Herhangi bir authenticated kullanici, herhangi bir transaction ID'si ile baska kullanicilarin islem detaylarini gorebilir.

```typescript
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const transaction = await transactionService.getTransactionById(id);
  // ← Burada userId kontrolu YOK!
  return res.json({ success: true, data: txData });
}));
```

**Etki:** Privacy ihlali — kullanicilar baskalarinin islem tutarlarini, adreslerini, metadata'larini gorebilir.

**Cozum:**
```typescript
const wallet = await walletRepo.findById(transaction.walletId);
if (!wallet || wallet.userId !== userId) {
  return res.status(403).json({ success: false, message: 'Forbidden' });
}
```

---

### BUG-7: BOOST_POST Notification Handling Eksik — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction-notification.service.ts:52-151`
**Fix:** `TransactionActionType.BOOST_POST` case eklendi. `TRANSACTION_CONFIRMED` notification'i `postId` metadata'si ile gonderiliyor.

**Problem:**
`TransactionActionType.BOOST_POST` switch-case'te handle edilmiyor. `default` case'e dusuyor, sadece debug log yaziliyor. Kullanici boost yaptigini bilmiyor.

```typescript
// switch (transaction.actionType) icinde BOOST_POST yok!
// default:
//   logger.debug({ ... 'No notification mapping for transaction action type' });
```

**Etki:** Kullanici 100 TIPS harcayip post boost yapiyor ama bildirim almiyor.

**Cozum:**
`SWAP_TIP_TO_SOL` grubuna ekle veya ozel bir case yaz:
```typescript
case TransactionActionType.BOOST_POST: {
  await this.notificationService.sendNotification(userId, NotificationType.TRANSACTION_CONFIRMED, {
    amount,
    actionType: transaction.actionType,
    transactionId: transaction.id,
    postId: metadata.postId ?? null,
  });
  break;
}
```

---

### BUG-8: TIPS_RECEIVED Notification — Gonderen Gosterilmiyor — FIXLENDI

**Dosya:** `backend/src/application/notification/notification-factory.ts:169-174`
**Fix:** Template `getMessage` guncellendi: `You received ${amount} TIPS from ${senderUsername}` formatinda. Sender yoksa sadece `You received X TIPS` gosteriyor.

**Problem:**
Template `senderUsername` parametresini almasina ragmen kullanmiyor:

```typescript
this.registerTemplate({
  type: NotificationType.TIPS_RECEIVED,
  category: NotificationCategory.SYSTEM,
  getTitle: () => 'TIPS Received! 💰',
  getMessage: (data) => `You received ${data.amount || 0} TIPS`,  // ← senderUsername YOK!
});
```

`transaction-notification.service.ts:73-78` gonderen adini gonderiyor:
```typescript
await this.notificationService.sendNotification(userId, NotificationType.TIPS_RECEIVED, {
  amount,
  senderUsername: fromProfile?.userName || fromProfile?.displayName || null, // ← Gonderiliyor ama kullanilmiyor!
});
```

**Etki:** Kullanici "You received 50 TIPS" gorur ama kimden geldigini bilmez.

**Cozum:**
```typescript
getMessage: (data) => {
  const from = data.senderUsername ? ` from ${data.senderUsername}` : '';
  return `You received ${data.amount || 0} TIPS${from}`;
},
```

---

### BUG-9: Worker'da confirmTransaction Hatasi — Balance Guncellenmeden CONFIRMED Yaziliyor — FIXLENDI

**Dosya:** `backend/src/infrastructure/workers/tip-send.worker.ts:168-194`
**Fix:** Force-confirm yerine retry mekanizmasi eklendi. Once `confirmTransaction()` tekrar deneniyor (gecici DB hatasi icin). Sadece retry da basarisiz olursa son care olarak force-CONFIRMED yapiliyor.

**Problem:**
`confirmTransaction()` basarisiz olursa, worker catch bloğunda dogrudan `updateStatus(CONFIRMED)` cagirir — **balance update'i atlayarak**:

```typescript
} catch (err) {
  // confirmTransaction fail oldu — belki balance update icindeki hata
  try {
    // DOGRUDAN status'u CONFIRMED yap — BALANCE GUNCELLENMEDEN!
    await this.transactionRepo.updateStatus(sendTransactionId, TransactionStatus.CONFIRMED, { txHash });
    if (hasReceiveTx) {
      await this.transactionRepo.updateStatus(receiveTransactionId!, TransactionStatus.CONFIRMED, { txHash });
    }
  } catch (forceErr) { ... }
}
```

**Senaryo:**
1. Worker chain'e gonderdi, receipt aldi
2. `confirmTransaction()` balance update deniyor → DB connection hatasi
3. Worker catch'e dusuyor → sadece status = CONFIRMED yaziyor
4. Balance guncellenmedi ama transaction confirmed!
5. NOT: TIP_SEND/TIP_RECEIVE icin isTipPair=true oldugundan balance zaten atlanir, ama WITHDRAW icin bu gercek bir sorun

**Etki:** WITHDRAW islemlerinde bakiye dusulmeden transaction confirmed olabilir.

**Cozum:**
Force confirm yapmak yerine, transaction'i PENDING'de birak ve retry mekanizmasi ekle. Veya en azindan WITHDRAW tipi icin balance update'i de force et.

---

### BUG-10: N+1 Query — Transaction History Endpoint'i — FIXLENDI

**Dosya:** `backend/src/interfaces/transaction/transaction.router.ts:284-341`
**Fix:** User ID'leri `Set` ile toplanip tek `findMany` sorgusunda getiriliyor, `Map` ile eslestiriliyor. 20 tx icin 40 sorgu yerine 1 sorgu.

**Problem:**
Her transaction icin sender ve recipient bilgisi icin ayri DB sorgusu atiliyor:

```typescript
const enrichedItems = await Promise.all(
  result.items.map(async (tx) => {
    if (tx.metadata?.senderUserId) {
      const sender = await prisma.user.findUnique({...}); // N sorgu
    }
    if (tx.metadata?.recipientUserId) {
      const recipient = await prisma.user.findUnique({...}); // N sorgu
    }
  })
);
```

20 transaction → 40 ek DB sorgusu. Pagination artarsa daha da kotulesir.

**Etki:** Yavas API response (500ms+ gecikme), yuksek DB load.

**Cozum:**
User ID'leri topla, tek sorguda getir, Map ile eslestir:
```typescript
const allUserIds = new Set<string>();
result.items.forEach(tx => {
  if (tx.metadata?.senderUserId) allUserIds.add(tx.metadata.senderUserId);
  if (tx.metadata?.recipientUserId) allUserIds.add(tx.metadata.recipientUserId);
});
const users = await prisma.user.findMany({
  where: { id: { in: [...allUserIds] } },
  include: { profile: true, avatars: { where: { isActive: true }, take: 1 } }
});
const userMap = new Map(users.map(u => [u.id, u]));
```

---

## ORTA ONCELIKLI HATALAR (Medium Priority)

### BUG-11: Cancelled Transaction'lar FAILED ile Karistiriliyor — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction.service.ts:220-257`
**Fix:** `cancelTipSend()` artik metadata'ya `cancelledByUser: true` flag'i ekliyor. Frontend/raporlama bu flag ile cancel vs on-chain fail ayrimi yapabilir.

**Problem:**
`cancelTipSend()` transaction'i `FAILED` status'una aliyor, `errorMessage: 'Cancelled by user'` ile. Ama on-chain fail olan transaction'lar da FAILED. Ikisi ayni gorunuyor.

```typescript
await this.transactionRepo.updateStatus(transactionId, TransactionStatus.FAILED, { errorMessage: 'Cancelled by user' });
```

Filter mekanizmasi (repository line 106-114) sadece `errorMessage === 'Cancelled by user'` kontrolu yapiyor — fragile string match.

**Etki:** Kullanici cancel ettigi ve on-chain fail olan transaction'lari ayirt edemiyor. Raporlama yanlis.

**Cozum:** `TransactionStatus.CANCELLED` enum degeri ekle veya metadata'ya `{ cancelledByUser: true }` flag'i koy.

---

### BUG-12: Hardcoded Turkce Default Isim — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction-notification.service.ts:58, 101, 119`
**Fix:** `'Kullanici'` → `'User'` olarak degistirildi (transaction-notification.service.ts ve transaction.service.ts).

**Problem:**
Bildirim metinlerinde `'Kullanıcı'` hardcoded:
```typescript
const recipientName = toProfile?.displayName || toProfile?.userName || 'Kullanıcı';
```

**Etki:** Ingilizce kullanan kullanicilar icin tutarsiz UX.

**Cozum:** i18n sistemi veya en azindan `'User'` kullan.

---

### BUG-13: Metadata Field Tutarsizligi — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction.service.ts:156-170`
**Fix:** Yeni SEND/RECEIVE islemleri `pairedTransactionId` kullaniyor. Webhook service backward-compatible: `pairedTransactionId || receiveTransactionId || linkedTransactionId` fallback chainile eski verileri de destekliyor.

**Problem:**
SEND metadata: `receiveTransactionId` kullanir.
RECEIVE metadata: `linkedTransactionId` kullanir.
Webhook service her ikisini de arar (line 401-402, 557-558) ama bu fragile:

```typescript
// Webhook'ta fallback:
const linkedId = (existingMeta?.receiveTransactionId as string) || (existingMeta?.linkedTransactionId as string);
```

**Etki:** Gelecekte biri field adini degistirirse linking kirilir. Debug zor.

**Cozum:** Her iki tarafta da ayni field adi kullan (ornegin `pairedTransactionId`).

---

### BUG-14: Unhandled Promise'ler — NFT Transfer — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction.service.ts:765-791`
**Fix:** `Promise.all([...]).catch()` → `await Promise.all([...]).catch()` — promise'ler artik await ediliyor, unhandled rejection riski ortadan kalkti.

**Problem:**
Cache invalidation ve notification `await` edilmeden fire-and-forget ediliyor:
```typescript
Promise.all([
  invalidateNFTCache(nftId),
  invalidateUserNFTCache(fromUserId),
  invalidateUserNFTCache(toUserId),
]).catch((error) => {
  logger.error('Error invalidating NFT transfer cache:', error);
});
```

**Etki:** Sessiz hatalar, stale cache verilir. UnhandledRejection Node.js'i crash ettirme riski (strict mode'da).

---

## OZET TABLOSU

| # | Bug | Severity | Tip | Dosya |
|---|-----|----------|-----|-------|
| 1 | Race condition: double spend | **KRITIK** | Race Condition | transaction.service.ts |
| 2 | Atomic olmayan SEND/RECEIVE cift | **KRITIK** | Data Integrity | transaction.service.ts |
| 3 | Wallet balance pessimistic lock yok | **KRITIK** | Race Condition | wallet.service.ts |
| 4 | Webhook errored status skip ediliyor | **KRITIK** | Logic Bug | thirdweb-webhook.service.ts |
| 5 | Sync pending transaction'lari eziyor | **KRITIK** | Data Integrity | wallet.service.ts |
| 6 | Transaction GET authorization yok | **YUKSEK** | Security | transaction.router.ts |
| 7 | BOOST_POST notification eksik | **YUKSEK** | Missing Feature | transaction-notification.service.ts |
| 8 | TIPS_RECEIVED sender gosterilmiyor | **YUKSEK** | UX Bug | notification-factory.ts |
| 9 | Force CONFIRMED balance olmadan | **YUKSEK** | Balance Bug | tip-send.worker.ts |
| 10 | N+1 query transaction history | **YUKSEK** | Performance | transaction.router.ts |
| 11 | CANCELLED = FAILED karisiyor | **ORTA** | Data Model | transaction.service.ts |
| 12 | Hardcoded Turkce default isim | **ORTA** | i18n | transaction-notification.service.ts |
| 13 | Metadata field tutarsizligi | **ORTA** | Maintenance | transaction.service.ts |
| 14 | Unhandled NFT transfer promise'ler | **ORTA** | Error Handling | transaction.service.ts |

---

## ONERILEN FIX SIRASI

1. **BUG-1 + BUG-3:** Balance locking + atomic increment (ayni PR)
2. **BUG-2:** Prisma $transaction ile SEND/RECEIVE atomic olusturma
3. **BUG-4:** Webhook status priority duzeltmesi
4. **BUG-5:** Sync mekanizmasini PENDING transaction kontrolu ile koruma
5. **BUG-6:** Transaction GET endpoint authorization
6. **BUG-8 + BUG-7:** Notification template duzeltmeleri
7. **BUG-9:** Worker force-confirm mantigi duzeltmesi
8. **BUG-10:** N+1 query cozumu
9. Diger medium priority buglar

---

## KOMISYON/FEE YONETIMI HATALARI (2. Audit — 2026-03-18)

### Akis Analizi: Tip Send ile Komisyon Sureci

Tipbox contract uzerinden tip gonderildiginde on-chain akis su sekilde gerceklesir:

```
Kullanici A (gonderici)
    |
    |-- 100 TIPS --> Tipbox Contract
                        |
                        |-- 75 TIPS --> Kullanici B (alici)     [Transfer Event #1]
                        |-- 25 TIPS --> feeRecipient (platform) [Transfer Event #2]
```

Contract `feePercentage` (orn. 25 = %25) kadar keser ve `feeRecipient` adresine aktarir.
Geri kalan net tutar aliciya gider. Bu iki transfer ayri ayri on-chain Transfer event olarak yayinlanir.

### Mevcut Sistem Davranisi (Hatali)

```
sendTip(100 TIPS, A→B)
  ├─ DB: TIP_SEND  (walletA, amount=100)  ← Dogru
  ├─ DB: TIP_RECEIVE(walletB, amount=100)  ← YANLIS — net 75 olmali
  │
  ├─ Worker: SDK sendTip → receipt (txHash)
  ├─ Worker: confirmTransaction(SEND)  → status=CONFIRMED, notification gonderilir
  ├─ Worker: confirmTransaction(RECEIVE) → status=CONFIRMED, notification gonderilir
  │     └─ Notification: "You received 100 TIPS" ← YANLIS
  │
  └─ Contract Event (async):
      ├─ Transfer #1 (→ B, 75 TIPS): INTERNAL TRANSFER → zaten confirmed, skip
      ├─ Transfer #2 (→ feeRecipient, 25 TIPS): FEE transaction olustur (walletB)
      │     └─ Notification: "Your 25 TIPS transaction completed" ← GEREKSIZ/KARISTIRICI
      └─ RECEIVE amount GUNCELLENMEZ — hala 100 gosteriyor
```

**Sonuc:** Kullanici B'nin transaction history'si:
- TIP_RECEIVE: 100 TIPS (yanlis — 75 almis)
- FEE: 25 TIPS (hizmet bedeli — dogru ama bag kurulmamis)
- Wallet balance: 75 TIPS (dogru — chain sync'ten)

---

### BUG-15: TIP_RECEIVE Transaction Amount = Gross Tutar (Komisyon Dusulmemis)

**Dosya:** `backend/src/application/transaction/transaction.service.ts:163-178`
**Oncelik:** **KRITIK**
**Durum:** TESPIT EDILDI

**Problem:**
`sendTip()` icinde RECEIVE transaction, gonderilen tam tutar (gross) ile olusturuluyor. Tipbox contract'in kesecegi komisyon hesaba katilmiyor:

```typescript
// transaction.service.ts:163-178
const receiveTx = await tx.transaction.create({
  data: {
    walletId: toWallet.id,
    actionType: TransactionActionType.TIP_RECEIVE,
    amount: request.amount,  // ← 100 TIPS — gross tutar, net 75 olmali!
    fromAddress,
    toAddress,
    metadata: {
      reason: request.reason || null,
      senderUserId: request.fromUserId,
      pairedTransactionId: sendTx.id,
      source: 'thirdweb_sdk',
    },
    provider: 'thirdweb',
  },
});
```

**Mevcut Kaynak:** `thirdweb-sdk.service.ts:486` — `getFeePercentage()` metodu zaten var ve contract'tan fee yuzdesini okuyabiliyor. Ancak `sendTip()` bu metodu KULLANMIYOR.

**Etki:**
- Kullanici transaction history'de "100 TIPS aldim" goruyor ama bakiyesine 75 eklenmis
- Muhasebe/raporlama tutarsiz (toplam RECEIVE amount'lari, gercek balance artislarindan fazla)
- Frontend icin confusing UX

**Cozum Onerisi:**
```typescript
// sendTip() icinde fee hesapla:
const sdk = getThirdwebSdkService();
const feePercentage = sdk.isConfigured() ? await sdk.getFeePercentage() : 0;
const feeAmount = Math.floor(request.amount * feePercentage / 100);
const netAmount = request.amount - feeAmount;

// RECEIVE transaction'i net tutar ile olustur:
const receiveTx = await tx.transaction.create({
  data: {
    ...
    amount: netAmount,   // 75 — komisyon dusulmus
    metadata: {
      ...
      grossAmount: request.amount,   // 100 — toplam gonderilen
      feeAmount: feeAmount,          // 25 — platform kesintisi
      feePercentage: feePercentage,  // 25 — yuzde
    },
  },
});
```

---

### BUG-16: confirmTransaction() — RECEIVE Amount Guncellenmez

**Dosya:** `backend/src/application/transaction/transaction.service.ts:466-505`
**Oncelik:** **KRITIK**
**Durum:** TESPIT EDILDI

**Problem:**
`confirmTransaction()` icindeki `isTipPair` blogu sadece balance update'i atlar (chain sync'e birakir). Ancak **RECEIVE transaction'in amount degerini de hic guncellemez**. Eger RECEIVE ilk basta gross tutar (100) ile olusturulduysa, confirm sonrasinda da 100 olarak kalir.

```typescript
// transaction.service.ts:466-505
const isTipPair =
  transaction.actionType === TransactionActionType.TIP_SEND ||
  transaction.actionType === TransactionActionType.TIP_RECEIVE;

if (!isTipPair) {
  // balance update sadece tip-disi islemler icin
  if (isReceive) { await this.walletService.updateBalance(...); }
  else if (isSend) { await this.walletService.updateBalance(...); }
}
// ← isTipPair true ise: HICBIR SEY YAPILMAZ — amount duzeltilmez, balance guncellenmez
```

**Etki:** RECEIVE transaction sonsuza dek yanlis tutar gosterir. History/notification hep gross tutar kullanir.

---

### BUG-17: Contract Event — INTERNAL TRANSFER RECEIVE Amount Guncellemiyor

**Dosya:** `backend/src/application/thirdweb-webhook/contract-event.service.ts:690-728`
**Oncelik:** **YUKSEK**
**Durum:** TESPIT EDILDI

**Problem:**
INTERNAL TRANSFER blogu, mevcut SEND+RECEIVE transaction'larini txHash ile bulup `confirmTransaction()` cagirir. Contract event'ten gelen **gercek on-chain tutar** (75 TIPS) mevcut ama RECEIVE transaction'in amount'u guncellenmez:

```typescript
// contract-event.service.ts:690-728
// INTERNAL TRANSFER (tip send: SEND + RECEIVE ayni txHash ile confirm edilir)
else if (toWallet && fromWallet) {
  walletId = toWallet.id;
  const hash = event.transactionHash?.trim();
  const byTxHash = hash ? await this.transactionRepo.findByTxHash(hash) : [];
  const toConfirm = byTxHash.filter(
    tx => (tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.CREATED)
  );
  if (toConfirm.length > 0) {
    for (const tx of toConfirm) {
      await this.transactionService.confirmTransaction(tx.id, hash ?? undefined);
      // ← amount GUNCELLENMEZ! Event'teki gercek tutar (75) kullanilmiyor
    }
  }
}
```

Contract event'ten alinan `amount` (75 TIPS — net alici tutari), RECEIVE transaction'a yazilmiyor. Sadece status CONFIRMED yapiliyor.

**Dikkate Alinmasi Gereken:** Ayni txHash icin **iki** Transfer event gelir:
1. A → B (75 TIPS) — alicinin gercek aldi
2. A → feeRecipient (25 TIPS) — platform fee

Birinci event'teki `amount`, RECEIVE transaction'in gercek tutaridir ama sistem bunu kullanmiyor.

**Cozum Onerisi:**
INTERNAL TRANSFER blogunda, TIP_RECEIVE transaction'in amount'unu event'teki gercek tutar ile guncelle:

```typescript
for (const tx of toConfirm) {
  // TIP_RECEIVE ise: amount'u contract event'teki gercek tutarla guncelle
  if (tx.actionType === TransactionActionType.TIP_RECEIVE && amount !== tx.amount) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        amount: amount,  // event'teki gercek tutar (75)
        metadata: {
          ...(tx.metadata as Record<string, unknown> || {}),
          grossAmount: tx.amount,       // orijinal tutar (100)
          feeAmount: tx.amount - amount, // fark = fee (25)
        },
      },
    });
  }
  await this.transactionService.confirmTransaction(tx.id, hash ?? undefined);
}
```

---

## NOTIFICATION MANTIK HATALARI (2. Audit — 2026-03-18)

### BUG-18: TIP_RECEIVE Notification — Yanlis Tutar Gosteriyor

**Dosya:** `backend/src/application/transaction/transaction-notification.service.ts:68-80`
**Oncelik:** **YUKSEK**
**Durum:** TESPIT EDILDI

**Problem:**
TIP_RECEIVE notification'i `transaction.amount` degerini kullanir. Bu deger RECEIVE transaction'daki gross tutar (100), alicinin gercekte aldigi net tutar (75) degil:

```typescript
// transaction-notification.service.ts:68-80
case TransactionActionType.TIP_RECEIVE: {
  const senderUserId = metadata.senderUserId as string | undefined;
  const fromProfile = senderUserId
    ? await this.profileRepo.findByUserId(senderUserId)
    : null;
  await this.notificationService.sendNotification(userId, NotificationType.TIPS_RECEIVED, {
    amount,  // ← transaction.amount = 100 — YANLIS, net 75 olmali
    senderUserId: senderUserId ?? null,
    senderUsername: fromProfile?.userName || fromProfile?.displayName || null,
    transactionId: transaction.id,
  });
  break;
}
```

**Notification Template** (`notification-factory.ts:173-176`):
```typescript
getMessage: (data) => {
  const from = data.senderUsername ? ` from ${data.senderUsername}` : '';
  return `You received ${data.amount || 0} TIPS${from}`;
  // ← "You received 100 TIPS from Ali" — aslinda 75 aldi
},
```

**Etki:** Kullanici "100 TIPS aldim" sanir ama bakiyesine 75 eklenmis. Guvensizlik ve destek talepleri olusur.

**Not:** Bu bug BUG-15 fixlendikten sonra otomatik olarak cozulur — eger RECEIVE amount net tutar ile olusturulursa, notification da dogru tutari gosterir.

---

### BUG-19: Fail Durumunda Aliciya Yanlis TRANSACTION_FAILED Notification

**Dosya:** `backend/src/application/transaction/transaction-notification.service.ts:177-212`
**Oncelik:** **ORTA**
**Durum:** TESPIT EDILDI

**Problem:**
`sendTransactionFailedNotification()` DEPOSIT ve WITHDRAW icin filtre var ama **TIP_RECEIVE icin filtre YOK**:

```typescript
// transaction-notification.service.ts:177-186
async sendTransactionFailedNotification(transaction, errorMessage) {
  if (
    transaction.actionType === TransactionActionType.DEPOSIT ||
    transaction.actionType === TransactionActionType.WITHDRAW
  ) {
    return; // ← DEPOSIT/WITHDRAW filtreleniyor
  }
  // ← TIP_RECEIVE FILTRELENMEZ!

  // Aliciya "Transaction failed" notification gider
  await this.notificationService.sendNotification(
    wallet.userId,
    NotificationType.TRANSACTION_FAILED,
    { ... }
  );
}
```

**Mevcut Worker Davranisi:** Worker `failSendOrBoth()` metodu dogrudan `transactionRepo.updateStatus()` kullanir (`transactionService.failTransaction()` degil), bu yuzden **simdilik** notification tetiklenmiyor. Ancak bu bir implementation detail'dir — gelecekte biri `failTransaction()` kullanirsa, aliciya "Your transaction failed" notification gider. Alici henuz tip almis oldugundan habersiz, fail notification'i kafa karistirici.

**Cozum Onerisi:**
```typescript
if (
  transaction.actionType === TransactionActionType.DEPOSIT ||
  transaction.actionType === TransactionActionType.WITHDRAW ||
  transaction.actionType === TransactionActionType.TIP_RECEIVE  // ← Ekle
) {
  return;
}
```

---

### BUG-20: FEE Transaction icin Gereksiz TRANSACTION_CONFIRMED Notification

**Dosya:** `backend/src/application/transaction/transaction-notification.service.ts:142-153`
**Oncelik:** **DUSUK**
**Durum:** TESPIT EDILDI

**Problem:**
FEE action type `SWAP_TIP_TO_SOL / AIRDROP / FEE / CLAIM_BADGE` grubuna dahil ve `TRANSACTION_CONFIRMED` notification tetikliyor:

```typescript
// transaction-notification.service.ts:142-153
case TransactionActionType.SWAP_TIP_TO_SOL:
case TransactionActionType.SWAP_SOL_TO_TIP:
case TransactionActionType.AIRDROP:
case TransactionActionType.FEE:        // ← FEE buraya dusuyor
case TransactionActionType.CLAIM_BADGE: {
  await this.notificationService.sendNotification(userId, NotificationType.TRANSACTION_CONFIRMED, {
    amount,
    actionType: transaction.actionType,
    transactionId: transaction.id,
  });
  break;
}
```

**Ancak:** FEE transaction `contract-event.service.ts:546-566` icinde dogrudan Prisma ile `status='confirmed'` olarak olusturuluyor — `transactionService.confirmTransaction()` CAGIRILMIYOR. Bu yuzden **simdilik** notification tetiklenmiyor. Ama bu bir kaza; eger biri gelecekte FEE islemini `confirmTransaction()` uzerinden gecirirse, aliciya "Your 25 TIPS transaction completed" notification'i gider — kullanici ne oldugunu anlamaz.

**Cozum Onerisi:**
FEE icin notification gonderme; sadece transaction history'de gosterilsin:

```typescript
case TransactionActionType.DEPOSIT:
case TransactionActionType.WITHDRAW:
case TransactionActionType.FEE:      // ← FEE'yi silent gruba tasi
  break;
```

---

### BUG-21: Worker + Contract Event Race Condition — Cift Notification Riski

**Dosya:** `backend/src/infrastructure/workers/tip-send.worker.ts:155-159` + `backend/src/application/thirdweb-webhook/contract-event.service.ts:698-701`
**Oncelik:** **ORTA**
**Durum:** TESPIT EDILDI

**Problem:**
Iki farkli kaynak ayni transaction'i neredeyse ayni anda confirm etmeye calisabilir:

1. **Worker** (tip-send.worker.ts:155-159): SDK receipt aldiktan sonra hemen `confirmTransaction()` cagirir
2. **Contract Event** (contract-event.service.ts:698-701): On-chain Transfer event geldiginde `confirmTransaction()` cagirir

`confirmTransaction()` icinde "already confirmed" guard var (line 437-439):
```typescript
if (transaction.status === TransactionStatus.CONFIRMED) {
  logger.warn(`Transaction ${transactionId} already confirmed`);
  return transaction;  // ← Guard: zaten confirmed ise atla
}
```

**Ancak** bu guard atomic degil — iki thread ayni anda bu kontrolu gecebilir:

```
Worker:         read status=PENDING → guard gec → ...processing...
Contract Event: read status=PENDING → guard gec → ...processing...
Worker:         updateStatus(CONFIRMED) + notification GONDERILDI
Contract Event: updateStatus(CONFIRMED) + notification GONDERILDI  ← CIFT!
```

**Etki:** Kullanici ayni islem icin 2x "TIPS Received" veya 2x "TIPS Sent" notification alabilir.

**Cozum Onerisi:**
`confirmTransaction()` icinde Prisma `updateMany` ile atomic guard:
```typescript
const result = await prisma.transaction.updateMany({
  where: { id: transactionId, status: { not: 'confirmed' } },
  data: { status: 'confirmed', confirmedAt: new Date(), txHash },
});
if (result.count === 0) {
  // Zaten baskasi confirm etti — notification gonderme
  return transaction;
}
// Buraya ulastiysa biz confirm ettik — notification gonder
```

---

## KOMISYON AKISI — DOGRU DAVRANIS TASARIMI

Asagida fix'ler uygulandiktan sonra beklenen dogru akis:

```
sendTip(100 TIPS, A→B)
  ├─ getFeePercentage() → 25
  ├─ netAmount = 100 - 25 = 75
  ├─ DB: TIP_SEND  (walletA, amount=100, metadata.feeAmount=25)
  ├─ DB: TIP_RECEIVE(walletB, amount=75,  metadata.grossAmount=100, feeAmount=25)
  │
  ├─ Worker: confirmTransaction(SEND)  → Notification: "You sent 100 TIPS to B"  ✓
  ├─ Worker: confirmTransaction(RECEIVE) → Notification: "You received 75 TIPS from A"  ✓
  │
  └─ Contract Event (async):
      ├─ Transfer (→B, 75 TIPS): INTERNAL TRANSFER → zaten confirmed, skip
      │     └─ Opsiyonel: RECEIVE amount dogrulama (75 == 75 ✓)
      ├─ Transfer (→feeRecipient, 25 TIPS): FEE transaction (walletB, amount=25)
      │     └─ Notification: GONDERILMEZ (silent)
      └─ Wallet balance: chain sync → 75 ✓
```

**Kullanici B Transaction History:**
| # | Tip | Tutar | Aciklama |
|---|-----|-------|----------|
| 1 | TIP_RECEIVE | 75 TIPS | "A kullanicisinden tip" |
| 2 | FEE | 25 TIPS | "Hizmet bedeli (platform fee)" |

**Kullanici B Notification:**
- "You received 75 TIPS from A" ✓ (dogru tutar)

---

## GUNCEL OZET TABLOSU (Tum Buglar)

| # | Bug | Severity | Tip | Dosya | Durum |
|---|-----|----------|-----|-------|-------|
| 1 | Race condition: double spend | **KRITIK** | Race Condition | transaction.service.ts | FIXLENDI |
| 2 | Atomic olmayan SEND/RECEIVE cift | **KRITIK** | Data Integrity | transaction.service.ts | FIXLENDI |
| 3 | Wallet balance pessimistic lock yok | **KRITIK** | Race Condition | wallet.service.ts | FIXLENDI |
| 4 | Webhook errored status skip ediliyor | **KRITIK** | Logic Bug | thirdweb-webhook.service.ts | FIXLENDI |
| 5 | Sync pending transaction'lari eziyor | **KRITIK** | Data Integrity | wallet.service.ts | FIXLENDI |
| 6 | Transaction GET authorization yok | **YUKSEK** | Security | transaction.router.ts | FIXLENDI |
| 7 | BOOST_POST notification eksik | **YUKSEK** | Missing Feature | transaction-notification.service.ts | FIXLENDI |
| 8 | TIPS_RECEIVED sender gosterilmiyor | **YUKSEK** | UX Bug | notification-factory.ts | FIXLENDI |
| 9 | Force CONFIRMED balance olmadan | **YUKSEK** | Balance Bug | tip-send.worker.ts | FIXLENDI |
| 10 | N+1 query transaction history | **YUKSEK** | Performance | transaction.router.ts | FIXLENDI |
| 11 | CANCELLED = FAILED karisiyor | **ORTA** | Data Model | transaction.service.ts | FIXLENDI |
| 12 | Hardcoded Turkce default isim | **ORTA** | i18n | transaction-notification.service.ts | FIXLENDI |
| 13 | Metadata field tutarsizligi | **ORTA** | Maintenance | transaction.service.ts | FIXLENDI |
| 14 | Unhandled NFT transfer promise'ler | **ORTA** | Error Handling | transaction.service.ts | FIXLENDI |
| EK | Duplicate DEPOSIT/WITHDRAW | **KRITIK** | Cross-source | thirdweb/contract-event/alchemy | FIXLENDI |
| 15 | TIP_RECEIVE amount = gross tutar | **KRITIK** | Komisyon | transaction.service.ts | FIXLENDI |
| 16 | confirmTransaction RECEIVE amount guncellenmez | **KRITIK** | Komisyon | transaction.service.ts | FIXLENDI |
| 17 | Contract event RECEIVE amount duzeltmiyor | **YUKSEK** | Komisyon | contract-event.service.ts | FIXLENDI |
| 18 | TIP_RECEIVE notification yanlis tutar | **YUKSEK** | UX Bug | transaction-notification.service.ts | FIXLENDI |
| 19 | Fail notification TIP_RECEIVE filtresiz | **ORTA** | Logic Bug | transaction-notification.service.ts | FIXLENDI |
| 20 | FEE icin gereksiz notification | **DUSUK** | UX Bug | transaction-notification.service.ts | FIXLENDI |
| 21 | Cift notification riski (race) | **ORTA** | Race Condition | transaction.service.ts | FIXLENDI |
| 22 | TIPS_SENT notification avatar resolve edilemiyor | **YUKSEK** | UX Bug | notification-enricher.ts | FIXLENDI |
| 23 | TIPS_SENT notification data'sinda sender bilgisi eksik | **ORTA** | Missing Data | transaction-notification.service.ts | FIXLENDI |
| 24 | FEE transaction metadata'sinda user ID yok | **DUSUK** | Missing Data | contract-event.service.ts | FIXLENDI |
| 25 | Locked balance hic unlock edilmiyor | **KRITIK** | Balance Bug | transaction.service.ts | FIXLENDI |
| 26 | failTransaction status guard yok | **KRITIK** | Logic Bug | transaction.service.ts | FIXLENDI |
| 27 | 100% fee netAmount=0 yapiyor | **KRITIK** | Edge Case | transaction.service.ts | FIXLENDI |
| 28 | Entity isSend() BOOST_POST eksik | **ORTA** | Data Model | transaction.entity.ts | FIXLENDI |
| 29 | Worker failSendOrBoth unlock bypass | **YUKSEK** | Balance Bug | tip-send.worker.ts | FIXLENDI |

### Onerilen Fix Sirasi (Eski Buglar — Tumu FIXLENDI)

1. **BUG-15:** `sendTip()` icinde `getFeePercentage()` ile net tutar hesapla, RECEIVE'i net amount ile olustur
2. **BUG-17:** Contract event INTERNAL TRANSFER blogunda RECEIVE amount dogrulamasi/guncelleme ekle
3. **BUG-16:** (BUG-15 fixlenince otomatik cozulur — RECEIVE artik dogru amount ile olusur)
4. **BUG-18:** (BUG-15 fixlenince otomatik cozulur — notification dogru tutari gosterir)
5. **BUG-22 + BUG-23:** Enricher'a `recipientUserId` tanimla + TIPS_SENT data'sina sender bilgisi ekle
6. **BUG-21:** `confirmTransaction()` icinde atomic guard (updateMany + count check)
7. **BUG-19:** `sendTransactionFailedNotification()` icine TIP_RECEIVE filtresi ekle
8. **BUG-20:** FEE action type'i notification silent grubuna tasi
9. **BUG-24:** FEE transaction metadata'sina ilgili user ID'leri ekle

### Phase 2 Buglar (Kapsamli Sistem Analizi — 2026-03-18)

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 25 | Locked balance hic unlock edilmiyor | **KRITIK** | confirmTransaction/failTransaction/cancelTipSend icine unlockBalance eklendi |
| 26 | failTransaction status guard yok | **KRITIK** | CONFIRMED tx fail edilemez guard eklendi |
| 27 | 100% fee netAmount=0 yapiyor | **KRITIK** | feePercentage < 100 cap + netAmount >= 1 guarantee |
| 28 | Entity isSend() BOOST_POST eksik | **ORTA** | transaction.entity.ts isSend() listesine BOOST_POST eklendi |
| 29 | Worker failSendOrBoth unlock bypass | **YUKSEK** | transactionService.failTransaction() kullaniliyor |

---

## NOTIFICATION HEDEFLEME VE DATA ANALIZI (3. Audit — 2026-03-18)

### Uctan Uca Notification Akis Izlemesi

**Ornek Senaryo:** User A (fromUserId) → 100 TIPS → User B (toUserId)

#### Adim 1: sendTip() — Transaction + Metadata Olusturma

```
TIP_SEND Transaction:
  walletId: fromWallet.id  (User A'nin wallet'i)
  metadata: {
    recipientUserId: "user-b-id",    ← alicinin userId
    reason: "...",
    source: "thirdweb_sdk",
    pairedTransactionId: "receive-tx-id"
    ⚠ senderUserId: YOK!             ← kendi userId metadata'da yok
  }

TIP_RECEIVE Transaction:
  walletId: toWallet.id  (User B'nin wallet'i)
  metadata: {
    senderUserId: "user-a-id",       ← gondericinin userId
    reason: "...",
    source: "thirdweb_sdk",
    pairedTransactionId: "send-tx-id"
    ⚠ recipientUserId: YOK!          ← kendi userId metadata'da yok
  }
```

#### Adim 2: Worker → confirmTransaction() → Notification Tetikleme

Worker sirayla cagirir:
1. `confirmTransaction(SEND_TX_ID, txHash)`
2. `confirmTransaction(RECEIVE_TX_ID, txHash)`

Her ikisi de `sendTransactionConfirmedNotification(confirmedTx)` tetikler.

#### Adim 3: Notification Service — userId Belirleme

`sendTransactionConfirmedNotification()` icinde:
```typescript
const wallet = await this.walletRepo.findById(transaction.walletId);
const userId = wallet.userId;  // ← Bu, notification'in GIDECEGI kisi
```

**TIP_SEND confirm:**
```
transaction.walletId = fromWallet.id → wallet.userId = User A
→ sendNotification(User A, TIPS_SENT, {...})
→ "You sent 100 TIPS to User B"  → User A'ya gider ✓ DOGRU
```

**TIP_RECEIVE confirm:**
```
transaction.walletId = toWallet.id → wallet.userId = User B
→ sendNotification(User B, TIPS_RECEIVED, {...})
→ "You received 100 TIPS from User A"  → User B'ye gider ✓ DOGRU
```

**✓ SONUC: Temel notification hedefleme DOGRU calisiyor. Notification dogru kisiye gidiyor.**

#### Adim 4: Notification Enricher — Avatar + Image Resolve

Enricher `data` icerisindeki user ID'lerden avatar ceker:

```typescript
// notification-enricher.ts:117-129 — Avatar resolve sirasi:
if (data.userId) userIdForAvatar = data.userId;
else if (data.requesterId) ...
else if (data.accepterId) ...
else if (data.likerId) ...
else if (data.commenterId) ...
else if (data.senderUserId) userIdForAvatar = data.senderUserId;  // ← 6. sirada
else if (data.senderId) ...
else if (data.trusterId) ...
else if (data.sharerId) ...
// ⚠ recipientUserId KONTROL EDILMIYOR!
```

**TIPS_RECEIVED notification data:**
```json
{ "amount": 100, "senderUserId": "user-a-id", "senderUsername": "ali", "transactionId": "..." }
```
→ Enricher `senderUserId` buluyor → **User A'nin avatari resolve ediliyor** ✓ DOGRU
→ User B, notification'da User A'nin avatarini goruyor ✓

**TIPS_SENT notification data:**
```json
{ "amount": 100, "recipientUserId": "user-b-id", "recipientName": "mehmet", "transactionId": "..." }
```
→ Enricher siralamasinda `recipientUserId` YOK → avatar bulunamiyor → **DEFAULT RANDOM AVATAR** ✗ YANLIS
→ User A, notification'da alicinin (User B) avatari yerine rastgele bir avatar goruyor

#### Notification Data/Avatar Sonuc Tablosu

| Notification | Alici | Avatar | Mesaj | Durum |
|-------------|-------|--------|-------|-------|
| TIPS_SENT | User A (gonderici) | ✗ Default (recipientUserId tanimli degil) | "You sent 100 TIPS to mehmet" | **AVATAR HATALI** |
| TIPS_RECEIVED | User B (alici) | ✓ User A'nin avatari (senderUserId) | "You received 100 TIPS from ali" | **TUTAR HATALI** (BUG-18) |
| FEE (confirm) | User B (alici) | ✗ Default (metadata'da userId yok) | "Your 25 TIPS transaction completed" | **GEREKSIZ** (BUG-20) |
| TRANSACTION_FAILED (TIP_RECEIVE) | User B (alici) | ✗ Default | "Your transaction failed" | **YANLIS HEDEF** (BUG-19) |

---

### BUG-22: TIPS_SENT Notification — Avatar Resolve Edilemiyor (Enricher Eksikligi)

**Dosya:** `backend/src/application/notification/notification-enricher.ts:117-129`
**Oncelik:** **YUKSEK**
**Durum:** TESPIT EDILDI

**Problem:**
Notification enricher, avatar resolve icin `data` objesindeki user ID'leri belirli bir sirayla kontrol eder. TIPS_SENT notification'da gonderilen data:

```typescript
// transaction-notification.service.ts:59-64
await this.notificationService.sendNotification(userId, NotificationType.TIPS_SENT, {
  amount,
  recipientUserId: recipientUserId ?? null,   // ← alicinin user ID'si
  recipientName,
  transactionId: transaction.id,
});
```

Enricher'daki kontrol sirasi (notification-enricher.ts:117-129):
```typescript
if (data.userId) userIdForAvatar = ...          // yok
else if (data.requesterId) ...                  // yok
else if (data.accepterId) ...                   // yok
else if (data.likerId) ...                      // yok
else if (data.commenterId) ...                  // yok
else if (data.senderUserId) ...                 // yok — TIPS_SENT data'sinda senderUserId yok!
else if (data.senderId) ...                     // yok
else if (data.trusterId) ...                    // yok
else if (data.sharerId) ...                     // yok
else if (data.replierId) ...                    // yok
// ⚠ recipientUserId HICBIR ZAMAN KONTROL EDILMIYOR
```

`recipientUserId` enricher'in bilmedigi bir key → avatar resolve basarisiz → default random avatar.

**Etki:** TIPS_SENT notification'da alicinin avatari gosterilemiyor. Kullanici kime gonderdigini avatardan anlayamiyor.

**Cozum Onerisi:**
Enricher'a `recipientUserId` desteği ekle:

```typescript
// notification-enricher.ts:129 civarına ekle:
else if (data.recipientUserId) userIdForAvatar = String(data.recipientUserId);
```

---

### BUG-23: TIPS_SENT Notification Data'sinda Gonderici (Self) Bilgisi Eksik

**Dosya:** `backend/src/application/transaction/transaction-notification.service.ts:53-65`
**Oncelik:** **ORTA**
**Durum:** TESPIT EDILDI

**Problem:**
TIPS_SENT notification data'sinda sadece alici bilgisi var (`recipientUserId`, `recipientName`). Gonderenin kendi bilgisi (`senderUserId`) yok:

```typescript
// transaction-notification.service.ts:59-64
await this.notificationService.sendNotification(userId, NotificationType.TIPS_SENT, {
  amount,
  recipientUserId: recipientUserId ?? null,
  recipientName,
  transactionId: transaction.id,
  // ⚠ senderUserId: YOK — gonderenin kendi ID'si data'da yok
  // ⚠ senderUsername: YOK
});
```

Notification DB'ye kaydedilirken `data` JSON olarak saklanir. Frontend bu data'yi kullanarak:
- Profile navigation yapar (recipientUserId ile alici profiline ✓)
- Avatar gosterir (enricher data'dan cekerken senderUserId'yi kullanir)

TIPS_SENT icin `senderUserId` (gonderenin kendisi) olmadigi icin:
1. Frontend gonderenin profilini gosteremez (data'da yok)
2. Enricher TIPS_SENT → bos avatar (ne senderUserId ne recipientUserId tanimli)

**Not:** Bu bug tek basina kritik degil ama BUG-22 fix'i ile birlikte cozulmesi daha temiz bir yapi saglar.

**Cozum Onerisi:**
```typescript
// transaction-notification.service.ts:53-65
case TransactionActionType.TIP_SEND: {
  const recipientUserId = metadata.recipientUserId as string | undefined;
  const toProfile = recipientUserId
    ? await this.profileRepo.findByUserId(recipientUserId)
    : null;
  const recipientName = toProfile?.displayName || toProfile?.userName || 'User';

  // Gonderenin kendi profil bilgisini de ekle
  const senderProfile = await this.profileRepo.findByUserId(userId);

  await this.notificationService.sendNotification(userId, NotificationType.TIPS_SENT, {
    amount,
    recipientUserId: recipientUserId ?? null,
    recipientName,
    senderUserId: userId,                                      // ← EKLE
    senderUsername: senderProfile?.userName || null,             // ← EKLE
    transactionId: transaction.id,
  });
  break;
}
```

---

### BUG-24: FEE Transaction Metadata'sinda User ID Bilgisi Yok

**Dosya:** `backend/src/application/thirdweb-webhook/contract-event.service.ts:546-566`
**Oncelik:** **DUSUK**
**Durum:** TESPIT EDILDI

**Problem:**
FEE transaction olusturulurken metadata sadece teknik bilgiler iceriyor. Hangi tip isleminden kaynaklanan bir fee oldugu, gonderici/alici userId bilgisi yok:

```typescript
// contract-event.service.ts:557-564
metadata: {
  source: 'contract_event_v1',
  chainId: event.chainId,
  contractAddress: event.contractAddress,
  blockNumber: event.blockNumber,
  tokenType: 'ERC20',
  description: 'Hizmet bedeli (Tipbox platform fee)',
  // ⚠ senderUserId: YOK — tip'i kim gonderdi?
  // ⚠ pairedTransactionId: YOK — hangi TIP_RECEIVE ile baglantili?
},
```

**Etki:**
1. FEE notification tetiklenirse (BUG-20 kapsaminda) enricher avatar bulamaz
2. Frontend FEE transaction'i gosterirken "bu fee hangi tip isleminden" sorusuna cevap veremez
3. Transaction history'de FEE, bagimsiz bir islem gibi gorunur — TIP_RECEIVE ile iliskisi kurulamaz

**Cozum Onerisi:**
FEE olusturulurken metadata'ya ilgili tip bilgilerini ekle:

```typescript
metadata: {
  source: 'contract_event_v1',
  chainId: event.chainId,
  contractAddress: event.contractAddress,
  blockNumber: event.blockNumber,
  tokenType: 'ERC20',
  description: 'Hizmet bedeli (Tipbox platform fee)',
  senderUserId: senderUserId ?? null,                          // ← EKLE
  pairedTransactionId: relatedReceiveTransactionId ?? null,    // ← EKLE
},
```

---

## PHASE 2: KAPSAMLI SISTEM ANALIZI (2026-03-18)

3 paralel analiz ajani (wallet, transaction, webhook) calistirildi. Toplam ~40 sorun tespit edildi. CRITICAL olanlar fixlendi:

### BUG-25: CRITICAL — Locked Balance Hicbir Zaman Unlock Edilmiyor — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction.service.ts`
**Oncelik:** **KRITIK — EN YUKSEK ONCELIK**

**Problem:**
`sendTip()` icinde `lockBalance()` cagirilarak gonderilecek tutar kilitleniyor (double spend onleme). Ancak:
- `confirmTransaction()` — unlock YOK
- `failTransaction()` — unlock YOK
- `cancelTipSend()` — unlock YOK

Bu, **her basarili/basarisiz/iptal edilen tip gonderiminde** kilitlenen tutarin kalici olarak kilitli kalmasina neden olur.

**Etki:**
- Kullanicinin `available balance = balance - lockedBalance` surekli azalir
- Birden fazla tip gonderdikten sonra bakiye var olmasina ragmen "Insufficient balance" hatasi alir
- Chain sync `setBalance` ile lockedBalance'i sifirlarsa gecici olarak cozulur ama sync garantisi yok

**Fix:**
```typescript
// confirmTransaction() — atomic confirm sonrasi:
const unlockableOnConfirm = [TransactionActionType.TIP_SEND, TransactionActionType.WITHDRAW];
if (unlockableOnConfirm.includes(transaction.actionType) && transaction.amount) {
  await this.walletRepo.unlockBalance(transaction.walletId, transaction.amount);
}

// failTransaction() — fail sonrasi:
const unlockableOnFail = [TransactionActionType.TIP_SEND, TransactionActionType.WITHDRAW];
if (unlockableOnFail.includes(transaction.actionType) && transaction.amount) {
  await this.walletRepo.unlockBalance(transaction.walletId, transaction.amount);
}

// cancelTipSend() — cancel sonrasi:
if (transaction.amount) {
  await this.walletRepo.unlockBalance(wallet.id, transaction.amount);
}
```

**Test:** 5 E2E test (confirm unlock, WITHDRAW unlock, fail unlock, cancel unlock, sequential tip lock tracking)

---

### BUG-26: CRITICAL — failTransaction() CONFIRMED Transaction'i Fail Edebilir — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction.service.ts:589-626`
**Oncelik:** **KRITIK**

**Problem:**
`failTransaction()` icinde hicbir status kontrolu yok. Zaten confirmed olmus bir transaction'i fail edebilir:

```typescript
// ONCEKI KOD — guard yok:
async failTransaction(transactionId, errorMessage) {
  const transaction = await this.transactionRepo.findById(transactionId);
  // ⚠ Hic status kontrol yok!
  const failedTx = await this.transactionRepo.updateStatus(transactionId, FAILED, { errorMessage });
}
```

**Senaryo:**
1. Worker: confirmTransaction(txId) → CONFIRMED + balance guncellendi
2. Alchemy webhook: ayni txHash ile fail sinyali gonderir (ornegin revert)
3. failTransaction(txId) → CONFIRMED → FAILED → balance geri alinmadi, ama status yanlis

**Fix:**
```typescript
if (transaction.status === TransactionStatus.CONFIRMED) {
  logger.warn({ transactionId, message: 'Cannot fail already-confirmed transaction (status guard)' });
  return transaction; // Sessizce mevcut tx don
}
```

**Test:** 2 E2E test (CONFIRMED fail engellenir, CREATED normal fail edilir)

---

### BUG-27: CRITICAL — 100% Fee Durumunda netAmount = 0 — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction.service.ts:148-166`
**Oncelik:** **KRITIK**

**Problem:**
Eger contract'tan donen `feePercentage = 100` ise:
```
feeAmount = Math.floor(amount * 100 / 100) = amount
netAmount = amount - amount = 0
```
RECEIVE transaction 0 tutarla olusturulur. On-chain'de 0 token transfer denemesi revert edebilir veya kullanici "0 TIPS received" gorur.

**Fix:**
```typescript
// feePercentage < 100 (100% = misconfiguration, fee uygulanmaz)
if (feePercentage > 0 && feePercentage < 100) {
  feeAmount = Math.floor(request.amount * feePercentage / 100);
  netAmount = request.amount - feeAmount;
  // Receiver en az 1 token alsin
  if (netAmount <= 0) {
    netAmount = 1;
    feeAmount = request.amount - 1;
  }
}
```

**Test:** 3 E2E test (100% fee = no-fee, small amount + high fee = min 1, normal fee dogru hesaplama)

---

### BUG-28: Entity isSend() BOOST_POST Eksik — FIXLENDI

**Dosya:** `backend/src/domain/transaction/transaction.entity.ts:39-47`
**Oncelik:** **ORTA**

**Problem:**
Entity'nin `isSend()` metodu BOOST_POST icermiyor ama service'in `confirmTransaction()` icindeki `isSend` listesi BOOST_POST iceriyor. Transaction history API'de `type: tx.isSend() ? 'sent' : 'received'` kullanildigi icin BOOST_POST "received" olarak gosterilir.

**Fix:** `transaction.entity.ts` isSend() listesine `TransactionActionType.BOOST_POST` eklendi.

**Test:** 3 E2E test (BOOST_POST=send, DEPOSIT=receive, WITHDRAW=send)

---

### BUG-29: Worker failSendOrBoth Unlock'u Bypass Ediyor — FIXLENDI

**Dosya:** `backend/src/infrastructure/workers/tip-send.worker.ts:241-253`
**Oncelik:** **YUKSEK**

**Problem:**
Worker'in `failSendOrBoth()` metodu dogrudan `transactionRepo.updateStatus()` cagirarak `transactionService.failTransaction()`'i bypass ediyor. BUG-25 fix'i ile failTransaction'a eklenen unlockBalance mantigi worker'in fail path'inde calismaz.

**Fix:**
```typescript
// ONCEKI:
private async failSendOrBoth(...) {
  await this.transactionRepo.updateStatus(sendId, FAILED, { errorMessage });
  if (receiveId) await this.transactionRepo.updateStatus(receiveId, FAILED, { errorMessage });
}

// SONRAKI:
private async failSendOrBoth(...) {
  await this.transactionService.failTransaction(sendId, errorMessage);
  if (receiveId) await this.transactionService.failTransaction(receiveId, errorMessage);
}
```

---

### Phase 3 Buglar (Notification Veri Formati Iyilestirme — 2026-03-18)

### BUG-30: TIPS_SENT Notification Gonderenin Kendi Avatarini Gosteriyor (N1/N2) — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction-notification.service.ts:53-68`, `backend/src/application/notification/notification-enricher.ts`
**Oncelik:** **YUKSEK**

**Problem:**
TIPS_SENT notification data'sinda hem `senderUserId` hem `recipientUserId` gonderiliyordu. Enricher'in avatar resolution priority sirasi `senderUserId` (pozisyon 6) > `recipientUserId` (pozisyon 8) oldugu icin, gonderenin kendi avatarini resolve ediyordu. Kullanici kendi profilinde, gonderim yaptigi kisiyi degil, kendi avatarini goruyordu.

**Fix:**
`transaction-notification.service.ts` TIP_SEND case'inden `senderUserId` cikarildi. Artik sadece `recipientUserId` gonderiliyor, enricher alicinin avatarini dogru resolve eder.

**Test:** E2E — "TIPS_SENT should include recipientUserId but NOT senderUserId (N1/N2)"

---

### BUG-31: TIPS_SENT Router Enrichment Gonderenin Avatarini Override Ediyor — FIXLENDI

**Dosya:** `backend/src/interfaces/notification/notification.router.ts` (TIPS_SENT enrichment blogu)
**Oncelik:** **YUKSEK**

**Problem:**
Notification router'da GET fetch sirasinda yapilan batch enrichment'ta TIPS_SENT branch'i `senderUserId` ile avatar ariyordu. Enricher fix'i (BUG-30) sonrasinda bile, router seviyesinde yanlis avatar resolve ediliyordu.

**Fix:**
Router'da TIPS_SENT enrichment blogu yeniden yazildi: `recipientUserId` ile avatar yukleniyor, `recipientUsername` ekleniyor, `amount` ve `transactionId` alanlari dahil ediliyor.

---

### BUG-32: System Notification'larda Kullanici Avatari Gosteriliyor (N3) — FIXLENDI

**Dosya:** `backend/src/application/transaction/transaction-notification.service.ts`, `backend/src/interfaces/notification/notification.router.ts`
**Oncelik:** **ORTA**

**Problem:**
BOOST_POST, CLAIM_REWARD, SWAP_TIP_TO_SOL, SWAP_SOL_TO_TIP, AIRDROP, CLAIM_BADGE, TRANSACTION_FAILED gibi sistem kaynakli notification'larda karsi taraf kullanici yoktu ama `isSystem` flag'i bulunmuyordu. Frontend avatar resolve edemeyince bos veya yanlis avatar gosteriyordu.

**Fix:**
1. `transaction-notification.service.ts`: Tum sistem kaynakli notification data'larina `isSystem: true` eklendi.
2. `notification.router.ts`: TRANSACTION_CONFIRMED/FAILED/PENDING enrichment blogu `isSystem` flag'ini kontrol ediyor. `isSystem=true` ise `avatar: null` ve `isSystem: true` donuyor (frontend Tipbox logosu gosterecek). Karsi taraf kullanici varsa normal avatar enrichment yapiliyor.

**Test:** E2E — "BOOST_POST notification should have isSystem=true (N3)"

---

### BUG-33: TIPS_SENT Enrichment'ta amount ve transactionId Eksik (N4) — FIXLENDI

**Dosya:** `backend/src/interfaces/notification/notification.router.ts`
**Oncelik:** **DUSUK**

**Problem:**
TIPS_SENT notification router enrichment'inda `amount` ve `transactionId` alanlari cikartilmiyordu. Frontend bu alanlari notification detail sayfasinda gostermek istediginde `undefined` aliyordu.

**Fix:**
Router enrichment'a `enriched.amount = data.amount ? Number(data.amount) : undefined` ve `enriched.transactionId = data.transactionId ?? undefined` eklendi.

---

### BUG-34: TRANSACTION_FAILED Enrichment'ta errorMessage Eksik (N5) — FIXLENDI

**Dosya:** `backend/src/interfaces/notification/notification.router.ts`
**Oncelik:** **DUSUK**

**Problem:**
TRANSACTION_FAILED notification'lari `errorMessage` iceriyordu ama router enrichment'inda bu alan enriched objesine aktarilmiyordu. Frontend hata detayini gosteremiyordu.

**Fix:**
Router enrichment'a `if (data.errorMessage) { enriched.errorMessage = data.errorMessage; }` eklendi.

**Test:** E2E — "TRANSACTION_FAILED should have isSystem=true and errorMessage (N3/N5)"

---

## KALAN POTANSIYEL SORUNLAR (Onerilenler — Henuz Fixlenmedi)

Asagidaki sorunlar kapsamli analizde tespit edildi ancak su anki sprint'te fixlenmedi. Risk seviyeleri ve onerileri:

### HIGH Priority (Yakin Vadede)

| # | Sorun | Risk | Oneri |
|---|-------|------|-------|
| H1 | Wallet address normalization eksik (`findByAddressForTracking`) | Checksummed vs lowercase address eslesmez | `findByAddressForTracking` icinde `toLowerCase()` normalization ekle |
| H2 | `syncWalletBalanceFromChain` pending tx sirasinda override | Balance tutarsizligi | Mevcut guard yeterli (BUG-5'te fixlendi) ama worker'dan sync sonrasi double-check eklenebilir |
| H3 | `setBalance()` negatif deger kabul eder | Negatif balance mumkun | `Math.max(0, balance)` validation ekle |
| H4 | CLAIM_REWARD / BOOST_PROFILE duplicate korumasi yok | Ayni odul 2x claim edilebilir | Idempotency key (rewardId) ile duplicate kontrolu ekle |

### MEDIUM Priority (Orta Vadede)

| # | Sorun | Risk | Oneri |
|---|-------|------|-------|
| M1 | Wallet entity `metadata` field `any` tipi | TypeScript safety | Typed metadata interface olustur |
| M2 | Triple webhook source (thirdweb + contract-event + alchemy) karmasikligi | Maintenance riski | Webhook gateway/router layer ile tek giris noktasi olustur |
| M3 | `updateLockedBalance` TOCTOU race condition | Concurrent lock hatalari | Atomic `incrementLockedBalance` yaz (lockBalance patterni gibi) |
