export class EmailAlreadyExistsError extends Error {
  status = 409;
  constructor(message = 'Sistemde kayıtlı mail adresi bulunuyor.') {
    super(message);
    this.name = 'EmailAlreadyExistsError';
  }
}

export class NotFoundError extends Error {
  status = 404;
  constructor(message = 'Kayıt bulunamadı.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  status = 400;
  constructor(message = 'Geçersiz istek.') {
    super(message);
    this.name = 'ValidationError';
  }
} 