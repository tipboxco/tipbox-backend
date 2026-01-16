# Event Badge Descriptions - API Kullanımı

## 🎯 Badge Description'ları Nasıl Alınır?

Badge description'ları, kullanıcıya rozetin nasıl kazanıldığını ve ne anlama geldiğini açıklayan metinlerdir. Bu bilgiler API üzerinden farklı endpoint'lerden alınabilir.

---

## 📡 API Endpoint'leri

### 1. Event Progress Endpoint (Önerilen)

Badge description'ları ile birlikte kullanıcının ilerleme durumunu gösterir.

**Endpoint:**
```
GET /api/v1/events/{eventId}/progress
```

**Response:**
```json
{
  "userId": "user-uuid",
  "eventId": "00MKFPNIQ30000064YDGL62K7Q",
  "metrics": {
    "postsCount": 2,
    "likesReceived": 1
  },
  "badges": [
    {
      "badgeId": "badge-uuid-1",
      "badgeName": "[Event] İlk Adım",
      "badgeDescription": "Event süresince ilk postunu paylaşarak bu rozeti kazandın! 🎉 Event'e katılımını gösterdiğin için teşekkürler. Devam et, daha fazla rozet seni bekliyor!",
      "rarity": "COMMON",
      "requirement": {
        "type": "POSTS_COUNT",
        "threshold": 1
      },
      "currentProgress": 2,
      "isEarned": true,
      "progressPercentage": 100
    },
    {
      "badgeId": "badge-uuid-2",
      "badgeName": "[Event] Aktif Katılımcı",
      "badgeDescription": "Event'te toplam 3 post paylaştın! 🔥 İçerik üretmeye devam ediyorsun. Topluluğa katkıların için teşekkürler. Bir sonraki seviyeye ulaşmak için 2 post daha paylaş!",
      "rarity": "RARE",
      "requirement": {
        "type": "POSTS_COUNT",
        "threshold": 3
      },
      "currentProgress": 2,
      "isEarned": false,
      "progressPercentage": 66
    }
  ]
}
```

**Kullanım:**
- Kullanıcıya badge kartı gösterirken `badgeDescription` alanını kullan
- `isEarned: true` ise kazanılmış badge'i göster
- `isEarned: false` ise ilerleyen badge'i göster
- `progressPercentage` ile progress bar gösterilebilir

---

### 2. User Badge Endpoint

Kullanıcının kazandığı tüm badge'leri gösterir.

**Endpoint:**
```
GET /api/v1/gamification/badges/user/{userId}
```

**Response:**
```json
{
  "badges": [
    {
      "id": "user-badge-uuid",
      "badgeId": "badge-uuid",
      "badgeName": "[Event] İlk Adım",
      "badgeDescription": "Event süresince ilk postunu paylaşarak bu rozeti kazandın! 🎉 Event'e katılımını gösterdiğin için teşekkürler. Devam et, daha fazla rozet seni bekliyor!",
      "rarity": "COMMON",
      "imageUrl": null,
      "claimed": false,
      "claimedAt": null,
      "earnedAt": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 3. Badge Detail Endpoint

Belirli bir badge'in detaylarını gösterir.

**Endpoint:**
```
GET /api/v1/gamification/badges/{badgeId}
```

**Response:**
```json
{
  "id": "badge-uuid",
  "name": "[Event] İlk Adım",
  "description": "Event süresince ilk postunu paylaşarak bu rozeti kazandın! 🎉 Event'e katılımını gösterdiğin için teşekkürler. Devam et, daha fazla rozet seni bekliyor!",
  "type": "EVENT",
  "rarity": "COMMON",
  "imageUrl": null,
  "boostMultiplier": null,
  "rewardMultiplier": null,
  "category": {
    "id": "category-uuid",
    "name": "Event Rozetleri",
    "description": "Event katılımı ve başarıları için verilen rozetler"
  }
}
```

---

## 🎨 Frontend'de Kullanım Örnekleri

### Badge Kartı Komponenti

```tsx
interface BadgeCardProps {
  badge: {
    badgeName: string;
    badgeDescription: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC';
    isEarned: boolean;
    progressPercentage: number;
  };
}

function BadgeCard({ badge }: BadgeCardProps) {
  return (
    <div className={`badge-card ${badge.isEarned ? 'earned' : 'locked'}`}>
      {/* Badge Icon */}
      <div className="badge-icon">
        {badge.isEarned ? '🏆' : '🔒'}
      </div>
      
      {/* Badge Name */}
      <h3 className="badge-name">{badge.badgeName}</h3>
      
      {/* Badge Description */}
      <p className="badge-description">
        {badge.badgeDescription}
      </p>
      
      {/* Progress Bar (if not earned) */}
      {!badge.isEarned && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${badge.progressPercentage}%` }}
          />
          <span>{badge.progressPercentage}%</span>
        </div>
      )}
      
      {/* Rarity Badge */}
      <span className={`rarity ${badge.rarity.toLowerCase()}`}>
        {badge.rarity}
      </span>
    </div>
  );
}
```

### Event Progress Sayfası

```tsx
function EventProgressPage({ eventId }: { eventId: string }) {
  const [progress, setProgress] = useState(null);
  
  useEffect(() => {
    fetch(`/api/v1/events/${eventId}/progress`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setProgress(data));
  }, [eventId]);
  
  if (!progress) return <Loading />;
  
  return (
    <div className="event-progress">
      <h2>Event İlerlemeniz</h2>
      
      {/* Metrics */}
      <div className="metrics">
        <div>Posts: {progress.metrics.postsCount}</div>
        <div>Likes: {progress.metrics.likesReceived}</div>
      </div>
      
      {/* Badges */}
      <div className="badges-grid">
        {progress.badges.map(badge => (
          <BadgeCard key={badge.badgeId} badge={badge} />
        ))}
      </div>
    </div>
  );
}
```

---

## 📝 Badge Description Formatı

Her badge description'ı şu yapıyı takip eder:

### Yapı:
```
[Başarı Mesajı] + [Emoji] + [Açıklama] + [Motivasyon/Sonraki Adım]
```

### Örnekler:

**İlk Adım (Kazanılma: 1 post)**
```
Event süresince ilk postunu paylaşarak bu rozeti kazandın! 🎉 
Event'e katılımını gösterdiğin için teşekkürler. 
Devam et, daha fazla rozet seni bekliyor!
```

**Aktif Katılımcı (Kazanılma: 3 post)**
```
Event'te toplam 3 post paylaştın! 🔥 
İçerik üretmeye devam ediyorsun. 
Topluluğa katkıların için teşekkürler. 
Bir sonraki seviyeye ulaşmak için 2 post daha paylaş!
```

**İçerik Ustası (Kazanılma: 5 post)**
```
Event'te toplam 5 post paylaştın! ⭐ 
Harika bir içerik üreticisisin! 
Event boyunca düzenli ve kaliteli paylaşımların topluluğa değer katıyor. 
Bu başarı için tebrikler!
```

---

## 🎯 Badge Description'ları Güncelleme

Badge description'larını güncellemek için:

```bash
# Script'i çalıştır
docker exec tipbox_backend npx ts-node scripts/update-badge-descriptions.ts
```

Script dosyası: `scripts/update-badge-descriptions.ts`

---

## 🔍 Database'den Doğrudan Sorgulama

### Tüm Badge'leri Listele:
```sql
SELECT 
  b.id,
  b.name,
  b.description,
  b.type,
  b.rarity,
  bc.name as category_name
FROM badges b
LEFT JOIN badge_categories bc ON b.category_id = bc.id
WHERE b.type = 'EVENT'
ORDER BY b.name;
```

### Belirli Badge'in Description'ını Güncelle:
```sql
UPDATE badges 
SET description = 'Yeni description metni'
WHERE name = '[Event] İlk Adım';
```

---

## 📊 Tüm Event Badge'leri ve Description'ları

| Badge | Threshold | Description |
|-------|-----------|-------------|
| **[Event] İlk Adım** | 1 post | Event süresince ilk postunu paylaşarak bu rozeti kazandın! 🎉 Event'e katılımını gösterdiğin için teşekkürler. Devam et, daha fazla rozet seni bekliyor! |
| **[Event] Aktif Katılımcı** | 3 post | Event'te toplam 3 post paylaştın! 🔥 İçerik üretmeye devam ediyorsun. Topluluğa katkıların için teşekkürler. Bir sonraki seviyeye ulaşmak için 2 post daha paylaş! |
| **[Event] İçerik Ustası** | 5 post | Event'te toplam 5 post paylaştın! ⭐ Harika bir içerik üreticisisin! Event boyunca düzenli ve kaliteli paylaşımların topluluğa değer katıyor. Bu başarı için tebrikler! |
| **[Event] İlk Beğeni** | 1 like | Event'te paylaştığın bir içerik ilk beğenisini aldı! 👍 Başkaları senin paylaşımlarını değerli buluyor. Devam et, daha fazla beğeni kazanabilirsin! |
| **[Event] Popüler** | 3 likes | Event'te paylaştığın içerikler toplam 3 beğeni aldı! 🌟 İçerikleriniz diğer kullanıcılar tarafından beğeniliyor. Kaliteli paylaşımlarına devam et! |
| **[Event] Viral Oldu** | 5 likes | Event'te paylaştığın içerikler toplam 5 beğeni aldı! 💫 Tam bir içerik yıldızısın! Paylaşımların toplulukta yankı buluyor ve ilham veriyor. Muhteşem bir başarı! |

---

## 🚀 Best Practices

1. **Her zaman `badgeDescription` kullan**: Badge kartlarında açıklama göster
2. **Emoji kullan**: Description'lar emoji ile daha çekici
3. **Progress göster**: Kazanılmamış badge'ler için ilerleme çubuğu ekle
4. **Motivasyon ver**: Description'da bir sonraki hedefe teşvik et
5. **Context ekle**: Kullanıcıya badge'in ne anlama geldiğini açıkla

---

## 📚 İlgili Dosyalar

- **Script:** `scripts/update-badge-descriptions.ts`
- **Config:** `src/config/event-badges.config.ts`
- **Service:** `src/application/event/event.service.ts` (getUserEventProgress)
- **Router:** `src/interfaces/event/event.router.ts`

---

## ✅ Özet

Badge description'ları:
- ✅ Database'de `badges.description` alanında saklanır
- ✅ API response'larında `badgeDescription` olarak döner
- ✅ Event progress endpoint'i ile kullanıcı ilerlemesi ile birlikte gelir
- ✅ Frontend'de badge kartları ve progress sayfalarında kullanılır
- ✅ Script ile toplu güncellenebilir

Sistem hazır! 🎉
