import 'dotenv/config';
import app from './app';
import logger from '../infrastructure/logger/logger';
console.log('JWT_SECRET:', process.env.JWT_SECRET);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ message: `Server running on port ${PORT}` });
}); 