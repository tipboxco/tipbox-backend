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
    this.checkAndCreateBucket().catch((error) => {
      logger.error({
        message: 'S3 bucket kontrolü/oluşturma hatası',
        error: error instanceof Error ? error.message : String(error),
        bucketName: s3Config.bucketName,
      });
    });
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
      
      logger.info({
        message: 'S3 bucket mevcut',
        bucketName: s3Config.bucketName,
      });
    } catch (error: any) {
      // Bucket yoksa oluştur
      const isNotFound = error.name === 'NotFound' 
        || error.name === 'NoSuchBucket'
        || error.Code === 'NoSuchBucket'
        || error.$metadata?.httpStatusCode === 404;
      
      if (isNotFound) {
        try {
          await this.s3Client.send(new CreateBucketCommand({
            Bucket: s3Config.bucketName,
          }));
          
          logger.info({
            message: 'S3 bucket oluşturuldu',
            bucketName: s3Config.bucketName,
          });
        } catch (createError: any) {
          // Bucket zaten oluşturulmuşsa bu bir hata değil
          const isAlreadyOwned = createError.name === 'BucketAlreadyOwnedByYou'
            || createError.Code === 'BucketAlreadyOwnedByYou'
            || createError.message?.includes('already own it');
          
          if (isAlreadyOwned) {
            logger.info({
              message: 'S3 bucket zaten mevcut (başka bir instance tarafından oluşturulmuş)',
              bucketName: s3Config.bucketName,
            });
          } else {
            logger.error({
              message: 'S3 bucket oluşturma hatası',
              error: createError instanceof Error ? createError.message : String(createError),
              bucketName: s3Config.bucketName,
            });
            throw new Error(`S3 bucket oluşturulamadı: ${s3Config.bucketName}`);
          }
        }
      } else {
        logger.error({
          message: 'S3 bucket kontrolü hatası',
          error: error instanceof Error ? error.message : String(error),
          bucketName: s3Config.bucketName,
          errorDetails: error.$metadata || error,
        });
        throw new Error(`S3 bucket kontrolü yapılamadı: ${error.message || String(error)}`);
      }
    }
  }

  /**
   * Yüklenen dosyanın nihai URL'ini oluşturur
   * @param fileName - Dosya adı
   * @returns Dosyanın erişilebilir URL'i
   */
  getFileUrl(fileName: string): string {
    // Development ortamında localhost kullan (tarayıcıdan erişim için)
    const endpoint = process.env.NODE_ENV === 'development' 
      ? process.env.S3_ENDPOINT?.replace('minio:9000', 'localhost:9000') || 'http://localhost:9000'
      : s3Config.endpoint;
    
    return `${endpoint}/${s3Config.bucketName}/${fileName}`;
  }

  /**
   * Buffer'dan dosya yükler
   * @param fileName - Dosya adı
   * @param buffer - Dosya içeriği
   * @param contentType - Dosya tipi (MIME type)
   * @returns Yüklenen dosyanın URL'i
   */
  async uploadFile(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
    try {
      // Önce bucket'ın var olduğundan emin ol
      await this.checkAndCreateBucket();
      
      const command = new PutObjectCommand({
        Bucket: s3Config.bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      
      const fileUrl = this.getFileUrl(fileName);
      logger.info({
        message: 'Dosya başarıyla yüklendi',
        fileName,
        fileUrl,
        bucketName: s3Config.bucketName,
      });
      
      return fileUrl;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isBucketError = error.name === 'NoSuchBucket' 
        || error.Code === 'NoSuchBucket'
        || error.$metadata?.httpStatusCode === 404;
      
      logger.error({
        message: 'Dosya yükleme hatası',
        error: errorMessage,
        fileName,
        bucketName: s3Config.bucketName,
        errorDetails: error.$metadata || error,
        isBucketError,
      });
      
      if (isBucketError) {
        throw new Error(`S3 bucket bulunamadı: ${s3Config.bucketName}. Lütfen bucket'ın oluşturulduğundan emin olun.`);
      }
      
      throw new Error(`Dosya yüklenemedi: ${errorMessage}`);
    }
  }
}
