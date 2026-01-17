/**
 * Gemini Environment Variable Kontrol Script'i
 * 
 * Container içinde GEMINI_API_KEY'in doğru yüklenip yüklenmediğini kontrol eder.
 */

console.log('🔍 Gemini Environment Variable Kontrolü...\n');

// Environment variable'ı kontrol et
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL;

console.log('📋 Environment Variables:');
console.log(`   GEMINI_API_KEY: ${apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} karakter)` : '❌ TANIMLI DEĞİL'}`);
console.log(`   GEMINI_MODEL: ${model || 'gemini-2.5-pro (varsayılan)'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'tanımlı değil'}\n`);

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY tanımlı değil!\n');
  console.log('💡 Çözüm:');
  console.log('   1. .env dosyasında GEMINI_API_KEY=... olduğundan emin olun');
  console.log('   2. Docker container\'ı restart edin: docker-compose restart backend');
  console.log('   3. Veya container\'ı yeniden oluşturun: docker-compose up -d --force-recreate backend\n');
  process.exit(1);
}

// API key format kontrolü
if (apiKey.length < 20) {
  console.warn('⚠️  API key çok kısa görünüyor. Lütfen kontrol edin.\n');
}

// İlk ve son karakterleri göster (güvenlik için)
const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
console.log(`✅ API Key bulundu: ${maskedKey}`);
console.log(`   Uzunluk: ${apiKey.length} karakter\n`);

// Eski API key kontrolü (eğer hala "leaked" hatası alıyorsanız)
if (apiKey.includes('AIza') && apiKey.length > 35) {
  console.log('💡 Not: API key formatı doğru görünüyor.');
  console.log('   Eğer hala "leaked" hatası alıyorsanız:');
  console.log('   1. Yeni bir API key oluşturun: https://makersuite.google.com/app/apikey');
  console.log('   2. .env dosyasını güncelleyin');
  console.log('   3. Container\'ı restart edin: docker-compose restart backend\n');
}

console.log('✨ Kontrol tamamlandı!\n');

