// Simple test to check if Railway is working
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <h1>RGMN Functions - Railway Test</h1>
    <p>Port: ${port}</p>
    <p>NODE_ENV: ${process.env.NODE_ENV}</p>
    <p>SHOPIFY_API_KEY: ${process.env.SHOPIFY_API_KEY ? 'Set' : 'Not set'}</p>
    <p>DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}</p>
    <p>Time: ${new Date().toISOString()}</p>
  `);
});

app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});
