import { MinioStorageService, MinioStorageOptions } from "./service"

/**
 * MinIO Storage Plugin for Medusa.js
 * 
 * Bu plugin, media dosyalarını MinIO sunucusuna yüklemek için kullanılır.
 */
const minioStoragePlugin = (options: MinioStorageOptions) => {
  return {
    name: "minio-storage",
  }
}

export default minioStoragePlugin
export { MinioStorageService, MinioStorageOptions }

