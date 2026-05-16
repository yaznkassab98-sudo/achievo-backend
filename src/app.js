const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'https:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(url => url.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));

const makeLimit = (windowMinutes, max, message) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
});

const globalLimiter      = makeLimit(15, 200, 'Too many requests, please slow down.');
const authLimiter        = makeLimit(15, 15,  'Too many login attempts, try again in 15 minutes.');
const completionLimiter  = makeLimit(60, 10,  'Too many challenge submissions, try again later.');
const strictLimiter      = makeLimit(60, 30,  'Too many requests to this endpoint.');

app.use(globalLimiter);

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/cities', require('./routes/cities'));
app.use('/api/businesses', require('./routes/businesses'));
app.use('/api/challenges', strictLimiter, require('./routes/challenges'));
app.use('/api/completions', completionLimiter, require('./routes/completions'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/staff', strictLimiter, require('./routes/staff'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/templates', require('./routes/templates'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
