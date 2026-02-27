# Docker Compose Hata Analizi

Bu doküman `docker-compose up` çıktısından tespit edilen hatalar ve yapılan düzeltmeleri özetler.

---

## 1. Kritik Hatalar (Düzeltildi)

### 1.1 catalog-service: `pnpm: not found` (exit code 127)

**Belirti:** Container sürekli yeniden başlıyor.
```
/server/start.sh: line 45: pnpm: not found
tipbox_catalog_service exited with code 127 (restarting)
```

**Sebep:** `start.sh` pnpm kullanacak şekilde güncellenmişti ancak catalog-service Docker imajında pnpm kurulu değildi (sadece npm vardı).

**Düzeltme:**
- `catalog-service/Dockerfile` içine `corepack enable` ve `pnpm@9.15.0` eklendi.
- Bağımlılık kurulumu `npm install` → `pnpm install --legacy-peer-deps` olarak değiştirildi.

---

### 1.2 MedusaError: User root@tipbox.co already exists

**Belirti:** Her başlangıçta hata loglanıyor (servisi durdurmuyor ama log kirliliği).
```
MedusaError: User with email: root@tipbox.co, already exists.
```

**Sebep:** `start.sh` her çalıştığında `npx medusa user -e root@tipbox.co -p root@tipbox.co` ile kullanıcı oluşturmaya çalışıyor; kullanıcı zaten varsa Medusa hata fırlatıyor.

**Düzeltme:** Komut idempotent yapıldı: `2>/dev/null || true` ile hata yutuluyor, kullanıcı zaten varsa script devam ediyor.

---

### 1.3 Backend: SocketHandler not initialized

**Belirti:** Worker job işlerken hata.
```
Error in autoCompleteAwaitingRequests: SocketHandler not initialized. Call initialize() first.
```

**Sebep:** `SupportRequestAutoCompleteWorker` bazen HTTP server (ve dolayısıyla SocketManager.initialize()) çalışmadan önce job işliyor; `getSocketHandler()` çağrısı bu yüzden exception atıyordu.

**Düzeltme:** `support-request.service.ts` içinde `autoCompleteAwaitingRequests`:
- `getSocketHandler()` try/catch ile sarıldı, hazır değilse `socketHandler = null` atanıyor.
- Socket bildirimi sadece `socketHandler` varsa gönderiliyor; yoksa sadece DB güncellemesi yapılıyor.

---

## 2. Uyarılar (Bilgi Amaçlı)

### 2.1 PostgreSQL: collation version uyarısı

**Metin:** `database "tipbox_dev" / "medusa-store" has no actual collation version, but a version was recorded`

**Açıklama:** Alpine/PostgreSQL sürüm farkı veya locale ile ilgili bilgilendirme. İşlevselliği bozmaz; isterseniz ileride DB locale/collation ayarlarıyla azaltılabilir.

---

### 2.2 Prisma: package.json#prisma deprecated

**Metin:** `The configuration property package.json#prisma is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., prisma.config.ts).`

**Açıklama:** Prisma 7’de konfigürasyon `prisma.config.ts` gibi bir dosyaya taşınacak. Şu an için davranış aynı, ileride geçiş yapılabilir.

---

### 2.3 Catalog-service: Local Event Bus / in-memory locking

**Metin:**
- `Local Event Bus installed. This is not recommended for production.`
- `Locking module: Using "in-memory" as default.`

**Açıklama:** Geliştirme ortamında normal; production’da Redis (veya uygun bir event bus/locking backend) kullanılması önerilir.

---

### 2.4 PowerShell: docker-compose stderr

**Belirti:** `docker-compose up` sırasında PowerShell’de “NativeCommandError” benzeri bir hata görünebilir.

**Sebep:** Docker Compose bazı bilgi mesajlarını (ör. “Network Creating”) stderr’e yazıyor; PowerShell bunu hata gibi gösteriyor.

**Düzeltme:** Gerçek bir hata değil; görmezden gelinebilir veya `docker-compose up 2>&1` ile stdout’a yönlendirilebilir.

---

## 3. Özet

| Konu                         | Öncelik   | Durum   | Dosya / Not                          |
|-----------------------------|-----------|---------|--------------------------------------|
| catalog-service pnpm yok    | Kritik    | Düzeltildi | `catalog-service/Dockerfile`         |
| Medusa user already exists  | Orta      | Düzeltildi | `catalog-service/start.sh`           |
| SocketHandler not initialized | Kritik  | Düzeltildi | `backend/.../support-request.service.ts` |
| PostgreSQL collation        | Bilgi     | Dokümante | -                                    |
| Prisma deprecation          | Bilgi     | Dokümante | -                                    |
| Event Bus / Locking         | Bilgi     | Dokümante | Production’da Redis kullanın         |

---

**Son güncelleme:** docker-compose up loglarına göre analiz; yukarıdaki kod değişiklikleri uygulandı.
