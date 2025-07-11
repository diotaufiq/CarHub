const request = require('supertest');
const app = require('../app');
const { User, Car, Category } = require('../models');
const { generateToken } = require('../helpers/jwt');
const Stripe = require('stripe');

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'test_session_id',
            url: 'https://example.com/checkout'
          }),
          retrieve: jest.fn().mockResolvedValue({
            id: 'test_session_id',
            payment_status: 'paid',
            metadata: { carId: '1' }
          })
        }
      }
    };
  });
});

let userToken;
let testUserId;
let testCarId;
let testCategoryId;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET = 'test_jwt_secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    
    // Create test user
    const user = await User.create({
      username: 'paymentuser',
      email: 'paymentuser@example.com',
      password: 'password123',
      role: 'customer'
    });
    
    testUserId = user.id;
    userToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // Create test category
    const category = await Category.create({
      name: 'Payment Test Category'
    });
    
    testCategoryId = category.id;
    
    // Create test car
    const car = await Car.create({
      brand: 'Payment Test Brand',
      type: 'Payment Test Type',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: 'Test Features',
      price: 50000,
      imageUrl: 'https://example.com/image.jpg',
      CategoryId: testCategoryId,
      UserId: testUserId
    });
    
    testCarId = car.id;
  } catch (error) {
    console.error('Payment test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await Car.destroy({ where: { id: testCarId } });
    await Category.destroy({ where: { id: testCategoryId } });
    await User.destroy({ where: { id: testUserId } });
  } catch (error) {
    console.error('Payment test cleanup error:', error);
  }
});

describe('Payment Controller', () => {
  describe('POST /payment/create-checkout-session/:carId', () => {
    it('should create a checkout session for a valid car', async () => {
      const response = await request(app)
        .post(`/payment/create-checkout-session/${testCarId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url', 'https://example.com/checkout');
    });

    it('should return 404 if car not found', async () => {      const response = await request(app)
        .post('/payment/create-checkout-session')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ carId: 999999 });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 401 if not authenticated', async () => {      const response = await request(app)
        .post(`/payment/create-checkout-session`)
        .send({ carId: testCarId });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });

    it('should handle stripe errors gracefully', async () => {
      // Mock Stripe error
      const stripeInstance = Stripe();
      stripeInstance.checkout.sessions.create.mockRejectedValueOnce(
        new Error('Stripe error')
      );
      
      const response = await request(app)
        .post(`/payment/create-checkout-session`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ carId: testCarId });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Reset mock
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'test_session_id',
        url: 'https://example.com/checkout'
      });
    });
  });

  describe('GET /payment/status/:sessionId', () => {
    it('should return payment status for a valid session', async () => {
      const response = await request(app)
        .get('/payment/status/test_session_id')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'paid');
      expect(response.body).toHaveProperty('carId', '1');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/payment/status/test_session_id');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });

    it('should handle stripe errors gracefully', async () => {
      // Mock Stripe error
      const stripeInstance = Stripe();
      stripeInstance.checkout.sessions.retrieve.mockRejectedValueOnce(
        new Error('Stripe error')
      );
      
      const response = await request(app)
        .get('/payment/status/test_session_id')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Reset mock
      stripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        id: 'test_session_id',
        payment_status: 'paid',
        metadata: { carId: '1' }
      });
    });
  });
});
