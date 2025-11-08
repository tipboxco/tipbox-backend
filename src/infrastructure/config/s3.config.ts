import dotenv from 'dotenv';

dotenv.config();

export const s3Config = {
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  bucketName: process.env.S3_BUCKET_NAME || 'tipbox-media',
  region: process.env.S3_REGION || 'eu-central-1',
  accessKeyId: process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin',
  secretAccessKey: process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin123',
  forcePathStyle: true, // MinIO için gerekli
} as const;

export type S3Config = typeof s3Config;
