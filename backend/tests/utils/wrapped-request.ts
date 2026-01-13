import request, { SuperTest, Test } from 'supertest';
import { testLogger } from './test-logger';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const baseRequest = request(BASE_URL);

interface WrappedRequest {
  get: (url: string) => Test;
  post: (url: string) => Test;
  put: (url: string) => Test;
  patch: (url: string) => Test;
  delete: (url: string) => Test;
}

function wrapRequest(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string): Test {
  const startTime = Date.now();
  const test = baseRequest[method](url);
  
  // Response'u intercept et
  const originalEnd = test.end.bind(test);
  test.end = function(callback?: (err: any, res: any) => void) {
    return originalEnd((err: any, res: any) => {
      const duration = Date.now() - startTime;
      
      // Test logger'a servis çağrısını logla
      testLogger.logServiceCall(
        method.toUpperCase(),
        url,
        res?.statusCode,
        duration,
        undefined, // request body
        res?.body
      );
      
      if (callback) {
        callback(err, res);
      }
    });
  };
  
  return test;
}

export const wrappedRequest: WrappedRequest = {
  get: (url: string) => wrapRequest('get', url),
  post: (url: string) => wrapRequest('post', url),
  put: (url: string) => wrapRequest('put', url),
  patch: (url: string) => wrapRequest('patch', url),
  delete: (url: string) => wrapRequest('delete', url),
};

export default wrappedRequest;

