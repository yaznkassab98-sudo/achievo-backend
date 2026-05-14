const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(url => url.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use(limiter);

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/cities', require('./routes/cities'));
app.use('/api/businesses', require('./routes/businesses'));
app.use('/api/challenges', require('./routes/challenges'));
app.use('/api/completions', require('./routes/completions'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
