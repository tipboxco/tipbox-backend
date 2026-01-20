import { seedAppleSurveys } from './apple-surveys.seed';
import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testAppleSurveys() {
  console.log('🧪 Testing Apple Surveys Seed...\n');

  try {
    // Önce brand'ı oluştur
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    // Surveys seed'i çalıştır
    const result = await seedAppleSurveys(brandResult.brandId);
    console.log('\n✅ Surveys seed başarılı!\n');

    // DB'den kontrol et
    console.log('📊 DB Kontrolü:\n');

    for (const surveyInfo of result.surveys) {
      const survey = await prisma.brandSurvey.findUnique({
        where: { id: surveyInfo.id },
        include: {
          brand: true,
          questions: {
            include: {
              answers: {
                include: {
                  user: {
                    include: {
                      profile: true,
                    },
                  },
                },
                take: 5, // İlk 5 cevabı göster
              },
            },
          },
        },
      });

      if (!survey) {
        console.error(`❌ Survey bulunamadı: ${surveyInfo.id}`);
        continue;
      }

      console.log(`📋 Survey: ${survey.title}`);
      console.log(`   ID: ${survey.id}`);
      console.log(`   Description: ${survey.description || 'N/A'}`);
      console.log(`   Brand: ${survey.brand.name}`);
      console.log(`   Start Date: ${survey.startsAt.toISOString()}`);
      console.log(`   End Date: ${survey.endsAt.toISOString()}`);
      console.log(`   Questions Count: ${survey.questions.length}`);
      console.log(`   Total Answers: ${surveyInfo.answerCount}`);

      console.log(`\n   Questions:`);
      survey.questions.forEach((question, index) => {
        const answerCount = question.answers.length;
        console.log(`     ${index + 1}. ${question.questionText}`);
        console.log(`        Type: ${question.type}`);
        console.log(`        Answers: ${answerCount}`);
        if (question.answers.length > 0) {
          console.log(`        Sample answers:`);
          question.answers.slice(0, 3).forEach((answer) => {
            const userName = answer.user.profile?.userName || answer.user.profile?.displayName || 'Unknown';
            console.log(`          - ${userName}: ${answer.answerText.substring(0, 50)}...`);
          });
        }
      });

      console.log('');
    }

    // İstatistikler
    const totalSurveys = await prisma.brandSurvey.count({
      where: { brandId: brandResult.brandId },
    });

    const totalQuestions = await prisma.brandSurveyQuestion.count({
      where: {
        survey: {
          brandId: brandResult.brandId,
        },
      },
    });

    const totalAnswers = await prisma.brandSurveyAnswer.count({
      where: {
        question: {
          survey: {
            brandId: brandResult.brandId,
          },
        },
      },
    });

    console.log('📈 Toplam İstatistikler:');
    console.log(`   Surveys: ${totalSurveys}`);
    console.log(`   Questions: ${totalQuestions}`);
    console.log(`   Answers: ${totalAnswers}`);

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleSurveys();
