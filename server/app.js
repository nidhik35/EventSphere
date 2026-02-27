const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const eventsRouter = require('./routes/events');
const registrationsRouter = require('./routes/registrations');

const app = express();

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error('MONGO_URL environment variable is not set.');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// API routes
app.use('/events', eventsRouter);
app.use('/', registrationsRouter);

// Serve static frontend
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;

