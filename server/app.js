const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const routes = require('./routes');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
const allowedOrigins = [
  'https://ip-dio.web.app',
  'https://diotaufiq.site'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // <-- jika kamu nanti pakai cookie/token
}));


// Special handling for Stripe webhook route
app.use((req, res, next) => {
  if (req.originalUrl === '/payment/webhook') {
    next(); // Skip body parsing for webhook route
  } else {
    express.json()(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// Routes
app.use(routes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error details:', err);
  
  // Handle Sequelize Validation Errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(error => {
      return `Validation error: ${error.message}`;
    });
    return res.status(400).json({
      message: errors.join(', '),
      errors: errors
    });
  }
  
  // Handle Sequelize Unique Constraint Errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'field';
    let message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    
    if (field === 'email') {
      message = 'Email already registered';
    }
    
    return res.status(400).json({
      message: message
    });
  }
  
  // Handle Sequelize Database Errors
  if (err.name === 'SequelizeDatabaseError') {
    return res.status(500).json({
      message: 'Database error occurred'
    });
  }
  
  // Handle Sequelize Connection Errors
  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      message: 'Database connection failed'
    });
  }
  
  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired'
    });
  }
  
  // Handle Custom Errors with status
  if (err.status) {
    return res.status(err.status).json({
      message: err.message || 'An error occurred'
    });
  }
  
  // Handle Multer Errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      message: 'File size too large'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      message: 'Unexpected file field'
    });
  }
  
  // Default error handler
  res.status(500).json({
    message: err.message || 'Internal Server Error'
  });
});

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

module.exports = app;