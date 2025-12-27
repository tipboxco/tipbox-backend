# Brand Category ve Sub Category İlişkisi

## Önemli Not
**Brand Category'lerin doğrudan alt kategorileri YOKTUR.**

Schema yapısı:
- `BrandCategory` → `Brand`'ları gruplar
- `MainCategory` → `SubCategory`'leri gruplar
- `SubCategory` → `ProductGroup`'ları gruplar

Brand Category'lerdeki brand'ların ürünleri, MainCategory ve SubCategory yapısına göre organize edilir.

## Seed Dosyasında Oluşturulan Sub Category'ler

### Technology / Teknoloji Main Category Altında:
1. **Akıllı Telefonlar** - iPhone, Android, Samsung, Xiaomi vs.
2. **Laptoplar** - Dizüstü bilgisayarlar, ultrabook, gaming laptop
3. **Kulaklıklar** - Kablosuz, kablolu, gaming, studio kulaklık
4. **Akıllı Saatler** - Apple Watch, Samsung Galaxy Watch, fitness tracker
5. **Kamera & Lens** - 4K aynasız kamera, lens setleri
6. **Bilgisayar & Tablet** - Dizüstü, tablet, üretkenlik cihazları
7. **Drone & Aksiyon** - Kompakt drone, aksiyon kameraları
8. **Telefon & Aksesuar** - Akıllı telefonlar ve aksesuarları
9. **TV & Görüntü** - 4K QLED TV, soundbar, medya oynatıcılar
10. **Akıllı Ev & Güvenlik** - Otomasyon, güvenlik kameraları, akıllı kilitler

### Ev & Yaşam / Home & Living Main Category Altında:
1. **Temizlik Ürünleri** - Süpürge, temizlik robotu vb.
2. **Beyaz Eşya** - Çamaşır makinesi, buzdolabı, bulaşık makinesi
3. **Küçük Ev Aletleri** - Mutfak robotu, blender, kettle
4. **Klima & İklimlendirme** - Inverter klima, hava temizleme

### Hobi & Eğlence Main Category Altında:
1. **Oyun & Konsol** - Oyun konsolları, VR setleri, gamepad'ler

## Brand Category'ler ve İlgili Main/Sub Category'ler

### Electronics Brand Category
Bu kategorideki brand'lar (Apple, Samsung, Xiaomi, JBL, ASUS) genellikle şu sub category'lerde ürünlere sahiptir:
- **Technology** main category altında:
  - Akıllı Telefonlar
  - Laptoplar
  - Kulaklıklar
  - Akıllı Saatler
  - Telefon & Aksesuar
  - TV & Görüntü
  - Akıllı Ev & Güvenlik

### Beauty Brand Category
Bu kategorideki brand'lar genellikle şu main category'lerde ürünlere sahiptir:
- **Sağlık & Güzellik** main category (sub category'ler seed'de tanımlı değil)

### Technology Brand Category
Bu kategorideki brand'lar (TechVision, TechNova, vb.) genellikle:
- **Technology** main category altındaki tüm sub category'lerde ürünlere sahip olabilir

### Home & Living Brand Category
Bu kategorideki brand'lar genellikle:
- **Ev & Yaşam** main category altındaki sub category'lerde ürünlere sahiptir:
  - Temizlik Ürünleri
  - Beyaz Eşya
  - Küçük Ev Aletleri
  - Klima & İklimlendirme

### Gaming Brand Category
Bu kategorideki brand'lar genellikle:
- **Hobi & Eğlence** main category altında:
  - Oyun & Konsol

### Diğer Brand Category'ler
- **Kitchen**: Ev & Yaşam → Küçük Ev Aletleri
- **Health & Fitness**: Technology → Akıllı Saatler veya Sağlık & Güzellik
- **Fashion**: Moda & Aksesuar main category (sub category'ler seed'de tanımlı değil)
- **Outdoor**: Spor & Outdoor main category (sub category'ler seed'de tanımlı değil)
- **Pets**: İlgili main category'ler seed'de tanımlı değil
- **Travel**: İlgili main category'ler seed'de tanımlı değil
- **Baby**: İlgili main category'ler seed'de tanımlı değil
- **Automotive**: Otomotiv main category (sub category'ler seed'de tanımlı değil)
- **Sustainability**: Çeşitli main category'lerde olabilir

## Özet
Brand Category'ler sadece brand'ları gruplamak için kullanılır. Ürünlerin kategorizasyonu MainCategory → SubCategory → ProductGroup → Product hiyerarşisi ile yapılır.

