# Global Bottom Sheet Yönetimi - Öneri ve Çözüm Planı

## 📋 Mevcut Durum Analizi

### Sorunlar

1. **Bottom Tab Bar Kapanmıyor**: Bottom sheet açıldığında bottom tab navigator (`TabNavigator`) kapanmıyor
2. **Overlay Sorunları**: Bazı bottom sheet'ler tüm sayfayı kaplamıyor, sadece içerik alanını kaplıyor
3. **Z-Index Sorunları**: Bottom tab bar `zIndex: 1000` ile render ediliyor, bazı bottom sheet'ler bunun altında kalıyor
4. **Dağınık Yönetim**: Her screen kendi bottom sheet'ini kendi içinde render ediyor (26+ dosyada)

### Mevcut Kullanım

- **Kütüphane**: `@gorhom/bottom-sheet`
- **Provider**: `BottomSheetModalProvider` zaten `App.tsx` içinde mevcut
- **Kullanım Şekli**: Her screen'de `BottomSheet` component'i local olarak render ediliyor
- **Bottom Tab Bar**: `TabNavigator.tsx` içinde `zIndex: 1000` ile render ediliyor

---

## 💡 Önerilen Çözümler

### Seçenek 1: Global Bottom Sheet Manager (ÖNERİLEN) ⭐

**Yaklaşım**: App.tsx seviyesinde bir Context/Provider oluşturup, tüm bottom sheet'leri buradan yönetmek.

#### Avantajlar

✅ **Tek Noktadan Yönetim**: Tüm bottom sheet'ler tek bir yerden yönetilir
✅ **Otomatik Tab Bar Kapatma**: Bottom sheet açıldığında tab bar otomatik kapanır
✅ **Tutarlı Overlay**: Tüm bottom sheet'ler aynı overlay davranışına sahip olur
✅ **Z-Index Kontrolü**: Global z-index yönetimi ile sorunlar çözülür
✅ **Type Safety**: TypeScript ile tip güvenliği sağlanır
✅ **Kolay Bakım**: Yeni bottom sheet eklemek veya mevcut olanları değiştirmek kolay

#### Dezavantajlar

❌ **Refactoring Gerekiyor**: Mevcut 26+ dosyada değişiklik yapılması gerekecek
❌ **Öğrenme Eğrisi**: Yeni bir API öğrenilmesi gerekecek

#### Mimari

```
App.tsx
  └── GlobalBottomSheetProvider
      └── BottomSheetManager (Context)
          ├── openBottomSheet(content, options)
          ├── closeBottomSheet()
          ├── isOpen
          └── currentContent
      └── GlobalBottomSheet Component
          ├── TabNavigator'ı kapatır (z-index ile)
          ├── Overlay tüm sayfayı kaplar
          └── Content render edilir
```

#### Kullanım Örneği

```typescript
// Öncesi (Mevcut)
const bottomSheetRef = useRef<BottomSheet>(null);
bottomSheetRef.current?.expand();

// Sonrası (Yeni)
const { openBottomSheet } = useGlobalBottomSheet();
openBottomSheet(<CreatePostBottomSheet />, {
  snapPoints: ['50%', '90%'],
  enablePanDownToClose: true,
});
```

---

### Seçenek 2: BottomSheetModal Kullanımı (Alternatif)

**Yaklaşım**: Mevcut `BottomSheetModal` component'ini kullanmak (zaten provider mevcut).

#### Avantajlar

✅ **Daha Az Değişiklik**: Sadece `BottomSheet` → `BottomSheetModal` değişimi
✅ **Portal Kullanımı**: `@gorhom/portal` ile otomatik overlay
✅ **Tab Bar Üstünde**: Portal sayesinde tab bar'ın üstünde render edilir

#### Dezavantajlar

❌ **Tab Bar Kapatma**: Hala manuel yapılması gerekecek
❌ **Her Yerde Aynı Kod**: Her screen'de tab bar kapatma kodu tekrarlanacak
❌ **Tutarsızlık Riski**: Her geliştirici farklı implementasyon yapabilir

---

### Seçenek 3: Hybrid Yaklaşım (Karma)

**Yaklaşım**: Hem global manager hem de local bottom sheet'leri desteklemek.

#### Avantajlar

✅ **Esneklik**: Bazı bottom sheet'ler global, bazıları local olabilir
✅ **Aşamalı Geçiş**: Mevcut kodları aşamalı olarak geçirebilirsiniz

#### Dezavantajlar

❌ **Karmaşıklık**: İki farklı sistem birlikte yönetilmeli
❌ **Tutarsızlık**: Hangi bottom sheet'in nerede olduğu karışabilir

---

## 🎯 Önerilen Çözüm: Seçenek 1 (Global Bottom Sheet Manager)

### Neden Bu Seçenek?

1. **Uzun Vadeli Çözüm**: Tüm sorunları tek seferde çözer
2. **Ölçeklenebilir**: Yeni bottom sheet'ler kolayca eklenir
3. **Tutarlı UX**: Tüm bottom sheet'ler aynı davranışa sahip olur
4. **Bakım Kolaylığı**: Tek bir yerden yönetim

### Implementasyon Planı

#### Adım 1: Global Bottom Sheet Provider Oluştur

**Dosya**: `src/providers/GlobalBottomSheetProvider.tsx`

```typescript
// Context oluştur
// Provider component'i
// GlobalBottomSheet component'i (App.tsx'te render edilecek)
```

#### Adım 2: Hook Oluştur

**Dosya**: `src/hooks/useGlobalBottomSheet.ts`

```typescript
// useGlobalBottomSheet hook'u
// openBottomSheet, closeBottomSheet, isOpen fonksiyonları
```

#### Adım 3: Tab Navigator'ı Dinamik Kapat

**Dosya**: `src/navigation/TabNavigator.tsx`

```typescript
// useGlobalBottomSheet hook'undan isOpen değerini al
// isOpen === true ise tabBarStyle'ı gizle veya z-index'i düşür
```

#### Adım 4: Mevcut Bottom Sheet'leri Migrate Et

**Strateji**: 
- Önce en çok kullanılan bottom sheet'lerden başla
- Her feature için ayrı ayrı migrate et
- Test et ve devam et

---

## 📐 Teknik Detaylar

### Global Bottom Sheet Component Özellikleri

1. **Z-Index**: `zIndex: 10000` (tab bar'dan yüksek)
2. **Overlay**: Tüm ekranı kaplayan backdrop
3. **Tab Bar Kapatma**: Otomatik (context üzerinden)
4. **Animasyon**: Smooth açılma/kapanma
5. **Gesture**: Pan down to close desteği

### Tab Navigator Entegrasyonu

```typescript
// TabNavigator.tsx içinde
const { isBottomSheetOpen } = useGlobalBottomSheet();

tabBarStyle: {
  ...existingStyle,
  display: isBottomSheetOpen ? 'none' : 'flex', // veya opacity: 0
  zIndex: isBottomSheetOpen ? 0 : 1000,
}
```

### Backdrop Yönetimi

```typescript
// GlobalBottomSheet component'inde
<BottomSheetBackdrop
  appearsOnIndex={0}
  disappearsOnIndex={-1}
  opacity={0.5}
  enableTouchThrough={false}
  pressBehavior="close"
/>
```

---

## 🔄 Migration Stratejisi

### Aşamalı Geçiş Planı

1. **Faz 1**: Global provider'ı oluştur ve test et (1-2 gün)
2. **Faz 2**: En kritik bottom sheet'leri migrate et (FeedScreen, CatalogScreen) (2-3 gün)
3. **Faz 3**: Diğer bottom sheet'leri migrate et (3-5 gün)
4. **Faz 4**: Test ve bug fix (2-3 gün)

**Toplam Süre**: ~10-13 gün

### Migration Örneği

**Öncesi** (`FeedScreen.tsx`):
```typescript
const expertBottomSheetRef = useRef<BottomSheet>(null);

<BottomSheet ref={expertBottomSheetRef} ...>
  <ExpertBottomSheet />
</BottomSheet>
```

**Sonrası** (`FeedScreen.tsx`):
```typescript
const { openBottomSheet } = useGlobalBottomSheet();

const handleOpenExpert = () => {
  openBottomSheet(<ExpertBottomSheet />, {
    snapPoints: ['50%', '90%'],
  });
};
```

---

## 📊 Karşılaştırma Tablosu

| Özellik | Seçenek 1 (Global) | Seçenek 2 (Modal) | Seçenek 3 (Hybrid) |
|---------|-------------------|-------------------|-------------------|
| Tab Bar Kapatma | ✅ Otomatik | ❌ Manuel | ⚠️ Kısmen |
| Overlay Tutarlılığı | ✅ %100 | ⚠️ %80 | ⚠️ %60 |
| Z-Index Sorunları | ✅ Çözülür | ⚠️ Kısmen | ⚠️ Kısmen |
| Kod Tekrarı | ✅ Yok | ❌ Var | ⚠️ Kısmen |
| Bakım Kolaylığı | ✅ Yüksek | ⚠️ Orta | ❌ Düşük |
| Refactoring Süresi | ⚠️ 10-13 gün | ✅ 3-5 gün | ⚠️ 7-10 gün |
| Uzun Vadeli Fayda | ✅ Yüksek | ⚠️ Orta | ❌ Düşük |

---

## 🎯 Sonuç ve Öneri

**Önerilen Çözüm**: **Seçenek 1 - Global Bottom Sheet Manager**

### Nedenler

1. ✅ **Tüm sorunları çözer**: Tab bar kapatma, overlay, z-index
2. ✅ **Uzun vadeli çözüm**: Gelecekteki bottom sheet'ler için hazır
3. ✅ **Tutarlı UX**: Tüm bottom sheet'ler aynı davranışa sahip
4. ✅ **Bakım kolaylığı**: Tek bir yerden yönetim
5. ✅ **Type safety**: TypeScript ile tip güvenliği

### Uygulama Önerisi

1. **İlk olarak**: Global provider'ı oluştur ve test et
2. **Sonra**: En kritik 2-3 bottom sheet'i migrate et
3. **Son olarak**: Kalan bottom sheet'leri aşamalı olarak migrate et

### Risk Yönetimi

- ✅ **Geriye Dönük Uyumluluk**: Mevcut bottom sheet'ler çalışmaya devam eder (aşamalı geçiş)
- ✅ **Test Edilebilir**: Her migration sonrası test edilebilir
- ✅ **Rollback**: İstenirse eski yapıya dönülebilir

---

## 📝 Sonraki Adımlar

Karar verildikten sonra:

1. ✅ Global provider implementasyonu
2. ✅ Hook implementasyonu
3. ✅ TabNavigator entegrasyonu
4. ✅ İlk bottom sheet migration (örnek)
5. ✅ Dokümantasyon güncellemesi

---

**Hazırlanma Tarihi**: 2025-01-XX
**Öneren**: AI Assistant
**Durum**: Öneri Aşaması - Karar Bekleniyor

