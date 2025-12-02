/**
 * Post test helper fonksiyonları
 * createdPostId kontrolü ve guard check'ler için
 */

/**
 * createdPostId'nin tanımlı olduğunu kontrol eder
 * @param createdPostId - Kontrol edilecek post ID
 * @param testName - Test adı (hata mesajı için)
 * @throws Error eğer createdPostId undefined ise
 */
export function requirePostId(createdPostId: string | undefined, testName: string): asserts createdPostId is string {
  if (!createdPostId) {
    throw new Error(
      `❌ ${testName}: createdPostId tanımlı değil. ` +
      `Önceki test (post oluşturma) başarısız olmuş olabilir. ` +
      `Lütfen önceki testlerin başarılı olduğundan emin olun.`
    );
  }
}







