const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = 3000;
const prisma = new PrismaClient();

// JSON parsing middleware
app.use(express.json());

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tipbox API',
      version: '1.0.0',
      description: 'Tipbox servisleri için API dokümantasyonu',
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: 'Local' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./swagger-server.js'], // Bu dosyadaki swagger yorumlarını oku
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Test endpoint'leri
/**
 * @swagger
 * /test/users:
 *   post:
 *     summary: Test kullanıcısı oluştur
 *     description: Database'e test kullanıcısı yazar
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 example: "Test Kullanıcı"
 *               email:
 *                 type: string
 *                 example: "test@example.com"
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
app.post('/test/users', async (req, res) => {
  try {
    const { displayName, email } = req.body;
    
    if (!displayName || !email) {
      return res.status(400).json({
        success: false,
        message: 'DisplayName ve email alanları zorunludur'
      });
    }

    // Database'e yazma işlemi - User ve Profile birlikte oluştur
    const user = await prisma.user.create({
      data: {
        email,
        profile: {
          create: {
            displayName
          }
        }
      },
      include: {
        profile: true
      }
    });

    res.json({
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu',
      data: user
    });
  } catch (error) {
    console.error('Kullanıcı oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı oluşturulurken hata oluştu',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /test/users:
 *   get:
 *     summary: Tüm kullanıcıları listele
 *     description: Database'den tüm kullanıcıları okur
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Kullanıcılar başarıyla listelendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
app.get('/test/users', async (req, res) => {
  try {
    // Database'den okuma işlemi
    const users = await prisma.user.findMany({
      take: 10, // İlk 10 kullanıcıyı al
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        profile: true
      }
    });

    res.json({
      success: true,
      message: 'Kullanıcılar başarıyla listelendi',
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Kullanıcı listeleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcılar listelenirken hata oluştu',
      error: error.message
    });
  }
});

// Swagger spec endpoint'i
app.get('/api-docs/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.json({ 
    message: 'Tipbox Backend API çalışıyor!',
    swagger: 'http://localhost:3000/api-docs',
    endpoints: {
      'POST /test/users': 'Test kullanıcısı oluştur',
      'GET /test/users': 'Tüm kullanıcıları listele'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Tipbox Backend ${PORT} portunda çalışıyor`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});
