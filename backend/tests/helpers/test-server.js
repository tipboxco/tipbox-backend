const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Test server çalışıyor!' });
});

app.get('/api-docs', (req, res) => {
  res.json({ message: 'Swagger endpoint çalışıyor!' });
});

app.listen(PORT, () => {
  console.log(`Test server ${PORT} portunda çalışıyor`);
});
