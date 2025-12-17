# MinIO Bucket Yapısı - PostMedia için Öneriler

## 📋 Mevcut Durum

### Şu Anki Bucket Yapısı

```
tipbox-media/
├── profile-pictures/
│   └── {userId}/
│       └── {uuid}.{ext}
├── profile-banners/
│   └── {userId}/
│       └── {uuid}.{ext}
├── posts/
│   └── {userId}/
│       └── {timestamp}-{filename}
├── catalog-images/
│   └── {entityType}/
│       └── {entityId}/
│           └── {filename}
├── products/
│   └── {category}/
│       └── {productName}.{ext}
└── inventory-media/  (mevcut değil, ama görseller buraya yazılıyor)
    └── {userId}/
        └── {productId}/
            └── {uuid}.{ext}
```

## 🎯 PostMedia için Önerilen Yapı

### Seçenek 1: `post-media/` (Önerilen)

```
tipbox-media/
├── post-media/
│   └── {userId}/
│       └── {postId}/
│           └── {uuid}.{ext}
```

**Avantajları:**
- ✅ Post görsellerini net bir şekilde ayırt eder
- ✅ Inventory görsellerinden ayrı
- ✅ Kullanıcı bazlı organizasyon
- ✅ Post bazlı organizasyon
- ✅ Kolay temizleme (post silindiğinde klasörü silebilirsiniz)

**Örnek:**
```
tipbox-media/post-media/480f5de9-b691-4d70-a6a8-2789226f4e07/01ARZ3NDEKTSV4RRFFQ69G5FAV/image-1.jpg
tipbox-media/post-media/480f5de9-b691-4d70-a6a8-2789226f4e07/01ARZ3NDEKTSV4RRFFQ69G5FAV/image-2.jpg
```

### Seçenek 2: `post-media/` (Daha Basit)

```
tipbox-media/
├── post-media/
│   └── {postId}/
│       └── {uuid}.{ext}
```

**Avantajları:**
- ✅ Daha basit yapı
- ✅ Post bazlı organizasyon
- ✅ userId zaten PostMedia tablosunda var

**Örnek:**
```
tipbox-media/post-media/01ARZ3NDEKTSV4RRFFQ69G5FAV/image-1.jpg
tipbox-media/post-media/01ARZ3NDEKTSV4RRFFQ69G5FAV/image-2.jpg
```

## 📊 Karşılaştırma

| Özellik | Seçenek 1 (userId/postId) | Seçenek 2 (postId) |
|---------|---------------------------|---------------------|
| Organizasyon | Daha iyi (kullanıcı bazlı) | Basit |
| Temizleme | Kolay (kullanıcı klasörü) | Kolay (post klasörü) |
| Performans | Aynı | Aynı |
| Disk kullanımı | Biraz daha fazla | Daha az |
| Önerilen | ✅ Evet | ⚠️ Alternatif |

## ✅ Önerilen: Seçenek 1

**Neden:**
1. **Kullanıcı bazlı organizasyon**: Kullanıcının tüm post görsellerini görmek kolay
2. **Disk temizleme**: Kullanıcı silindiğinde tüm klasörü silebilirsiniz
3. **Analytics**: Kullanıcı bazlı disk kullanımını hesaplamak kolay
4. **Güvenlik**: Kullanıcı bazlı erişim kontrolü yapılabilir

## 🔧 Implementasyon

### Post Görseli Yükleme

```typescript
// Post oluşturulurken
async function uploadPostImage(
  userId: string,
  postId: string,
  file: Express.Multer.File,
  index: number
): Promise<string> {
  const s3Service = new S3Service();
  
  // Dosya extension'ı al
  const ext = file.originalname.split('.').pop() || 'jpg';
  const uuid = uuidv4();
  
  // Object key: post-media/{userId}/{postId}/{uuid}.{ext}
  const objectKey = `post-media/${userId}/${postId}/${uuid}.${ext}`;
  
  // MinIO'ya yükle
  const url = await s3Service.uploadFile(objectKey, file.buffer, file.mimetype);
  
  return url;
}
```

### Post Silindiğinde Temizleme

```typescript
// Post silindiğinde görselleri de sil
async function deletePostMedia(postId: string, userId: string): Promise<void> {
  const s3Service = new S3Service();
  
  // PostMedia'dan görselleri al
  const media = await prisma.postMedia.findMany({
    where: { postId },
  });
  
  // Her görseli MinIO'dan sil
  for (const m of media) {
    // URL'den object key'i çıkar
    const objectKey = m.mediaUrl.split('/').slice(-3).join('/'); // post-media/{userId}/{postId}/...
    await s3Service.deleteFile(objectKey);
  }
  
  // PostMedia kayıtlarını sil (cascade delete zaten yapıyor)
}
```

## 🔄 Mevcut Veriler için

### InventoryMedia'daki Post Görselleri

Eğer InventoryMedia'da post görselleri varsa, bunları taşırken:

1. **MinIO'da taşıma gerekmez** (aynı bucket içinde)
2. **Sadece URL'leri güncelle** (eğer farklı klasöre taşıyacaksanız)
3. **Veya olduğu gibi bırak** (sadece PostMedia tablosuna kayıt ekle)

### Migration Stratejisi

**Seçenek A: URL'leri olduğu gibi bırak**
- InventoryMedia'daki görselleri PostMedia'ya taşırken URL'leri aynen kullan
- MinIO'da taşıma yapma
- Sadece database kayıtlarını güncelle

**Seçenek B: Yeni klasöre taşı**
- Post görsellerini `post-media/` klasörüne taşı
- URL'leri güncelle
- Daha temiz ama daha fazla iş

**Önerilen: Seçenek A** (daha az riskli)

## 📁 Final Bucket Yapısı

```
tipbox-media/
├── profile-pictures/          # Kullanıcı avatarları
│   └── {userId}/
│       └── {uuid}.{ext}
├── profile-banners/           # Kullanıcı banner'ları
│   └── {userId}/
│       └── {uuid}.{ext}
├── post-media/                # ✅ YENİ: Post görselleri
│   └── {userId}/
│       └── {postId}/
│           └── {uuid}.{ext}
├── catalog-images/            # Kategori görselleri
│   └── {entityType}/
│       └── {entityId}/
│           └── {filename}
├── products/                  # Ürün görselleri (seed)
│   └── {category}/
│       └── {productName}.{ext}
└── expert-requests/           # Expert request görselleri
    └── {requestId}/
        └── {uuid}.{ext}
```

**Not:** Inventory görselleri için ayrı bir klasör yok çünkü bunlar zaten `posts/` veya başka yerlerde olabilir. Ama artık post görselleri `post-media/` klasöründe olacak.

## 🎯 Sonuç

**Önerilen bucket yapısı:**
- ✅ `post-media/{userId}/{postId}/{uuid}.{ext}` formatı
- ✅ Inventory görsellerinden ayrı
- ✅ Kullanıcı bazlı organizasyon
- ✅ Post bazlı organizasyon
- ✅ Kolay temizleme ve yönetim

**Değişiklik gerekli mi?**
- ❌ **Hayır**, mevcut bucket yapısı yeterli
- ✅ Sadece yeni post görselleri için `post-media/` klasörünü kullanın
- ✅ Mevcut görselleri olduğu gibi bırakın (sadece PostMedia tablosuna kayıt ekleyin)
