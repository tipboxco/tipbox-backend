# Bugün Yapılan Değişiklikler - Changelog

**Tarih:** 2025-01-XX  
**Amaç:** DMMessage modelinde messageType enum değerlerini güncelleme ve support request endpoint'lerinde status field'ının response'a eklenmesi

---

## 📋 Özet

Bugün yapılan değişiklikler, mesajlaşma sistemindeki `messageType` alanının enum değerlerini güncellemek ve support request endpoint'lerinin response'larına `status` field'ını eklemek üzerine odaklanmıştır.

---

## 🔧 Yapılan Değişiklikler

### 1. **Prisma Schema (Veritabanı Katmanı)**

**Dosya:** `prisma/schema.prisma`

**Değişiklikler:**
- `DMMessageType` enum değerleri güncellendi:
  - `TEXT` → `MESSAGE` olarak değiştirildi
  - `SUPPORT_REQUEST` → aynı kaldı
  - `TIPS` → aynı kaldı (ancak kod içinde `SEND_TIPS` olarak kullanılıyor)

**Satırlar:** 1220-1224

```prisma
enum DMMessageType {
    MESSAGE
  SUPPORT_REQUEST
  TIPS
}
```

**Amaç:** 
- Veritabanı şemasında mesaj tiplerini daha açıklayıcı hale getirmek
- Enum değerlerini domain katmanındaki kullanımla uyumlu hale getirmek

**Not:** Schema'da `TIPS` olarak kaldı ancak kod içinde `SEND_TIPS` olarak kullanılıyor. Bu bir tutarsızlık olabilir.

---

### 2. **Application Layer - Messaging Service**

**Dosya:** `src/application/messaging/messaging.service.ts`

**Değişiklikler:**

#### a) `mapEventTypeToDbMessageType` Metodu Eklendi/Güncellendi

**Satırlar:** 118-127

```typescript
private mapEventTypeToDbMessageType(eventType: MessageEventType): 'MESSAGE' | 'SUPPORT_REQUEST' | 'TIPS' {
  switch (eventType) {
    case 'support-request':
      return 'SUPPORT_REQUEST';
    case 'send-tips':
      return 'TIPS';
    default:
      return 'MESSAGE';
  }
}
```

**Amaç:**
- Socket event tiplerini (`MessageEventType`) Prisma enum değerlerine (`DMMessageType`) dönüştürmek
- `sendDirectMessage` metodunda kullanılmak üzere mapping sağlamak

**Kullanım Yeri:**
- `sendDirectMessage` metodunda (satır 74) mesaj oluşturulurken `messageType` field'ına değer atanırken kullanılıyor

---

### 3. **Infrastructure Layer - Repository**

**Dosya:** `src/infrastructure/repositories/dm-message-prisma.repository.ts`

**Değişiklikler:**

#### a) `create` Metodunda MessageType Mapping

**Satırlar:** 54-59

```typescript
const messageTypeValue =
  data.messageType === 'support-request'
    ? DMMessageType.SUPPORT_REQUEST
    : data.messageType === 'send-tips'
    ? DMMessageType.TIPS
    : DMMessageType.TEXT;  // ⚠️ NOT: Schema'da MESSAGE olarak değiştirildi ama burada hala TEXT kullanılıyor
```

**Amaç:**
- Domain entity'den gelen string değerleri Prisma enum değerlerine dönüştürmek
- Veritabanına kayıt yaparken doğru enum değerini kullanmak

**Not:** Burada `DMMessageType.TEXT` kullanılıyor ancak schema'da `MESSAGE` olarak değiştirildi. Bu bir tutarsızlık olabilir ve düzeltilmesi gerekebilir.

#### b) `toDomain` Metodunda MessageType Mapping

**Satırlar:** 213-229

```typescript
private toDomain(prismaMessage: any): DMMessage {
  return new DMMessage(
    prismaMessage.id,
    prismaMessage.threadId,
    prismaMessage.senderId,
    prismaMessage.message,
    prismaMessage.messageType === DMMessageType.SUPPORT_REQUEST
      ? 'support-request'
      : prismaMessage.messageType === DMMessageType.TIPS
      ? 'send-tips'
      : 'message',
    prismaMessage.sentAt,
    prismaMessage.isRead,
    prismaMessage.createdAt,
    prismaMessage.updatedAt
  );
}
```

**Amaç:**
- Prisma'dan gelen enum değerlerini domain entity'nin beklediği string formatına dönüştürmek
- Domain katmanı ile veritabanı katmanı arasında veri dönüşümü sağlamak

---

### 4. **Application Layer - Support Request Service**

**Dosya:** `src/application/messaging/support-request.service.ts`

**Değişiklikler:**

#### a) `getUserSupportRequests` Metodunda Status Field Eklendi

**Satırlar:** 92-99

```typescript
supportRequests.push({
  id: request.id,
  userName,
  userTitle,
  userAvatar,
  requestDescription: request.description,
  status: supportStatus,  // ✅ Bu field bugün eklendi
});
```

**Amaç:**
- Support request listesi response'larına `status` field'ını eklemek
- Frontend'in support request'lerin durumunu (active, pending, completed) görebilmesini sağlamak

#### b) Status Mapping Mantığı Güncellendi

**Satırlar:** 67-76

**Önceki Durum:**
- Status mapping'i eksikti veya yanlıştı

**Yeni Durum:**
```typescript
// Determine support request status
let supportStatus: SupportRequestStatus;

if (request.status === DMRequestStatus.PENDING) {
  supportStatus = SupportRequestStatus.PENDING;
} else if (request.status === DMRequestStatus.ACCEPTED) {
  supportStatus = SupportRequestStatus.ACCEPTED;
} else {
  supportStatus = SupportRequestStatus.REJECTED;
}
```

**Amaç:**
- `DMRequestStatus` (veritabanı seviyesi) ile `SupportRequestStatus` (domain seviyesi) arasında doğru mapping sağlamak
- Support request'lerin durumunu doğru şekilde belirlemek

**Not:** Test dosyasında `ACTIVE`, `PENDING`, `COMPLETED` status'leri bekleniyor ancak kodda `ACCEPTED` ve `REJECTED` kullanılıyor. Bu bir tutarsızlık olabilir.

---

### 5. **Test Dosyası**

**Dosya:** `tests/e2e/inbox.test.ts`

**Değişiklikler:**

#### a) Support Request Response Structure Testi Güncellendi

**Satırlar:** 114-134

```typescript
it('should return support requests with correct structure', async () => {
  // ...
  expect(supportRequest).toHaveProperty('status');  // ✅ Bu assertion bugün eklendi
  expect(typeof supportRequest.status).toBe('string');
  expect(['active', 'pending', 'completed']).toContain(supportRequest.status);
});
```

**Amaç:**
- Support request response'larında `status` field'ının varlığını doğrulamak
- Status değerlerinin beklenen değerler arasında olduğunu kontrol etmek

#### b) Status Filter Testleri

**Satırlar:** 136-179

- `should filter by status=active` testi
- `should filter by status=pending` testi  
- `should filter by status=completed` testi

**Amaç:**
- Support request endpoint'inin status parametresine göre filtreleme yapabildiğini doğrulamak

---

## 🏗️ Mimari Katmanlar

### Değişikliklerin Dağılımı:

1. **Domain Layer** (Değişiklik yok)
   - Domain entity'ler aynı kaldı

2. **Application Layer** (2 dosya)
   - `messaging.service.ts`: MessageType mapping metodu eklendi
   - `support-request.service.ts`: Status field response'a eklendi

3. **Infrastructure Layer** (1 dosya)
   - `dm-message-prisma.repository.ts`: MessageType mapping güncellendi

4. **Database Layer** (1 dosya)
   - `schema.prisma`: DMMessageType enum güncellendi

5. **Test Layer** (1 dosya)
   - `inbox.test.ts`: Status field testleri eklendi

---

## ⚠️ Bilinen Sorunlar ve Notlar

### 1. Enum Tutarsızlığı
- **Schema'da:** `DMMessageType` enum'unda `MESSAGE`, `SUPPORT_REQUEST`, `TIPS` var
- **Repository'de:** `DMMessageType.TEXT` kullanılıyor (satır 59) - Bu hata olabilir
- **Çözüm:** Repository'deki `DMMessageType.TEXT` → `DMMessageType.MESSAGE` olarak değiştirilmeli

### 2. Status Enum Tutarsızlığı
- **Test'te beklenen:** `active`, `pending`, `completed`
- **Kodda kullanılan:** `ACCEPTED`, `PENDING`, `REJECTED`
- **Çözüm:** Status mapping mantığının test beklentileriyle uyumlu hale getirilmesi gerekiyor

### 3. TIPS vs SEND_TIPS
- **Schema'da:** `TIPS`
- **Domain'de:** `send-tips` (string)
- **Mapping'de:** `TIPS` enum değeri kullanılıyor
- **Not:** Bu tutarlı görünüyor ancak isimlendirme farklılığı var

---

## 🔄 Veritabanı Migrasyonu

**Komut:** `npx prisma db push`

**Yapılan İşlemler:**
- `DMMessageType` enum'undaki `TEXT` değeri `MESSAGE` olarak değiştirildi
- Mevcut verilerde `TEXT` değerine sahip kayıtlar `MESSAGE` olarak güncellenmeli (otomatik olmayabilir)

**Not:** Production'da migration yapılırken mevcut `TEXT` değerlerine sahip kayıtların manuel olarak `MESSAGE`'a güncellenmesi gerekebilir.

---

## 📝 Test Sonuçları

**Test Komutu:** `npm run test:inbox`

**Son Durum:**
- ✅ GET /messages endpoint testleri: **BAŞARILI** (5/5 test geçti)
- ⚠️ GET /messages/support-requests endpoint testleri: **KISMI BAŞARILI** (3 test başarısız)
  - Status field'ı response'da eksik görünüyor
  - Status mapping'i düzeltilmesi gerekiyor

---

## 🎯 Sonraki Adımlar

1. **Repository'deki `DMMessageType.TEXT` → `DMMessageType.MESSAGE` düzeltmesi**
2. **Support Request Service'deki status mapping'inin test beklentileriyle uyumlu hale getirilmesi**
3. **Tüm testlerin geçmesinin sağlanması**
4. **Production migration planının hazırlanması** (mevcut TEXT değerlerinin MESSAGE'a güncellenmesi)

---

## 📚 İlgili Dosyalar

- `prisma/schema.prisma` - Veritabanı şeması
- `src/application/messaging/messaging.service.ts` - Mesajlaşma servisi
- `src/application/messaging/support-request.service.ts` - Support request servisi
- `src/infrastructure/repositories/dm-message-prisma.repository.ts` - Mesaj repository
- `tests/e2e/inbox.test.ts` - E2E testleri

---

**Not:** Bu dokümantasyon, bugün yapılan değişikliklerin kayıt altına alınması için oluşturulmuştur. Git restore işlemi yapıldığında bu bilgiler referans olarak kullanılabilir.


