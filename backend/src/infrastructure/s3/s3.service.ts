import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Config } from '../config/s3.config';
import { getPublicMediaBaseUrl, resolveMediaUrl } from '../config/media.config';
import logger from '../logger/logger';
import fs from 'fs';
export class S3Service {
  private s3Client: S3Client;
  private effectiveEndpoint: string;
  constructor() {
    // Container dışında çalışıyorsa (seed script gibi) localhost kullan
    // Container içinde çalışıyorsa minio hostname kullan
    // Seed script container dışında çalıştığı için her zaman localhost kontrolü yap
    let effectiveEndpoint = s3Config.endpoint;
    // Eğer endpoint minio:9000 içeriyorsa ve container dışındaysak localhost'a çevir.
    // ÖNEMLİ:
    // - S3_ENDPOINT env değişkeni açıkça set edildiyse asla override etme.
    // - Container içinde olduğumuzu hem DOCKER_CONTAINER env'i hem de /.dockerenv dosyasıyla tespit et.
    const isEndpointFromEnv = Boolean(process.env.S3_ENDPOINT);
    const isContainerEnvironment =
      process.env.DOCKER_CONTAINER === 'true' || fs.existsSync('/.dockerenv');
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (effectiveEndpoint.includes('minio:9000') && !isEndpointFromEnv) {
      // Seed script gibi container DIŞI process'lerde, development'ta localhost'a çevir.
      if (!isContainerEnvironment && isDevelopment) {
        effectiveEndpoint = effectiveEndpoint.replace(
          /minio:9000/g,
          'localhost:9000'
        );
        logger.info({
          message:
            'S3Service: Container dışında ve development ortamında çalışıldığı için localhost endpoint kullanılıyor',
          originalEndpoint: s3Config.endpoint,
          effectiveEndpoint,
          isContainerEnvironment,
          isDevelopment,
        });
      }
    }
    
    // Test ortamında endpoint kullanımını logla
    if (process.env.NODE_ENV === 'test') {
      logger.info({
        message: 'S3Service: Test ortamı endpoint yapılandırması',
        originalEndpoint: s3Config.endpoint,
        effectiveEndpoint,
        isEndpointFromEnv,
        isContainerEnvironment,
        dockerContainer: process.env.DOCKER_CONTAINER,
      });
    }
    
    this.effectiveEndpoint = effectiveEndpoint;
    
    const params = {
      endpoint: this.effectiveEndpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: s3Config.forcePathStyle,
    };
    
    // S3Client'ı başlat
    this.s3Client = new S3Client(params);
    
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
      // Mevcut bucket için de public policy ayarlamayı dene (hata olursa ignore et)
      this.setBucketPublicPolicy().catch(() => {
        // Policy zaten ayarlanmış olabilir veya yetki sorunu olabilir, kritik değil
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
          // Bucket oluşturulduktan sonra public read policy ekle
          await this.setBucketPublicPolicy();
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
   * Bucket'a public read policy ekler (MinIO için)
   */
  private async setBucketPublicPolicy(): Promise<void> {
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${s3Config.bucketName}/*`,
          },
        ],
      };
      await this.s3Client.send(new PutBucketPolicyCommand({
        Bucket: s3Config.bucketName,
        Policy: JSON.stringify(policy),
      }));
      logger.info({
        message: 'S3 bucket public read policy eklendi',
        bucketName: s3Config.bucketName,
      });
    } catch (error: any) {
      // Policy ayarlama hatası kritik değil, sadece log'la
      logger.warn({
        message: 'S3 bucket public policy ayarlanamadı (dosyalar pre-signed URL ile erişilebilir)',
        error: error instanceof Error ? error.message : String(error),
        bucketName: s3Config.bucketName,
      });
    }
  }
  /**
   * Yüklenen dosyanın nihai URL'ini oluşturur
   * @param fileName - MinIO bucket path (örn: users/profile/9f2a1c/avatar.jpg)
   * @returns Dosyanın erişilebilir tam URL'i (buildMediaUrl ile oluşturulur)
   */
  getFileUrl(fileName: string): string {
    // resolveMediaUrl kullanarak tam URL oluştur
    return resolveMediaUrl(fileName) || fileName;
  }
  /**
   * Dosyanın MinIO'da mevcut olup olmadığını kontrol eder
   * @param fileName - Dosya adı (örn: users/profile/9f2a1c/avatar.jpg)
   * @returns Dosya mevcutsa true, yoksa false
   */
  async fileExists(fileName: string): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: s3Config.bucketName,
        Key: fileName,
      }));
      return true;
    } catch (error: any) {
      const isNotFound = error.name === 'NotFound' 
        || error.name === 'NoSuchKey'
        || error.Code === 'NoSuchKey'
        || error.$metadata?.httpStatusCode === 404;
      
      if (isNotFound) {
        return false;
      }
      
      // Diğer hatalar için false döndür (bucket yoksa vs.)
      logger.warn({
        message: 'Dosya kontrolü sırasında hata (dosya yok sayılıyor)',
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
  /**
   * Buffer'dan dosya yükler
   * @param fileName - Dosya adı (örn: users/profile/9f2a1c/avatar.jpg)
   * @param buffer - Dosya içeriği
   * @param contentType - Dosya tipi (MIME type)
   * @returns Yüklenen dosyanın bucket path'i (tam URL değil, sadece path)
   * 
   * ÖNEMLİ: Bu metod sadece bucket path döndürür. Tam URL için getFileUrl() kullanın.
   * DB'de sadece path tutulur, response'larda resolveMediaUrl() ile tam URL'ye çevrilir.
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
      
      // Sadece bucket path döndür (tam URL değil)
      // DB'de sadece path tutulacak, response'larda resolveMediaUrl() ile tam URL'ye çevrilecek
      logger.info({
        message: 'Dosya başarıyla yüklendi',
        fileName,
        bucketPath: fileName,
        bucketName: s3Config.bucketName,
        fullUrl: this.getFileUrl(fileName), // Log için tam URL
      });
      
      return fileName; // Sadece path döndür
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
  /**
   * Tek bir dosyayı sil
   * @param filePath - Silinecek dosyanın path'i (örn: 'messages/threads/uuid/file.jpg')
   * @returns Başarılı olursa true
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: s3Config.bucketName,
        Key: filePath,
      });
      await this.s3Client.send(command);
      logger.info({
        message: 'Dosya başarıyla silindi',
        filePath,
        bucketName: s3Config.bucketName,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Dosya zaten yoksa hata verme (idempotent operation)
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        logger.warn({
          message: 'Dosya zaten silinmiş veya bulunamadı',
          filePath,
        });
        return; // Hata fırlatma, dosya zaten yok
      }
      logger.error({
        message: 'Dosya silme hatası',
        filePath,
        error: errorMessage,
        errorDetails: error.$metadata || error,
      });
      throw new Error(`Dosya silinemedi: ${errorMessage}`);
    }
  }

  /**
   * Belirtilen prefix altındaki tüm object key'lerini listeler
   * @param prefix - Prefix (örn: 'badges/custom/')
   * @returns Key listesi (örn: ['badges/custom/foo.png', 'badges/custom/bar.png'])
   */
  async listObjectKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: s3Config.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const response = await this.s3Client.send(listCommand);
      if (response.Contents?.length) {
        for (const obj of response.Contents) {
          if (obj.Key) keys.push(obj.Key);
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    return keys;
  }

  /**
   * Klasördeki tüm dosyaları recursive olarak sil
   * @param folderPrefix - Klasör prefix'i (örn: 'users/', 'posts/')
   * @returns Silinen dosya sayısı
   */
  async deleteFolder(folderPrefix: string): Promise<number> {
    let deletedCount = 0;
    let continuationToken: string | undefined;
    do {
      try {
        // Klasördeki tüm dosyaları listele
        const listCommand = new ListObjectsV2Command({
          Bucket: s3Config.bucketName,
          Prefix: folderPrefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000, // Batch size
        });
        const response = await this.s3Client.send(listCommand);
        if (response.Contents && response.Contents.length > 0) {
          // Batch delete (1000 dosya limit)
          const objectsToDelete = response.Contents.map((obj) => ({
            Key: obj.Key!,
          }));
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: s3Config.bucketName,
            Delete: {
              Objects: objectsToDelete,
              Quiet: true,
            },
          });
          const deleteResponse = await this.s3Client.send(deleteCommand);
          deletedCount += objectsToDelete.length;
          if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
            logger.warn({
              message: 'MinIO delete errors',
              errors: deleteResponse.Errors,
              folderPrefix,
            });
          }
        }
        continuationToken = response.NextContinuationToken;
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error({
          message: 'MinIO folder delete error',
          folderPrefix,
          error: errorMsg,
        });
        throw new Error(`Klasör silinemedi: ${errorMsg}`);
      }
    } while (continuationToken);
    return deletedCount;
  }
  /**
   * Tüm bucket içeriğini temizle
   * @returns Silinen dosya sayısı
   */
  async clearBucket(): Promise<number> {
    return this.deleteFolder('');
  }
}




