// Index file for Vercel Serverless Functions
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const apiHandler = require('./server');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic route to check if API is running
app.get('/', (req, res) => {
  res.json({ status: 'API is running' });
});

// Use the main API handler
app.use('/', apiHandler);

// Export the serverless handler
module.exports = serverless(app); 