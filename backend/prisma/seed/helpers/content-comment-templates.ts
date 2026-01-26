import type { ContentPost } from '@prisma/client'

type ContentPostType = ContentPost['type']

// Not: Ürün odaklı doğrudan konuşmayan, daha “sosyal/gerçekçi” yorum şablonları.
// Plan gereği yaklaşık 20 adet tutuluyor.
const GENERAL_TEMPLATES = [
  'Çok akıcı anlatmışsın, eline sağlık.',
  'Benzer bir süreçten geçtim; bazı detaylar gerçekten fark yaratıyor.',
  'Burada bence en kritik nokta alışkanlıklar; herkeste aynı sonuç çıkmıyor.',
  'Bu bakış açısı iyi geldi, teşekkürler.',
  'Benim deneyimimde tam tersi olmuştu; sebebi muhtemelen kullanım şekli.',
  'Kısa vadede iyi görünüp uzun vadede farklılaşabiliyor; birkaç hafta sonra update gelir mi?',
  'Detay seviyen çok iyi; özellikle şu “küçük nüanslar” kısmı değerli.',
  'Katılıyorum, beklentiyi doğru koyunca hayal kırıklığı azalıyor.',
  'Ben de buna benzer bir yöntem uyguluyorum; pratikte rahatlatıyor.',
  'Şu kısmı merak ettim: sen hangi koşullarda denedin?',
  'Güzel özetlemişsin; tek cümleyle “kim için uygun” kısmı çok net.',
  'Bu kadar net yazınca karar vermek kolaylaşıyor.',
]

const TIPS_TEMPLATES = [
  'Bu ipucunu deneyeceğim; küçük ama etkili görünüyor.',
  'Adım adım yazman çok iyi olmuş, kaydettim.',
  'Benzerini yapıyordum ama sıralamayı böyle kurmamıştım; mantıklı.',
  'Buradaki püf nokta bence süreklilik; düzenli yapınca işe yarıyor.',
]

const COMPARE_TEMPLATES = [
  'Karşılaştırmayı bu şekilde çerçevelemek iyi olmuş; aynı beklentiden bakmak lazım.',
  'Artı/eksi dengesini net göstermişsin, teşekkürler.',
  'Benim önceliğim farklı olduğu için farklı seçerdim; yine de yaklaşımını beğendim.',
  'Keşke herkes böyle kıyas yapsa; çok daha az kafa karışır.',
]

export function pickSeedContentCommentTemplate(postType?: ContentPostType): string {
  const pool =
    postType === 'TIPS'
      ? [...TIPS_TEMPLATES, ...GENERAL_TEMPLATES]
      : postType === 'COMPARE'
        ? [...COMPARE_TEMPLATES, ...GENERAL_TEMPLATES]
        : GENERAL_TEMPLATES

  return pool[Math.floor(Math.random() * pool.length)] || GENERAL_TEMPLATES[0]!
}

