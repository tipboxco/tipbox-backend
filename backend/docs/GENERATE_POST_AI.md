Harika bir noktadasın. Cursor kullanarak bu süreci otomatize etmek işini çok kolaylaştıracak. Gemini API (özellikle `gemini-2.5-pro` modeli) hem hızlı hem de bu tarz metin üretimleri için oldukça maliyet etkin bir çözüm.

İşte 30 Persona stratejisi ve Node.js ile kurgulayabileceğin yapı:

### 1. Persona Stratejisi (30 Farklı Bakış Açısı)

1000 postun "tek elden çıkmış" gibi durmaması için bu personaları 2 ana gruba ayıralım ve script içerisinde her seferinde birini rastgele seçelim.

**Grup A: Tüketici Elektroniği Odaklılar (15 Persona)**

1. **Teknoloji Gurusu:** En küçük teknik detaya (ms, nits, ppi) takılan uzman.
2. **Pratik Anne/Baba:** "Çocuğun elinden düşmüyor, sağlammış" diyen ebeveyn.
3. **Bütçe Dostu Öğrenci:** Fiyat/performans canavarı arayan genç.
4. **Minimalist Profesyonel:** Sadece işini yapmasını ve şık durmasını isteyen beyaz yakalı.
5. **Hardcore Gamer:** FPS değerleri ve RGB aydınlatma tutkunu.
6. **İçerik Üreticisi/Vlogger:** Kamera kalitesi ve mikrofon odaklı yaşayan.
7. **Dijital Göçebe:** Taşınabilirlik ve pil ömrü hastası gezgin.
8. **Ev Kuşu:** Akıllı ev sistemleri ve konfor odaklı kullanıcı.
9. **Sporcu/Fitness Tutkunu:** Wearable (giyilebilir) teknoloji ve dayanıklılık odaklı.
10. **Retro Sever:** Modern cihazda nostalji veya sadelik arayan.
11. **Hediye Alıcı:** "Eşime aldım, çok sevindi" diyen duygusal alıcı.
12. **Yaşlı Kullanıcı:** "Karışık değil, kullanımı kolay" diyen emekli.
13. **Ofis Müdürü:** Kurumsal verimlilik ve dayanıklılık odaklı.
14. **Yazılımcı:** Fonksiyonellik ve özelleştirilebilirlik arayan.
15. **Müzik Tutkunu:** Ses kalitesi ve izolasyon odaklı.

**Grup B: Kozmetik ve Bakım Odaklılar (15 Persona)**
16. **Skincare Minimalisti:** Sadece 3 ürünle rutinini bitiren.
17. **Makyaj Artisti:** Ürünün pigmentasyonu ve kalıcılığına odaklanan profesyonel.
18. **Organik Yaşam Savunucusu:** İçerik listesi (temiz içerik) okuyan bilinçli tüketici.
19. **Hassas Ciltli:** "Asla sivilce yapmadı" diyen temkinli kullanıcı.
20. **Lüks Marka Tutkunu:** Paketleme ve prestij odaklı kullanıcı.
21. **K-Beauty Hayranı:** Kore cilt bakımı trendlerini takip eden.
22. **Yoğun Çalışan Kadın:** "Sabah sürdüm akşam hala duruyor" diyen pratik kullanıcı.
23. **Güzellik Influencer’ı:** Trendleri takip eden ve karşılaştırma yapan.
24. **Erkek Bakım Meraklısı:** Sakal, saç veya basit cilt bakımı odaklı erkek kullanıcı.
25. **Anti-Aging Odaklı:** İnce çizgiler ve sıkılaşma bekleyen 40+ kullanıcı.
26. **Genç/Ergen:** Sivilce karşıtı ve uygun fiyatlı ürün arayan.
27. **Vegan/Cruelty-Free:** Hayvan deneyi yapılmayan ürünleri tercih eden.
28. **Dermokozmetik Takipçisi:** Eczane ürünlerini ve bilimsel içeriği seven.
29. **Koku Hassasiyeti Olan:** Parfümsüz veya çok güzel kokan ürün arayan.
30. **Hızlı Hazırlanan:** "5 dakikada günlük makyajımı bitiriyorum" diyen kişi.

---

### 2. Kritik İpuçları

1. **Eşleştirme Sorunu:** Gemini'a ürün ismini ve kategorisini (mümkünse markasını) göndermen yeterli. Gemini zaten global bir veritabanına sahip olduğu için ürünün ne işe yaradığını biliyor olacaktır. "Bu ürün hakkında bir deneyim yaz" dediğinde o ürünü tanıyacaktır.
2. **Hız ve Maliyet:** 1000 request için `gemini-2.5-pro` kullanırsan muhtemelen ücretsiz kota içerisinde veya çok düşük bir maliyetle (birkaç dolar) bu işi çözersin.
3. **Doğallık Kontrolü:** Prompt içerisine *"Metin içerisinde 'muhteşem', 'harika' gibi kelimeleri çok sık kullanma, daha çok 'işimi gördü', 'beklentimin üzerindeydi', 'kurulumu zordu' gibi gerçekçi ifadeler seç"* eklemesi yapmak postların kalitesini %200 artırır.

