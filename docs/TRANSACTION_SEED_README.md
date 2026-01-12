# Transaction & Wallet Seed Sistemi - Hızlı Başlangıç

## 🎯 Amaç

Yeni geliştirilen wallet ve transaction endpoint'lerini test etmek için gerçekçi test verileri oluşturmak.

## 📦 Neler Oluşturuldu?

### 1. Seed Dosyaları
- **`prisma/seed/transaction-seed.ts`** - Transaction ve wallet seed fonksiyonları
- **`scripts/test-transaction-seed.ts`** - Test scripti

### 2. Dokümantasyon
- **`docs/TRANSACTION_SEED_GUIDE.md`** - Detaylı kullanım kılavuzu

## 🚀 Hızlı Kullanım

### Adım 1: Database'i Hazırla

```bash
# Docker container'ları başlat
docker-compose up -d

# Migrations'ları çalıştır
npm run prisma:migrate
```

### Adım 2: Seed Verilerini Oluştur

**Seçenek A: Tüm seed verilerini oluştur (önerilen)**
```bash
npm run prisma:seed
```
Bu komut:
- Kullanıcılar, ürünler, postlar, badge'ler, NFT'ler vb. oluşturur
- **En sonda** transaction ve wallet verilerini oluşturur

**Seçenek B: Sadece transaction verilerini oluştur**
```bash
npx ts-node scripts/test-transaction-seed.ts
```
⚠️ Not: Bu seçenek için önce kullanıcıların, badge'lerin ve NFT'lerin olması gerekir.

### Adım 3: Test Et

**API endpoint'lerini test et:**

1. **Wallet bilgisi:**
```bash
curl http://localhost:5001/wallets/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. **Bakiye sorgula:**
```bash
curl http://localhost:5001/wallets/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Transaction geçmişi:**
```bash
curl http://localhost:5001/wallets/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **TIPS gönder:**
```bash
curl -X POST http://localhost:5001/wallets/send-tips \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "recipient_user_id",
    "amount": 50,
    "reason": "Test transfer"
  }'
```

## 📊 Oluşturulan Veriler

### Transaction Tipleri:
- ✅ `AIRDROP` - Başlangıç bakiyesi (1000-5000 TIPS)
- ✅ `TIP_SEND` / `TIP_RECEIVE` - TIPS transferleri (25-500 TIPS)
- ✅ `CLAIM_REWARD` - Ödül toplama (250-500 TIPS)
- ✅ `CLAIM_BADGE` - Badge toplama (50-250 TIPS)
- ✅ `NFT_BUY` / `NFT_SELL` - NFT alım/satım (500-1500 TIPS)
- ✅ `PENDING` - Bekleyen transaction'lar
- ✅ `FAILED` - Başarısız transaction'lar

### İstatistikler (20 kullanıcı için):
- **Wallet:** ~20 wallet
- **Transaction:** ~82 transaction
- **Zaman aralığı:** Son 30 gün
- **Transaction durumları:** PENDING, CONFIRMED, FAILED

## 🧪 Test Scripti Çıktısı

Test scriptini çalıştırdığınızda şöyle bir çıktı görürsünüz:

```
🧪 Testing Transaction Seed Functions...

1️⃣ Kullanıcı sayısını kontrol ediyorum...
   ✅ 20 kullanıcı bulundu

2️⃣ Mevcut wallet sayısını kontrol ediyorum...
   📊 Mevcut wallet sayısı: 0

3️⃣ Mevcut transaction sayısını kontrol ediyorum...
   📊 Mevcut transaction sayısı: 0

4️⃣ Transaction seed fonksiyonunu çalıştırıyorum...

Creating wallets for users...
Wallet created for user abc-123: wallet-456
...

✅ Transaction Seed Tamamlandı!

═════════════════════════════════════════
📊 SEED SONUÇLARI
═════════════════════════════════════════
Oluşturulan Wallet Sayısı: 20
Oluşturulan Transaction Sayısı: 82

📈 Transaction Tipleri:
   AIRDROP: 20
   TIP_SEND: 12
   TIP_RECEIVE: 12
   CLAIM_REWARD: 20
   CLAIM_BADGE: 8
   NFT_BUY: 3
   NFT_SELL: 3
   PENDING: 2
   FAILED: 2

📊 Transaction Durumları:
   CONFIRMED: 78
   PENDING: 2
   FAILED: 2
═════════════════════════════════════════

5️⃣ Yeni durum kontrolü...
   📊 Toplam wallet sayısı: 20 (önceki: 0)
   📊 Toplam transaction sayısı: 82 (önceki: 0)

6️⃣ Örnek transaction'lar...

   1. TIP_RECEIVE - 100 TIPS - CONFIRMED
      Kullanıcı: John Doe
      Tarih: 2026-01-12T10:30:00.000Z
      Meta: {"reason":"Great advice, thanks!"}

   ...

7️⃣ Örnek wallet bakiyeleri (hesaplanan)...

   👤 John Doe
      Bakiye: 2850.00 TIPS
      Transaction Sayısı: 5

   ...

🎉 Test başarıyla tamamlandı!
```

## 📚 Detaylı Dokümantasyon

Daha fazla bilgi için:
- **[Transaction Seed Guide](./docs/TRANSACTION_SEED_GUIDE.md)** - Detaylı kullanım ve özelleştirme kılavuzu
- **[Wallet Implementation Report](./docs/WALLET_IMPLEMENTATION_REPORT.md)** - Wallet sistemi dokümantasyonu

## ❓ Sık Karşılaşılan Sorunlar

### "Not enough users to seed transactions"
```bash
# Önce ana seed'i çalıştırın
npm run prisma:seed
```

### "Database not reachable"
```bash
# Docker container'ları başlatın
docker-compose up -d
```

### Transaction sayısı beklenenden az
- Badge'ler veya NFT'ler eksik olabilir
- Ana seed'i önce çalıştırdığınızdan emin olun

## 🎯 Sonraki Adımlar

1. ✅ Seed verilerini oluştur
2. ✅ API endpoint'lerini test et
3. ✅ Frontend entegrasyonunu başlat
4. ⏳ Web3 blockchain entegrasyonu

---

**Not:** Bu sistem test ve geliştirme amaçlıdır. Production'da gerçek blockchain entegrasyonu kullanılacaktır.

