import { JWT } from 'google-auth-library';
import logger from '../logger/logger';
import path from 'path';
import fs from 'fs';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private gmail: any = null;
  private fromEmail: string;
  private fromName: string;
  private authClient: any = null;
  private isInitialized: boolean = false;

  constructor() {
    this.fromEmail = process.env.EMAIL_USER_TO_IMPERSONATE || 'info@tipbox.co';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Tipbox';

    // OAuth 2.0 ile Gmail API'yi asenkron olarak başlat
    this.initializeGmail().catch((error) => {
      logger.error({
        message: 'Failed to initialize Gmail API',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private async initializeGmail(): Promise<void> {
    try {
      // JSON dosyasının path'ini al (absolute path veya relative path)
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (!credentialsPath) {
        logger.warn({
          message: 'GOOGLE_APPLICATION_CREDENTIALS not configured. Email service will not work.',
        });
        return;
      }

      // Path'i resolve et (absolute path olarak)
      const keyFilePath = path.isAbsolute(credentialsPath)
        ? credentialsPath
        : path.resolve(process.cwd(), credentialsPath);

      // Dosyanın var olup olmadığını ve bir dosya olduğunu kontrol et
      if (!fs.existsSync(keyFilePath)) {
        throw new Error(
          `Google credentials file not found at path: ${keyFilePath}. ` +
          `Please check GOOGLE_APPLICATION_CREDENTIALS environment variable.`
        );
      }

      // Path'in bir dosya olduğunu kontrol et (dizin değil)
      const stats = fs.statSync(keyFilePath);
      if (!stats.isFile()) {
        throw new Error(
          `GOOGLE_APPLICATION_CREDENTIALS path points to a directory, not a file: ${keyFilePath}. ` +
          `Please provide the full path to the JSON credentials file.`
        );
      }

      // Dosyanın okunabilir olduğunu kontrol et
      try {
        fs.accessSync(keyFilePath, fs.constants.R_OK);
      } catch (accessError) {
        throw new Error(
          `Google credentials file is not readable: ${keyFilePath}. ` +
          `Please check file permissions.`
        );
      }

      logger.info({
        message: 'Google credentials file validated',
        path: keyFilePath,
      });

      // JSON dosyasını oku ve parse et
      let keyData: any;
      try {
        const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
        keyData = JSON.parse(keyFileContent);
        
        // JSON dosyasının geçerli bir service account key olduğunu kontrol et
        if (!keyData.private_key || !keyData.client_email) {
          throw new Error('Invalid Google service account key file. Missing required fields.');
        }
      } catch (parseError) {
        throw new Error(
          `Failed to read or parse Google credentials file: ${keyFilePath}. ` +
          `Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }

      const userToImpersonate = this.fromEmail;

      // JWT Client oluştur - Domain-wide delegation için subject parametresi
      // keyFile yerine key kullanarak dosya okuma sorunlarını önle
      this.authClient = new JWT({
        email: keyData.client_email,
        key: keyData.private_key,
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
        subject: userToImpersonate, // Impersonation için
      });

      // Gmail API'yi lazy load et (memory problemi için)
      const { google } = await import('googleapis');
      this.gmail = google.gmail({ version: 'v1', auth: this.authClient });

      this.isInitialized = true;

      logger.info({
        message: 'Gmail API initialized successfully with OAuth 2.0',
        fromEmail: this.fromEmail,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize Gmail API with OAuth 2.0',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Hata durumunda da initialize edildi olarak işaretle
      // Email gönderirken tekrar denenecek
      this.isInitialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.gmail) {
      await this.initializeGmail();
    }

    // Token'un süresi dolmuş olabilir, yenile
    if (this.authClient) {
      try {
        await this.authClient.getAccessToken();
      } catch (error) {
        logger.warn({
          message: 'Failed to refresh access token, reinitializing Gmail API',
          error: error instanceof Error ? error.message : String(error),
        });
        await this.initializeGmail();
      }
    }
  }

  private createEmailMessage(options: EmailOptions): string {
    const message = [
      `From: "${this.fromName}" <${this.fromEmail}>`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      options.html,
    ].join('\n');

    // Base64 encode (RFC 2045)
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    await this.ensureInitialized();

    if (!this.gmail) {
      throw new Error('Gmail API not initialized. Check GOOGLE_APPLICATION_CREDENTIALS configuration.');
    }

    try {
      const rawMessage = this.createEmailMessage(options);

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMessage,
        },
      });

      logger.info({
        message: 'Email sent successfully via Gmail API',
        to: options.to,
        subject: options.subject,
        messageId: response.data.id,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to send email via Gmail API',
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Doğrulama Kodu</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
          <h2 style="color: #333; margin-top: 0;">Email Doğrulama</h2>
          <p>Merhaba,</p>
          <p>Tipbox hesabınızı oluşturmak için email adresinizi doğrulamanız gerekmektedir.</p>
          <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>Bu kodu kullanarak email doğrulama işlemini tamamlayabilirsiniz.</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Bu kod 10 dakika geçerlidir. Eğer bu işlemi siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.
          </p>
          <p style="color: #666; font-size: 12px;">
            Saygılarımızla,<br>
            Tipbox Ekibi
          </p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Tipbox Email Dogrulama Kodu',
      html,
    });
  }

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Şifre Sıfırlama Kodu</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
          <h2 style="color: #333; margin-top: 0;">Şifre Sıfırlama</h2>
          <p>Merhaba,</p>
          <p>Tipbox hesabınızın şifresini sıfırlamak için aşağıdaki kodu kullanabilirsiniz.</p>
          <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>Bu kodu kullanarak şifre sıfırlama işlemini tamamlayabilirsiniz.</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Bu kod 10 dakika geçerlidir. Eğer bu işlemi siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.
          </p>
          <p style="color: #666; font-size: 12px;">
            Saygılarımızla,<br>
            Tipbox Ekibi
          </p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Tipbox Şifre Sıfırlama Kodu',
      html,
    });
  }
}
