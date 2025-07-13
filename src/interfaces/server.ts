import app from './app';
import logger from '../infrastructure/logger/logger';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ message: `Server running on port ${PORT}` });
}); 