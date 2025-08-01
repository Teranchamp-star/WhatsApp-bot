const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🟢 WhatsApp bot is running!');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

// Your bot code starts here
require('./bot'); // Or change to your actual bot filename if different
