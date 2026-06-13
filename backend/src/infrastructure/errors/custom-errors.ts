import { ErrorCode } from './error-codes.enum';

export class EmailAlreadyExistsError extends Error {
  status = 409;
  code = ErrorCode.EMAIL_ALREADY_EXISTS;
  constructor(message = 'Sistemde kayıtlı mail adresi bulunuyor.') {
    super(message);
    this.name = 'EmailAlreadyExistsError';
  }
}

export class NotFoundError extends Error {
  status = 404;
  code = ErrorCode.NOT_FOUND;
  constructor(message = 'Kayıt bulunamadı.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  status = 400;
  code = ErrorCode.VALIDATION_ERROR;
  constructor(message = 'Geçersiz istek.') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  status = 401;
  code = ErrorCode.UNAUTHORIZED;
  constructor(message = 'Yetkisiz erişim.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  status = 403;
  code = ErrorCode.FORBIDDEN;
  constructor(message = 'Bu işlem için yetkiniz yok.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class DatabaseError extends Error {
  status = 500;
  code = ErrorCode.DATABASE_ERROR;
  constructor(message = 'Veritabanı hatası oluştu.') {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class RedisConnectionError extends Error {
  status = 503;
  code = ErrorCode.REDIS_CONNECTION_ERROR;
  constructor(message = 'Önbellek bağlantısı başarısız.') {
    super(message);
    this.name = 'RedisConnectionError';
  }
}

export class FileUploadError extends Error {
  status = 400;
  code = ErrorCode.FILE_UPLOAD_ERROR;
  constructor(message = 'Dosya yükleme hatası.') {
    super(message);
    this.name = 'FileUploadError';
  }
}

export class TokenExpiredError extends Error {
  status = 401;
  code = ErrorCode.TOKEN_EXPIRED;
  constructor(message = 'Token süresi dolmuş.') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class InsufficientBalanceError extends Error {
  status = 400;
  code = ErrorCode.INSUFFICIENT_BALANCE;
  constructor(message = 'Yetersiz bakiye.') {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export class RateLimitError extends Error {
  status = 429;
  code = ErrorCode.RATE_LIMIT_EXCEEDED;
  constructor(message = 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends Error {
  status = 503;
  code = ErrorCode.EXTERNAL_SERVICE_ERROR;
  constructor(message = 'Harici servis hatası.') {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

/** Thirdweb SDK yapılandırılmamış; wallet oluşturmak için Thirdweb gerekli. */
export class ThirdwebNotConfiguredError extends Error {
  status = 503;
  code = ErrorCode.THIRDWEB_NOT_CONFIGURED;
  constructor(message = 'Wallet oluşturmak için Thirdweb yapılandırması gerekli.') {
    super(message);
    this.name = 'ThirdwebNotConfiguredError';
  }
}

/** Thirdweb wallet connect/oturum alınamadı; kullanıcı önce Thirdweb ile cüzdan bağlamalı. */
export class ThirdwebWalletAuthFailedError extends Error {
  status = 400;
  code = ErrorCode.THIRDWEB_WALLET_AUTH_FAILED;
  constructor(message = 'Cüzdan oluşturmak için önce Thirdweb ile wallet connect yapılmalı.') {
    super(message);
    this.name = 'ThirdwebWalletAuthFailedError';
  }
}

// ============================================================================
// Provider-agnostic wallet errors (use these in new code)
// ============================================================================

/** Active wallet provider is not configured (missing API keys / credentials). */
export class WalletProviderNotConfiguredError extends Error {
  status = 503;
  code = ErrorCode.WALLET_PROVIDER_NOT_CONFIGURED;
  constructor(message = 'Wallet provider yapılandırılmamış. Gerekli ortam değişkenlerini kontrol edin.') {
    super(message);
    this.name = 'WalletProviderNotConfiguredError';
  }
}

/** Active wallet provider could not authenticate / create a wallet for the user. */
export class WalletProviderAuthFailedError extends Error {
  status = 400;
  code = ErrorCode.WALLET_PROVIDER_AUTH_FAILED;
  constructor(message = 'Wallet provider ile kimlik doğrulama başarısız oldu.') {
    super(message);
    this.name = 'WalletProviderAuthFailedError';
  }
}