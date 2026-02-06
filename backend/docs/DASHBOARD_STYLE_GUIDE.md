# Tipbox Developer Console — Stil Rehberi

Bu doküman, **localhost:3000** üzerinde sunulan **Tipbox Developer Console** (dashboard) ekranının renk düzeni, yazı tipi ve bileşen stillerini tanımlar. Kaynak: `backend/src/interfaces/dashboard/dashboard.router.ts`.

---

## 1. Yazı Tipleri (Fonts)

| Kullanım | Font | Fallback | Kaynak |
|----------|------|----------|--------|
| **Ana metin** | `Jura` | `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif` | Google Fonts |
| **Monospace (URL, commit, kod)** | `Monaco`, `Courier New` | `monospace` | Sistem |

- **Google Fonts linki:** `https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&display=swap`
- **Jura ağırlıkları:** 300, 400, 500, 600, 700
- Buton ve başlıklarda `font-family: 'Jura', sans-serif` kullanılır.

---

## 2. Renk Paleti

### Arka plan ve yüzeyler

| Değişken / Amaç | Hex / RGBA | Açıklama |
|-----------------|------------|----------|
| Sayfa arka planı | `#272727` | Ana koyu gri |
| Kart / section arka planı | `rgba(255, 255, 255, 0.03)` – `0.08` | Hafif cam efekti |
| Modal arka planı | `#272727` | Sayfa ile aynı |
| Overlay (modal, loading) | `rgba(0, 0, 0, 0.75)` – `0.85` | Karartma + blur |

### Metin renkleri

| Amaç | Değer | Kullanım |
|------|--------|----------|
| Birincil metin | `#FAFAFA` | Başlıklar, ana metin, buton yazısı |
| İkincil / soluk metin | `#A3A3A3` | Açıklamalar, URL (normal), status metni |
| Vurgu / link | `#D0F205` | Accent, ikonlar, hover’da URL, commit linki |
| Kod / inline code | `#D0F205` + `rgba(208, 242, 5, 0.1)` arka plan | `.command-description code` |

### Accent (marka rengi)

| Amaç | Değer |
|------|--------|
| Ana vurgu | `#D0F205` (sarı-yeşil / lime) |
| Gradient (progress bar) | `linear-gradient(90deg, #D0F205 0%, #B8D904 100%)` |
| Section sol çizgi / border | `#D0F205` |
| Hover glow | `rgba(208, 242, 5, 0.2)` – `0.25` |

### Durum renkleri

| Durum | Arka plan / border | Metin / ikon |
|--------|---------------------|--------------|
| **Online / başarı** | `#22c55e` (dot), glow `rgba(34, 197, 94, 0.8)` | — |
| **Offline / hata** | `#ef4444` (dot), glow `rgba(239, 68, 68, 0.7)` | `#FF6B7A` |
| **Tehlike (danger)** | `rgba(220, 53, 69, 0.05)` – `0.3` | `#FF6B7A`, `#fecaca`, `#bbf7d0` (yeşil buton metni) |

### Çizgiler ve kenarlıklar

| Amaç | Değer |
|------|--------|
| Section / kart border | `#D0F205` veya `1px solid #D0F205` |
| Header alt çizgi | `1px solid rgba(163, 163, 163, 0.2)` |
| Genel border (buton, input, modal) | `rgba(163, 163, 163, 0.2)` – `0.3` |
| Danger alanları | `rgba(220, 53, 69, 0.2)` – `0.4` |

---

## 3. Tipografi (Boyut ve Ağırlık)

| Öğe | font-size | font-weight | Not |
|-----|-----------|-------------|-----|
| Sayfa body | (varsayılan) | — | `line-height: 1.6` |
| H1 (Dashboard başlık) | `2.5rem` | `700` | Mobil: `2rem` |
| Section başlık | `1.75rem` | `600` | `.section-title` |
| Kart başlığı (h3) | `1.1rem` | `600` |
| Modal başlık | `1.5rem` | `600` |
| Body / açıklama | `0.875rem` | `400` | Kart içi metin |
| Küçük metin / URL | `0.875rem` | `400` | Monospace |
| Badge / buton | `0.9375rem` – `1rem` | `500` – `700` |
| Status, progress metin | `0.75rem` – `0.8125rem` | `500` |
| Inline code | `0.75rem` | — | Monospace |

- **Letter-spacing:** Başlıklarda `-0.02em`, `.section-title` için `-0.01em`, env badge için `0.8px`.

---

## 4. Boşluklar ve Layout

| Öğe | Değer |
|-----|--------|
| Sayfa padding | `32px 24px` |
| Container max-width | `1400px` |
| Section padding | `32px` |
| Section margin-bottom | `32px` |
| Kart padding | `24px` |
| Grid gap (ports, seed) | `20px` |
| Header margin-bottom | `48px` |
| Header padding-bottom | `32px` |

### Grid (responsive)

- **Ports / Seed grid:** `repeat(4, 1fr)` → 1400px altı 3 → 1024px altı 2 → 640px altı 1 sütun.
- Breakpoints: `1400px`, `1024px`, `768px`, `640px`.

---

## 5. Köşe Yuvarlaklığı (Border Radius)

| Bileşen | border-radius |
|---------|----------------|
| Section | `16px` |
| Kart (port-card, seed-card) | `12px` |
| Buton, input, modal iç kutu | `8px` |
| Modal | `16px` |
| Badge (env, version) | `24px` |
| Section başlık çizgisi | `2px` |
| Progress bar / kod | `4px` |

---

## 6. Gölge ve Efektler

| Öğe | box-shadow |
|-----|------------|
| Env badge | `0 4px 16px rgba(0, 0, 0, 0.4)` |
| Version badge | `0 2px 8px rgba(0, 0, 0, 0.2)` |
| Kart hover | `0 4px 16px rgba(208, 242, 5, 0.25)` |
| Section hover | `0 4px 20px rgba(208, 242, 5, 0.2)` |
| Modal | `0 20px 60px rgba(0, 0, 0, 0.5)` |
| Backdrop | `backdrop-filter: blur(4px)` – `blur(10px)` |

---

## 7. Animasyonlar

| Ad | Süre | Açıklama |
|----|------|----------|
| **fadeInSlide** | `0.8s ease-out` | Logo: opacity 0→1, translateX(20px)→0 |
| **pulse** | `2s ease-in-out infinite` | Env badge nokta: opacity ve scale |
| **spin** | `1s linear infinite` | Loading spinner: 0deg→360deg |

- Geçişler: `transition: all 0.3s ease` veya `cubic-bezier(0.4, 0, 0.2, 1)` (kart hover).
- Hover: kartlarda `transform: translateY(-2px)`, butonlarda `translateY(-1px)`.

---

## 8. İkonlar

- **Kütüphane:** Font Awesome 6.4.0  
- **CDN:** `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`
- Accent ikon rengi: `#D0F205` (`.icon`), danger ikon: `#FF6B7A`.

---

## 9. Bileşen Özeti

| Bileşen | Öne çıkan stiller |
|---------|-------------------|
| **.section** | Koyu cam arka plan, `#D0F205` border, 16px radius, blur |
| **.port-card / .seed-card** | Açık cam, lime border, hover’da yukarı kayma ve glow |
| **.env-badge** | Ortam rengi (değişken), beyaz nokta, büyük gölge |
| **.version-badge** | Cam arka plan, monospace commit, lime link |
| **.seed-button** | Cam buton, Jura, hover’da hafif lift |
| **.danger-button / .danger-card** | Kırmızı tonlar (rgba(220,53,69,...)), #FF6B7A metin |
| **.modal** | #272727 arka plan, kalın gölge, 16px radius |
| **.container-button** | Stop: kırmızı, Start: yeşil, nötr gri |
| **.status-dot** | Online: #22c55e, Offline: #ef4444, glow ile |
| **.progress-fill** | #D0F205 → #B8D904 gradient |

---

## 10. Harici Kaynaklar

- **Logo:** `https://tipbox.co/images/tipbox-logo-yellow.png`
- **Favicon:** `https://tipbox.co/images/favicon.ico`
- **Fontlar:** Google Fonts (Jura), preconnect: `fonts.googleapis.com`, `fonts.gstatic.com`

---

Bu rehber, Developer Console arayüzünü yeniden üretmek veya tutarlı yeni sayfalar eklemek için tek referans olarak kullanılabilir. Tüm değerler `dashboard.router.ts` içindeki inline `<style>` bloklarından alınmıştır.
