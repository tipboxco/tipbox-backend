import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    
    http: {
      
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  featureFlags: {
    admin: {
      media: true,
    },
  },
  plugins: [],
  modules: [
    {
      resolve: "./src/modules/brand",
    },
    {
      resolve: "./src/modules/webhook-manager",
    },
    {
      resolve: "./src/modules/sync-manager",
    },
    // MinIO için S3-compatible File Module yapılandırması
    {
      resolve: "@medusajs/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-s3",
            id: "s3",
            options: {
              // MinIO endpoint (Docker içinde: minio:9000, local: localhost:9000)
              endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
              // Public URL için external endpoint - bucket dahil!
              // Format: http://localhost:9000/{bucket}
              file_url: `${process.env.S3_ENDPOINT_EXTERNAL || process.env.S3_ENDPOINT || "http://localhost:9000"}/${process.env.S3_BUCKET_NAME || "tipbox-medusa"}`,
              access_key_id: process.env.MINIO_ROOT_USER || "minioadmin",
              secret_access_key: process.env.MINIO_ROOT_PASSWORD || "minioadmin123",
              region: process.env.S3_REGION || "eu-central-1",
              bucket: process.env.S3_BUCKET_NAME || "tipbox-medusa",
              // Dosyaların yükleneceği klasör prefix'i
              prefix: "media",
              // MinIO için gerekli ek ayarlar
              additional_client_config: {
                forcePathStyle: true, // MinIO için gerekli
              },
            },
          },
        ],
      },
    },
  ],
})
