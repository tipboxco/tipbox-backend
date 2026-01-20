import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEFAULT_PASSWORD = 'password123';

// Gerçek kullanıcı email'leri
const USERS = [
  { email: 'omer@tipbox.co' },
  { email: 'trust-user-0@tipbox.co' },
  { email: 'trust-user-1@tipbox.co' },
  { email: 'trust-user-2@tipbox.co' },
  { email: 'trust-user-3@tipbox.co' },
  { email: 'trust-user-4@tipbox.co' },
  { email: 'truster-user-0@tipbox.co' },
  { email: 'truster-user-1@tipbox.co' },
  { email: 'truster-user-2@tipbox.co' },
];

// Yorum örnekleri
const COMMENT_SAMPLES = [
  'Harika bir haber! Çok bilgilendirici.',
  'Bu gelişme gerçekten heyecan verici. Merakla bekliyorum.',
  'Detaylı bir analiz olmuş. Teşekkürler.',
  'Çok faydalı bilgiler, paylaşım için teşekkürler.',
  'Bu konuda daha fazla bilgi almak isterim.',
  'Güzel bir haber, beğendim.',
  'İlginç bir gelişme. Takip edeceğim.',
  'Harika bir içerik, devamını bekliyorum.',
  'Çok değerli bilgiler, teşekkür ederim.',
  'Bu haber gerçekten önemli bir gelişme.',
  'Detaylı ve açıklayıcı bir yazı olmuş.',
  'Merakla bekliyorum, güzel bir haber.',
  'Çok bilgilendirici, teşekkürler.',
  'Harika bir paylaşım, beğendim.',
  'Bu konuda daha fazla detay görmek isterim.',
];

interface AuthResult {
  token: string;
  userId: string;
  email: string;
}

/**
 * Kullanıcı login yapıp token al
 */
async function loginUser(email: string): Promise<AuthResult | null> {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password: DEFAULT_PASSWORD,
    });

    if (!response.data.token) {
      console.warn(`⚠️  ${email} için token alınamadı`);
      return null;
    }

    return {
      token: response.data.token,
      userId: response.data.id || response.data.userId || '',
      email,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.warn(`⚠️  ${email} login hatası: ${axiosError.response?.data?.message || axiosError.message}`);
    }
    return null;
  }
}

/**
 * Apple Watch Series 10 için news'i bul
 */
async function findAppleWatchSeries10News(token: string): Promise<string[]> {
  const newsIds: string[] = [];

  try {
    console.log('🔍 Apple Watch Series 10 için news aranıyor...');

    // 1. Önce search endpoint'ini kullanarak Apple Watch Series 10'u bul
    try {
      const searchResponse = await axios.get(`${BASE_URL}/search?keyword=Apple Watch Series 10&types=product&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (searchResponse.data && searchResponse.data.products && Array.isArray(searchResponse.data.products)) {
        const watchSeries10 = searchResponse.data.products.find((product: any) => 
          product.name && product.name.toLowerCase().includes('apple watch series 10')
        );

        if (watchSeries10 && watchSeries10.id) {
          const productId = watchSeries10.id;
          console.log(`✅ Apple Watch Series 10 bulundu: ${productId}`);

          // Product'ın brand ID'sini al
          const brandId = watchSeries10.brandId || watchSeries10.brand?.id;

          if (brandId) {
            // Bu product için news'leri al
            try {
              const newsResponse = await axios.get(
                `${BASE_URL}/brands/${brandId}/products/${productId}/news?limit=20`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );

              if (newsResponse.data && Array.isArray(newsResponse.data)) {
                for (const news of newsResponse.data) {
                  if (news.id && !newsIds.includes(news.id)) {
                    newsIds.push(news.id);
                  }
                }
                console.log(`✅ ${newsIds.length} news bulundu`);
              }
            } catch (error) {
              console.warn('⚠️  News listesi alınırken hata:', error instanceof Error ? error.message : String(error));
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  Search endpoint hatası, feed endpoint deneniyor...');
    }

    // 2. Eğer search'den news bulunamadıysa, feed'den UPDATE tipi postları ara
    if (newsIds.length === 0) {
      try {
        console.log('📰 Feed endpoint\'inden Apple Watch Series 10 aranıyor...');
        const feedResponse = await axios.get(`${BASE_URL}/posts/feed?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (feedResponse.data && feedResponse.data.items && Array.isArray(feedResponse.data.items)) {
          console.log(`📊 ${feedResponse.data.items.length} post kontrol ediliyor...`);
          for (const item of feedResponse.data.items) {
            // UPDATE tipi postlar ve Apple Watch Series 10 ile ilgili olanlar
            if (item.type === 'update' && item.data && item.data.id) {
              const productName = item.data.product?.name || '';
              const title = item.data.title || '';
              const body = item.data.body || '';
              
              const searchText = `${productName} ${title} ${body}`.toLowerCase();
              if (searchText.includes('apple watch series 10') || searchText.includes('watch series 10')) {
                if (!newsIds.includes(item.data.id)) {
                  newsIds.push(item.data.id);
                  console.log(`  ✅ News bulundu: ${item.data.id} - ${productName || title}`);
                }
              }
            }
          }
          if (newsIds.length > 0) {
            console.log(`✅ Feed'den ${newsIds.length} news bulundu`);
          } else {
            console.log('⚠️  Feed\'de Apple Watch Series 10 ile ilgili news bulunamadı');
          }
        }
      } catch (error) {
        console.warn('⚠️  Feed endpoint hatası:', error instanceof Error ? error.message : String(error));
      }
    }

    // 3. Eğer hala news bulunamadıysa, explore/whats-new endpoint'ini dene
    if (newsIds.length === 0) {
      try {
        const exploreResponse = await axios.get(`${BASE_URL}/explore/whats-new?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (exploreResponse.data && exploreResponse.data.items && Array.isArray(exploreResponse.data.items)) {
          for (const item of exploreResponse.data.items) {
            if (item.type === 'update' && item.data && item.data.id) {
              const productName = item.data.product?.name || '';
              if (productName.toLowerCase().includes('apple watch series 10')) {
                if (!newsIds.includes(item.data.id)) {
                  newsIds.push(item.data.id);
                }
              }
            }
          }
          if (newsIds.length > 0) {
            console.log(`✅ Explore'den ${newsIds.length} news bulundu`);
          }
        }
      } catch (error) {
        console.warn('⚠️  Explore endpoint hatası');
      }
    }

  } catch (error) {
    console.warn('⚠️  Apple Watch Series 10 news aranırken hata:', error instanceof Error ? error.message : String(error));
  }

  return newsIds;
}

/**
 * News'e comment ekle
 */
async function addComment(
  token: string,
  newsId: string,
  comment: string,
  parentId?: string
): Promise<boolean> {
  try {
    const response = await axios.post(
      `${BASE_URL}/news/${newsId}/comment`,
      {
        comment,
        ...(parentId && { parentId }),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.status === 201;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string; error?: string }>;
      const errorMessage = axiosError.response?.data?.message || axiosError.response?.data?.error || axiosError.message;
      const status = axiosError.response?.status;
      console.warn(
        `⚠️  Comment ekleme hatası (${newsId}): [${status}] ${errorMessage}`
      );
      if (axiosError.response?.data) {
        console.warn(`   Response data:`, JSON.stringify(axiosError.response.data).substring(0, 200));
      }
    } else {
      console.warn(`⚠️  Comment ekleme hatası (${newsId}):`, error instanceof Error ? error.message : String(error));
    }
    return false;
  }
}

/**
 * News comments'leri getir
 */
async function getComments(token: string, newsId: string): Promise<any[]> {
  try {
    const response = await axios.get(`${BASE_URL}/news/${newsId}/comments?limit=50`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.warn(`⚠️  Comments getirme hatası (${newsId}):`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Ana fonksiyon
 */
async function main() {
  console.log('🚀 News comment üretme script\'i başlatılıyor...\n');

  // 1. Kullanıcılar için token'ları al
  console.log('📝 Kullanıcılar için token alınıyor...');
  const userTokens = new Map<string, AuthResult>();

  for (const user of USERS) {
    const authResult = await loginUser(user.email);
    if (authResult) {
      userTokens.set(user.email, authResult);
      console.log(`✅ ${user.email} için token alındı`);
    } else {
      console.log(`❌ ${user.email} için token alınamadı`);
    }
  }

  if (userTokens.size === 0) {
    console.error('❌ Hiçbir kullanıcı için token alınamadı!');
    process.exit(1);
  }

  console.log(`\n✅ ${userTokens.size} kullanıcı için token alındı\n`);

  // 2. Apple Watch Series 10 için news'i bul
  console.log('📰 Apple Watch Series 10 için news aranıyor...');
  const firstUserToken = Array.from(userTokens.values())[0];
  const newsIds = await findAppleWatchSeries10News(firstUserToken.token);

  // Eğer news bulunamadıysa, kullanıcıdan manuel olarak news ID'leri al
  if (newsIds.length === 0) {
    console.warn('⚠️  Otomatik olarak news bulunamadı!');
    
    // Environment variable'dan news ID'leri al
    const manualNewsIds = process.env.NEWS_IDS || process.env.NEWS_ID;
    if (manualNewsIds) {
      const ids = manualNewsIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      if (ids.length > 0) {
        newsIds.push(...ids);
        console.log(`✅ ${ids.length} manuel news ID eklendi: ${ids.join(', ')}\n`);
      }
    } else {
      console.error('❌ Hiçbir news bulunamadı!');
      console.log('💡 NEWS_ID veya NEWS_IDS environment variable ile manuel news ID\'leri girebilirsiniz:');
      console.log('   Örnek: NEWS_ID="news-id-1" npx ts-node scripts/generate-news-comments.ts');
      console.log('   Örnek: NEWS_IDS="news-id-1,news-id-2" npx ts-node scripts/generate-news-comments.ts\n');
      process.exit(1);
    }
  }

  console.log(`✅ ${newsIds.length} news bulundu\n`);

  // 3. Her kullanıcı için her news'e comment ekle
  console.log('💬 Commentler ekleniyor...\n');
  let totalCommentsAdded = 0;
  let totalCommentsFailed = 0;

  const userArray = Array.from(userTokens.values());
  const shuffledComments = [...COMMENT_SAMPLES].sort(() => Math.random() - 0.5);

  for (let i = 0; i < newsIds.length; i++) {
    const newsId = newsIds[i];
    console.log(`📰 News ${i + 1}/${newsIds.length}: ${newsId}`);

    // Her kullanıcı için bu news'e comment ekle
    for (let j = 0; j < userArray.length; j++) {
      const user = userArray[j];
      const commentIndex = (i * userArray.length + j) % shuffledComments.length;
      const comment = shuffledComments[commentIndex];

      const success = await addComment(user.token, newsId, comment);
      if (success) {
        totalCommentsAdded++;
        console.log(`  ✅ ${user.email}: "${comment.substring(0, 40)}..."`);
      } else {
        totalCommentsFailed++;
        console.log(`  ❌ ${user.email}: Comment eklenemedi`);
      }

      // Rate limiting için kısa bir bekleme
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log('');
  }

  console.log(`\n✅ Toplam ${totalCommentsAdded} comment eklendi`);
  if (totalCommentsFailed > 0) {
    console.log(`⚠️  ${totalCommentsFailed} comment eklenemedi`);
  }

  // 4. Doğrulama: Comments'leri getir ve göster
  console.log('\n🔍 Commentler doğrulanıyor...\n');
  const firstNewsId = newsIds[0];
  const comments = await getComments(firstUserToken.token, firstNewsId);

  console.log(`📰 News ${firstNewsId} icin ${comments.length} comment bulundu:\n`);
  for (let i = 0; i < Math.min(comments.length, 5); i++) {
    const comment = comments[i];
    console.log(`  ${i + 1}. ${comment.userName || 'Kullanıcı'}: "${comment.comment}"`);
    console.log(`     Likes: ${comment.likesCount || 0}, Tarih: ${new Date(comment.createdAt).toLocaleString('tr-TR')}`);
    if (comment.replies && comment.replies.length > 0) {
      console.log(`     Replies: ${comment.replies.length}`);
    }
    console.log('');
  }

  console.log('✅ Script tamamlandı!');
}

main().catch((error) => {
  console.error('❌ Script hatası:', error);
  process.exit(1);
});
