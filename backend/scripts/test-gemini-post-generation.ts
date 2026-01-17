/**
 * Gemini API Post Generation Test Script
 * 
 * Gemini API'nin çalışıp çalışmadığını ve post içeriği üretip üretemediğini test eder.
 */

import { GeminiService } from '../src/infrastructure/ai/gemini.service';

async function testGeminiPostGeneration() {
  console.log('🧪 Gemini API Post Generation Test Başlatılıyor...\n');

  try {
    const geminiService = GeminiService.getInstance();

    // Test 1: Basit bir post içeriği üret
    console.log('📝 Test 1: Basit post içeriği üretimi...');
    const testRequest1 = {
      postType: 'TIPS',
      persona: 'Teknoloji Gurusu: En küçük teknik detaya (ms, nits, ppi) takılan uzman.',
      productName: 'iPhone 15 Pro',
      productBrand: 'Apple',
      productDescription: 'Apple\'ın en yeni flagship telefonu',
    };

    const result1 = await geminiService.generatePostContent(testRequest1);
    console.log('✅ Test 1 Başarılı!');
    console.log(`   Başlık: ${result1.title}`);
    console.log(`   İçerik: ${result1.body.substring(0, 100)}...`);
    console.log(`   Token Kullanımı: ${result1.metadata.tokensUsed}`);
    console.log(`   Süre: ${result1.metadata.processingTimeMs}ms\n`);

    // Test 2: Farklı bir post tipi
    console.log('📝 Test 2: EXPERIENCE tipi post içeriği üretimi...');
    const testRequest2 = {
      postType: 'EXPERIENCE',
      persona: 'Pratik Anne/Baba: "Çocuğun elinden düşmüyor, sağlammış" diyen ebeveyn.',
      productName: 'Samsung Galaxy Tab',
      productBrand: 'Samsung',
    };

    const result2 = await geminiService.generatePostContent(testRequest2);
    console.log('✅ Test 2 Başarılı!');
    console.log(`   Başlık: ${result2.title}`);
    console.log(`   İçerik: ${result2.body.substring(0, 100)}...`);
    console.log(`   Token Kullanımı: ${result2.metadata.tokensUsed}`);
    console.log(`   Süre: ${result2.metadata.processingTimeMs}ms\n`);

    // Test 3: Marka olmadan
    console.log('📝 Test 3: Marka bilgisi olmadan post içeriği üretimi...');
    const testRequest3 = {
      postType: 'QUESTION',
      persona: 'Bütçe Dostu Öğrenci: Fiyat/performans canavarı arayan genç.',
      productName: 'Gaming Laptop',
    };

    const result3 = await geminiService.generatePostContent(testRequest3);
    console.log('✅ Test 3 Başarılı!');
    console.log(`   Başlık: ${result3.title}`);
    console.log(`   İçerik: ${result3.body.substring(0, 100)}...`);
    console.log(`   Token Kullanımı: ${result3.metadata.tokensUsed}`);
    console.log(`   Süre: ${result3.metadata.processingTimeMs}ms\n`);

    console.log('✨ Tüm testler başarılı! Gemini API çalışıyor.\n');
    console.log('💡 Artık seed script\'ini çalıştırabilirsiniz:');
    console.log('   docker-compose exec backend npx ts-node scripts/clear-and-seed.ts\n');

  } catch (error: any) {
    console.error('\n❌ Test Başarısız!\n');
    console.error('Hata Detayları:');
    console.error(`   Mesaj: ${error.message}`);
    
    if (error.message.includes('API key')) {
      console.error('\n🔑 API Key Sorunu:');
      console.error('   - GEMINI_API_KEY ortam değişkenini kontrol edin');
      console.error('   - API key\'in geçerli olduğundan emin olun');
      console.error('   - Eğer "leaked" hatası alıyorsanız, yeni bir API key oluşturun');
      console.error('   - Google AI Studio: https://makersuite.google.com/app/apikey\n');
    } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
      console.error('\n⏱️  Rate Limit Sorunu:');
      console.error('   - API quota\'nızı kontrol edin');
      console.error('   - Birkaç dakika bekleyip tekrar deneyin\n');
    } else {
      console.error('\n🔍 Diğer Hata:');
      console.error('   - Hata detaylarını kontrol edin');
      console.error('   - GEMINI_MODEL ortam değişkenini kontrol edin (varsayılan: gemini-2.5-pro)\n');
    }

    process.exit(1);
  }
}

// Script'i çalıştır
testGeminiPostGeneration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Beklenmeyen hata:', error);
    process.exit(1);
  });

