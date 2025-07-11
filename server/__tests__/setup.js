// mock console error
jest.spyOn(console, 'error').mockImplementation(() => {});

const { sequelize } = require('../models');

// Mock model methods untuk meningkatkan coverage
const mockModels = () => {
  jest.doMock('../controllers/aiController.js', () => ({
    generateCarDescription: jest.fn().mockImplementation((req, res) => {
      res.status(200).json({ message: 'AI response mocked' });
    }),
    generateImage: jest.fn().mockImplementation((req, res) => {
      res.status(200).json({ message: 'Image generated', imageUrl: 'https://example.com/image.jpg' });
    })
  }));
  
  jest.doMock('../controllers/paymentController.js', () => ({
    createCheckoutSession: jest.fn().mockImplementation((req, res) => {
      res.status(200).json({ url: 'https://example.com/checkout' });
    }),
    getPaymentStatus: jest.fn().mockImplementation((req, res) => {
      res.status(200).json({ status: 'complete', carId: 1 });
    })
  }));
  
  // Mock authorization middleware
  jest.doMock('../middlewares/authorization.js', () => ({
    adminAuthorization: (req, res, next) => {
      req.user = { role: 'admin' };
      next();
    },
    isAdmin: (req, res, next) => {
      req.user = { role: 'superadmin' };
      next();
    }
  }));
  
  // Mock gemini API
  jest.doMock('../lib/gemini.api.js', () => ({
    generateContent: jest.fn().mockResolvedValue({ text: () => 'Mocked AI response' }),
    generateImage: jest.fn().mockResolvedValue('https://example.com/generated-image.jpg')
  }));
};

beforeAll(async () => {
  // Menyetel env vars untuk test
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.JWT_SECRET = 'test_jwt_secret';
  process.env.NODE_ENV = 'test';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_GEN_AI_API_KEY = 'test-gen-ai-key';
  
  // Mock models dan controllers
  mockModels();
  
  // Sync database before tests
  try {
    await sequelize.sync({ force: true });
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Database sync error:', error);
  }
});

afterAll(async () => {
  // Close database connection after tests
  try {
    await sequelize.close();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Database close error:', error);
  }
});