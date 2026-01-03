import { Request } from 'express';
import { File } from 'multer';

/**
 * Multer type extension for Express Request
 * Adds file and files properties to Request interface
 */
declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Single uploaded file (when using single() middleware)
     */
    file?: File;
    
    /**
     * Multiple uploaded files (when using array() or fields() middleware)
     * Can be an array or an object with field names as keys
     */
    files?: File[] | { [fieldname: string]: File[] };
  }
}

export {};


