import jwt, { JwtHeader, JwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import logger from '../logger/logger';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

// AUTH0_DOMAIN zorunlu, AUTH0_AUDIENCE opsiyonel (bazı token'larda olmayabilir)
if (!AUTH0_DOMAIN) {
  throw new Error('AUTH0_DOMAIN must be set');
}

let client: jwksClient.JwksClient | null = null;

if (AUTH0_DOMAIN) {
  client = jwksClient({
    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 86400000, // 24 saat
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  });
}

function getKey(header: JwtHeader, callback: (err: Error | null, key?: string) => void) {
  if (!client) {
    return callback(new Error('JWKS client not initialized'));
  }
  
  client.getSigningKey(header.kid as string, function (err, key) {
    if (err) {
      logger.warn({
        message: 'JWKS signing key alınamadı',
        error: err.message,
        kid: header.kid
      });
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export function verifyAuth0Jwt(token: string): Promise<JwtPayload | null> {
  return new Promise((resolve) => {
    if (!AUTH0_DOMAIN) {
      logger.warn('AUTH0_DOMAIN not set, skipping Auth0 token verification');
      return resolve(null);
    }

    // Token'ın JWT formatında olup olmadığını kontrol et
    const parts = token.split('.');
    if (parts.length !== 3) {
      logger.debug({
        message: 'Token JWT formatında değil (Auth0)',
        tokenLength: token.length
      });
      return resolve(null);
    }

    // JWT payload'ı decode et (doğrulama yapmadan)
    let decodedToken: any;
    try {
      decodedToken = jwt.decode(token, { complete: true });
      if (!decodedToken || typeof decodedToken !== 'object') {
        logger.debug('Token decode edilemedi (Auth0)');
        return resolve(null);
      }
    } catch (decodeError) {
      logger.debug({
        message: 'Token decode hatası (Auth0)',
        error: decodeError instanceof Error ? decodeError.message : String(decodeError)
      });
      return resolve(null);
    }

    // Issuer kontrolü
    const issuer = decodedToken.payload?.iss;
    const expectedIssuer = `https://${AUTH0_DOMAIN}/`;
    if (issuer !== expectedIssuer) {
      logger.debug({
        message: 'Token issuer eşleşmedi (Auth0)',
        expected: expectedIssuer,
        actual: issuer
      });
      return resolve(null);
    }

    // Verify options - audience opsiyonel
    const verifyOptions: jwt.VerifyOptions = {
      issuer: expectedIssuer,
      algorithms: ['RS256'],
    };

    // Audience varsa ekle, yoksa kontrol etme
    if (AUTH0_AUDIENCE) {
      verifyOptions.audience = AUTH0_AUDIENCE;
    } else {
      // Audience yoksa, token'daki audience'ı kontrol et (opsiyonel)
      logger.debug('AUTH0_AUDIENCE not set, skipping audience verification');
    }

    jwt.verify(
      token,
      getKey,
      verifyOptions,
      (err, decoded) => {
        if (err) {
          // Hata detaylarını logla
          logger.debug({
            message: 'Auth0 token doğrulama hatası',
            error: err.message,
            name: err.name,
            audience: AUTH0_AUDIENCE || 'not set',
            tokenAudience: decodedToken.payload?.aud,
            tokenIssuer: decodedToken.payload?.iss
          });
          return resolve(null);
        }
        
        logger.debug({
          message: 'Auth0 token başarıyla doğrulandı',
          sub: (decoded as JwtPayload)?.sub,
          aud: (decoded as JwtPayload)?.aud
        });
        
        resolve(decoded as JwtPayload);
      }
    );
  });
} 