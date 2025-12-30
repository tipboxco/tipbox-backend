# Feed Trust ve Inventory Test Senaryosu

Bu test, feed akışının trust ve inventory ilişkilerine göre doğru çalışıp çalışmadığını kontrol eder.

## 📋 Test Senaryosu

### Kullanıcılar
- **Ömer** (omer@tipbox.co) - TEST_USER_ID
- **Trust User 1** (trust-user-0@tipbox.co) - TRUST_USER_IDS[0]
- **Julia** (julia.havk@tipbox.co) - JULIA_USER_ID

### İlişkiler
- ✅ **Ömer ↔ Trust User 1**: Mutual trust (birbirlerini trust ediyorlar)
- ✅ **Ömer ve Julia**: Aynı telefona sahip (inventory match)
- ❌ **Julia ve Trust User 1**: Ne trust ne inventory (birbirlerini görmeyecekler)

## 🎯 Beklenen Sonuçlar

1. ✅ **Ömer, Trust User 1'in postunu görmeli** (trust ilişkisi)
   - Source: `TRUSTER` veya `MUTUAL_TRUST`
   - Score: ≥ 30

2. ✅ **Ömer, Julia'nın postunu görmeli** (inventory match)
   - Source: `INVENTORY_MATCH` veya `PRODUCT_GROUP_MATCH`
   - Score: ≥ 15

3. ✅ **Julia, Ömer'in postunu görmeli** (inventory match)
   - Source: `INVENTORY_MATCH` veya `PRODUCT_GROUP_MATCH`
   - Score: ≥ 15

4. ❌ **Julia, Trust User 1'in postunu GÖRMEMELİ** (ne trust ne inventory)
   - Feed kaydı olmamalı VEYA score < 5

5. ❌ **Trust User 1, Julia'nın postunu GÖRMEMELİ** (ne trust ne inventory)
   - Feed kaydı olmamalı VEYA score < 5

## 🚀 Test Çalıştırma

### Önkoşullar

1. **Database seed edilmiş olmalı**:
   ```bash
   npm run db:seed
   ```

2. **Backend server çalışıyor olmalı**:
   ```bash
   npm run dev
   ```

3. **BullMQ Worker çalışıyor olmalı** (feed dağıtımı için):
   ```bash
   npm run worker
   ```

### Test Çalıştırma

```bash
# Feed testlerini çalıştır
npx jest --config tests/jest-config/jest.config.feed.ts

# Veya sadece bu testi çalıştır
npx jest tests/e2e/feed-trust-inventory.test.ts
```

### Test Adımları

Test otomatik olarak şunları yapar:

1. **Setup (beforeAll)**:
   - 3 kullanıcı için auth token alır
   - Trust ilişkilerini kurar (Ömer ↔ Trust User 1)
   - Ortak ürün bulur (iPhone)
   - Ömer ve Julia'nın envanterine ürün ekler
   - Trust User 1'in envanterinden ürünü temizler (eğer varsa)

2. **Test 1**: Trust User 1 post oluşturur → Ömer feed'inde görünmeli
3. **Test 2**: Julia post oluşturur → Ömer feed'inde görünmeli
4. **Test 3**: Ömer post oluşturur → Julia feed'inde görünmeli
5. **Test 4**: Julia post oluşturur → Trust User 1 feed'inde GÖRÜNMEMELİ
6. **Test 5**: Trust User 1 post oluşturur → Julia feed'inde GÖRÜNMEMELİ
7. **Test 6**: Tüm feed ilişkilerini özetler

3. **Cleanup (afterAll)**:
   - Oluşturulan feed kayıtlarını siler
   - Oluşturulan post'ları siler

## ⚠️ Önemli Notlar

### Async Feed Dağıtımı

Feed dağıtımı **async bir BullMQ job** olarak çalışır. Bu nedenle:

- Post oluşturulduktan sonra **5 saniye beklenir** (feed dağıtımı için)
- Eğer test başarısız olursa, worker'ın çalıştığından emin olun
- Redis/BullMQ bağlantısının çalıştığından emin olun

### Feed Score Threshold

- Minimum score: **5 puan**
- Score < 5 olan postlar feed'e eklenmez (cleanup için aday)

### Test Verileri

Test sonrası otomatik temizlik yapılır, ancak eğer test yarıda kesilirse manuel temizlik gerekebilir:

```sql
-- Test post'larını sil
DELETE FROM feeds WHERE post_id IN (
  SELECT id FROM content_posts 
  WHERE body LIKE '%test postu%'
);

DELETE FROM content_posts 
WHERE body LIKE '%test postu%';
```

## 📊 Test Sonuçları

Test başarılı olduğunda şu çıktıyı göreceksiniz:

```
✅ Ömer - User ID: 480f5de9-b691-4d70-a6a8-2789226f4e07
✅ Trust User 1 - User ID: 11111111-1111-4111-a111-111111111111
✅ Julia - User ID: 99999999-9999-4999-9999-999999999999

✅ Ömer → Trust User 1 trust ilişkisi oluşturuldu
✅ Trust User 1 → Ömer trust ilişkisi oluşturuldu (MUTUAL TRUST)
✅ Julia ve Trust User 1 arasında trust ilişkisi yok (beklenen)

✅ Ortak ürün bulundu: iPhone 15 Pro (ID: ...)
✅ Ömer'in envanterine ürün eklendi
✅ Julia'nın envanterine ürün eklendi
✅ Trust User 1'in envanterinde ürün yok (beklenen)

✅ Test 1: Trust User 1 post oluşturdu → Ömer feed'inde göründü
✅ Test 2: Julia post oluşturdu → Ömer feed'inde göründü
✅ Test 3: Ömer post oluşturdu → Julia feed'inde göründü
✅ Test 4: Julia post oluşturdu → Trust User 1 feed'inde YOK
✅ Test 5: Trust User 1 post oluşturdu → Julia feed'inde YOK
```

## 🔍 Debug

Eğer test başarısız olursa:

1. **Feed kayıtlarını kontrol et**:
   ```sql
   SELECT f.*, p.title, p.user_id as post_author_id
   FROM feeds f
   JOIN content_posts p ON f.post_id = p.id
   WHERE p.body LIKE '%test postu%'
   ORDER BY f.created_at DESC;
   ```

2. **Trust ilişkilerini kontrol et**:
   ```sql
   SELECT * FROM trust_relations
   WHERE truster_id IN ('480f5de9-b691-4d70-a6a8-2789226f4e07', '11111111-1111-4111-a111-111111111111', '99999999-9999-4999-9999-999999999999')
      OR trusted_user_id IN ('480f5de9-b691-4d70-a6a8-2789226f4e07', '11111111-1111-4111-a111-111111111111', '99999999-9999-4999-9999-999999999999');
   ```

3. **Inventory kayıtlarını kontrol et**:
   ```sql
   SELECT * FROM inventories
   WHERE user_id IN ('480f5de9-b691-4d70-a6a8-2789226f4e07', '11111111-1111-4111-a111-111111111111', '99999999-9999-4999-9999-999999999999');
   ```

4. **Worker log'larını kontrol et**:
   - Worker console'da feed distribution job'larının işlendiğini kontrol et
   - Redis queue'da bekleyen job'lar var mı kontrol et

## 📝 Test Senaryosu Detayları

### Senaryo 1: Trust İlişkisi
- **Aktör**: Trust User 1
- **Aksiyon**: Post oluşturur
- **Beklenen**: Ömer'in feed'inde görünür (trust score: 35-40)

### Senaryo 2: Inventory Match (Ömer → Julia)
- **Aktör**: Julia
- **Aksiyon**: Aynı ürünle post oluşturur
- **Beklenen**: Ömer'in feed'inde görünür (inventory score: 30)

### Senaryo 3: Inventory Match (Julia → Ömer)
- **Aktör**: Ömer
- **Aksiyon**: Aynı ürünle post oluşturur
- **Beklenen**: Julia'nın feed'inde görünür (inventory score: 30)

### Senaryo 4: Negatif Test (Julia → Trust User 1)
- **Aktör**: Julia
- **Aksiyon**: Post oluşturur
- **Beklenen**: Trust User 1'in feed'inde GÖRÜNMEZ (score < 5 veya feed yok)

### Senaryo 5: Negatif Test (Trust User 1 → Julia)
- **Aktör**: Trust User 1
- **Aksiyon**: Post oluşturur
- **Beklenen**: Julia'nın feed'inde GÖRÜNMEZ (score < 5 veya feed yok)

