import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Config } from '../config/s3.config';
import logger from '../logger/logger';

export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: s3Config.forcePathStyle,
    });

    // Servis başladığında bucket'ı kontrol et ve oluştur
    // this.checkAndCreateBucket().catch((error) => {
    //   logger.error('S3 bucket kontrolü/oluşturma hatası:', error);
    // });
  }

  /**
   * Dosya yükleme için pre-signed URL oluşturur
   * @param fileName - Yüklenecek dosyanın adı
   * @param fileType - Dosya tipi (MIME type)
   * @returns Pre-signed URL
   */
  async generatePresignedUploadUrl(fileName: string, fileType: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: s3Config.bucketName,
        Key: fileName,
        ContentType: fileType,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 900, // 15 dakika
      });

      logger.info(`Pre-signed URL oluşturuldu: ${fileName}`);
      return presignedUrl;
    } catch (error) {
      logger.error('Pre-signed URL oluşturma hatası:', error);
      throw new Error('Dosya yükleme URL\'si oluşturulamadı');
    }
  }

  /**
   * Bucket'ın var olup olmadığını kontrol eder ve yoksa oluşturur
   */
  async checkAndCreateBucket(): Promise<void> {
    try {
      // Bucket'ın var olup olmadığını kontrol et
      await this.s3Client.send(new HeadBucketCommand({
        Bucket: s3Config.bucketName,
      }));
      
      logger.info(`S3 bucket mevcut: ${s3Config.bucketName}`);
    } catch (error: any) {
      // Bucket yoksa oluştur
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        try {
          await this.s3Client.send(new CreateBucketCommand({
            Bucket: s3Config.bucketName,
          }));
          
          logger.info(`S3 bucket oluşturuldu: ${s3Config.bucketName}`);
        } catch (createError) {
          logger.error('S3 bucket oluşturma hatası:', createError);
          throw new Error('S3 bucket oluşturulamadı');
        }
      } else {
        logger.error('S3 bucket kontrolü hatası:', error);
        throw new Error('S3 bucket kontrolü yapılamadı');
      }
    }
  }

  /**
   * Yüklenen dosyanın nihai URL'ini oluşturur
   * @param fileName - Dosya adı
   * @returns Dosyanın erişilebilir URL'i
   */
  getFileUrl(fileName: string): string {
    return `${s3Config.endpoint}/${s3Config.bucketName}/${fileName}`;
  }
}
