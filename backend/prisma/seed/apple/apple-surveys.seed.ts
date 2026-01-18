import { prisma, TRUST_USER_IDS } from '../types';
import { randomUUID } from 'crypto';

interface QuestionConfig {
  questionText: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT';
  options?: string[]; // For choice questions
}

interface SurveyConfig {
  title: string;
  description: string;
  questions: QuestionConfig[];
}

/**
 * Apple surveys oluştur - 5 adet gerçek anket ve kullanıcı katılımları
 */
export async function seedAppleSurveys(brandId: string): Promise<{
  surveys: Array<{ id: string; title: string; questionCount: number; answerCount: number }>;
}> {
  console.log('📊 [seed] Apple surveys');

  // Apple brand'ı bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!appleBrand) {
    throw new Error('Apple brand not found. Please run apple-brand seed first.');
  }

  // Survey configs
  const surveyConfigs: SurveyConfig[] = [
    {
      title: 'iPhone User Experience Survey 2024',
      description:
        'Share your experience with iPhone devices. Help us understand what features matter most to you and how we can improve.',
      questions: [
        {
          questionText: 'Which iPhone model do you currently use?',
          type: 'SINGLE_CHOICE',
          options: ['iPhone 17 Pro', 'iPhone 17', 'iPhone 16e', 'iPhone 15 Pro', 'iPhone 15', 'Older model'],
        },
        {
          questionText: 'What is the most important feature for you?',
          type: 'SINGLE_CHOICE',
          options: ['Camera quality', 'Battery life', 'Performance', 'Design', 'Ecosystem integration'],
        },
        {
          questionText: 'How satisfied are you with your iPhone?',
          type: 'SINGLE_CHOICE',
          options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'],
        },
        {
          questionText: 'What would you like to see improved in future iPhones?',
          type: 'TEXT',
        },
      ],
    },
    {
      title: 'MacBook Productivity Survey',
      description:
        'Tell us about your MacBook usage and how it helps you be productive. Your feedback helps shape future products.',
      questions: [
        {
          questionText: 'Which MacBook model do you use?',
          type: 'SINGLE_CHOICE',
          options: [
            'MacBook Pro 16" M4',
            'MacBook Pro 14" M4',
            'MacBook Air 15" M3',
            'MacBook Air 13" M3',
            'Older model',
          ],
        },
        {
          questionText: 'What do you primarily use your MacBook for?',
          type: 'MULTIPLE_CHOICE',
          options: ['Software development', 'Design & creative work', 'Business & productivity', 'Gaming', 'Education'],
        },
        {
          questionText: 'How would you rate the battery life?',
          type: 'SINGLE_CHOICE',
          options: ['Excellent', 'Good', 'Average', 'Poor', 'Very poor'],
        },
        {
          questionText: 'What features would you like in the next MacBook?',
          type: 'TEXT',
        },
      ],
    },
    {
      title: 'iPad Usage Patterns Survey',
      description:
        'Help us understand how you use your iPad. Whether for work, creativity, or entertainment, your input is valuable.',
      questions: [
        {
          questionText: 'Which iPad model do you own?',
          type: 'SINGLE_CHOICE',
          options: [
            'iPad Pro 12.9" M4',
            'iPad Pro 11" M4',
            'iPad Air 13" M2',
            'iPad Air 11" M2',
            'iPad 10th Gen',
            'Other',
          ],
        },
        {
          questionText: 'How do you primarily use your iPad?',
          type: 'MULTIPLE_CHOICE',
          options: ['Note-taking', 'Drawing & design', 'Video editing', 'Reading & media', 'Productivity apps'],
        },
        {
          questionText: 'Do you use Apple Pencil?',
          type: 'SINGLE_CHOICE',
          options: ['Yes, regularly', 'Yes, occasionally', 'No'],
        },
        {
          questionText: 'What apps are essential for your iPad workflow?',
          type: 'TEXT',
        },
      ],
    },
    {
      title: 'Apple Watch Health & Fitness Survey',
      description:
        'Share how Apple Watch helps you stay healthy and active. Your experiences help improve health features.',
      questions: [
        {
          questionText: 'Which Apple Watch model do you wear?',
          type: 'SINGLE_CHOICE',
          options: ['Apple Watch Series 11', 'Apple Watch Ultra 3', 'Apple Watch SE 3', 'Older model'],
        },
        {
          questionText: 'Which health features do you use most?',
          type: 'MULTIPLE_CHOICE',
          options: [
            'Heart rate monitoring',
            'Workout tracking',
            'Sleep tracking',
            'Activity rings',
            'ECG',
            'Blood oxygen',
          ],
        },
        {
          questionText: 'How often do you exercise?',
          type: 'SINGLE_CHOICE',
          options: ['Daily', '3-4 times a week', '1-2 times a week', 'Rarely'],
        },
        {
          questionText: 'What health features would you like to see added?',
          type: 'TEXT',
        },
      ],
    },
    {
      title: 'Apple Ecosystem Integration Survey',
      description:
        'Tell us about your experience using multiple Apple devices together. How does the ecosystem enhance your workflow?',
      questions: [
        {
          questionText: 'How many Apple devices do you own?',
          type: 'SINGLE_CHOICE',
          options: ['1', '2', '3', '4', '5 or more'],
        },
        {
          questionText: 'Which ecosystem features do you use?',
          type: 'MULTIPLE_CHOICE',
          options: [
            'Handoff',
            'AirDrop',
            'Universal Clipboard',
            'iCloud sync',
            'Continuity Camera',
            'Apple Pay',
          ],
        },
        {
          questionText: 'How important is ecosystem integration to you?',
          type: 'SINGLE_CHOICE',
          options: ['Very important', 'Important', 'Somewhat important', 'Not very important', 'Not important'],
        },
        {
          questionText: 'What improvements would you like to see in ecosystem features?',
          type: 'TEXT',
        },
      ],
    },
  ];

  const today = new Date();
  const createdSurveys: Array<{ id: string; title: string; questionCount: number; answerCount: number }> = [];

  // Her survey için
  for (const surveyConfig of surveyConfigs) {
    // Survey oluştur veya bul
    let survey = await prisma.brandSurvey.findFirst({
      where: {
        brandId: brandId,
        title: surveyConfig.title,
      },
    });

    if (!survey) {
      survey = await prisma.brandSurvey.create({
        data: {
          id: randomUUID(),
          brandId: brandId,
          title: surveyConfig.title,
          description: surveyConfig.description,
          startsAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 gün önce başladı
          endsAt: new Date(today.getTime() + 23 * 24 * 60 * 60 * 1000), // 23 gün sonra bitiyor
        },
      });
      console.log(`  ✅ Survey oluşturuldu: ${surveyConfig.title}`);
    } else {
      console.log(`  ✅ Survey zaten var: ${surveyConfig.title}`);
    }

    // Questions oluştur
    const createdQuestions: string[] = [];
    for (const questionConfig of surveyConfig.questions) {
      let question = await prisma.brandSurveyQuestion.findFirst({
        where: {
          surveyId: survey.id,
          questionText: questionConfig.questionText,
        },
      });

      if (!question) {
        question = await prisma.brandSurveyQuestion.create({
          data: {
            id: randomUUID(),
            surveyId: survey.id,
            questionText: questionConfig.questionText,
            type: questionConfig.type,
          },
        });
      }

      createdQuestions.push(question.id);
    }

    // Kullanıcı katılımları oluştur (farklı sayılarda)
    // Her survey için farklı sayıda kullanıcı katılımı
    const participationCounts = [15, 23, 31, 19, 27]; // Her survey için farklı sayı
    const surveyIndex = surveyConfigs.indexOf(surveyConfig);
    const participationCount = participationCounts[surveyIndex] || 20;

    // Tüm kullanıcıları al (TRUST_USER_IDS + diğer kullanıcılar)
    const allUsers = await prisma.user.findMany({
      take: 50, // İlk 50 kullanıcıyı al
    });

    let answerCount = 0;
    const selectedUsers = allUsers.slice(0, Math.min(participationCount, allUsers.length));

    for (const user of selectedUsers) {
      // Her kullanıcı survey'deki tüm sorulara cevap verir
      for (const questionId of createdQuestions) {
        const question = await prisma.brandSurveyQuestion.findUnique({
          where: { id: questionId },
        });

        if (!question) continue;

        // Zaten cevap vermiş mi kontrol et
        const existingAnswer = await prisma.brandSurveyAnswer.findUnique({
          where: {
            questionId_userId: {
              questionId: questionId,
              userId: user.id,
            },
          },
        });

        if (existingAnswer) continue;

        // Cevap oluştur
        let answerText = '';

        if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
          // Options'dan rastgele seç
          const options = surveyConfig.questions.find((q) => q.questionText === question.questionText)?.options || [];
          if (options.length > 0) {
            if (question.type === 'MULTIPLE_CHOICE') {
              // Birden fazla seçenek
              const selectedOptions = options
                .sort(() => Math.random() - 0.5)
                .slice(0, Math.floor(Math.random() * 3) + 1);
              answerText = selectedOptions.join(', ');
            } else {
              // Tek seçenek
              answerText = options[Math.floor(Math.random() * options.length)];
            }
          }
        } else {
          // TEXT
          const textAnswers = [
            'Great product, very satisfied with the quality.',
            'Could use some improvements in battery life.',
            'Love the design and user experience.',
            'Excellent performance, highly recommend.',
            'Good overall, but some features need work.',
          ];
          answerText = textAnswers[Math.floor(Math.random() * textAnswers.length)];
        }

        await prisma.brandSurveyAnswer.create({
          data: {
            id: randomUUID(),
            questionId: questionId,
            userId: user.id,
            answerText: answerText,
          },
        });

        answerCount++;
      }
    }

    console.log(`    ✅ ${createdQuestions.length} soru, ${answerCount} cevap oluşturuldu`);

    createdSurveys.push({
      id: survey.id,
      title: survey.title,
      questionCount: createdQuestions.length,
      answerCount: answerCount,
    });
  }

  console.log(`\n✅ Toplam ${createdSurveys.length} survey oluşturuldu`);

  return {
    surveys: createdSurveys,
  };
}
