const request = require('supertest');
const app = require('../app');
const { User, Car, Category, WishlistItem } = require('../models');
const { generateToken } = require('../helpers/jwt');

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
            metadata: { 
              carId: '1',
              userId: '1'
            },
            payment_intent: 'pi_123456789'
          })
        }
      },
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: {
                carId: '1',
                userId: '1'
              }
            }
          }
        })
      }
    };
  });
});

let userToken;
let adminToken;
let testUserId;
let testAdminId;
let testCarId;
let testCategoryId;
let testWishlistItemId;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET = 'test_jwt_secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';
    
    // Create test admin user
    const admin = await User.create({
      username: 'payment_admin',
      email: 'payment_admin@example.com',
      password: 'password123',
      role: 'admin'
    });
    
    testAdminId = admin.id;
    adminToken = generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role
    });
    
    // Create test regular user
    const user = await User.create({
      username: 'payment_user',
      email: 'payment_user@example.com',
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
    
    // Create test cars with different prices
    // Regular price car
    const car1 = await Car.create({
      brand: 'Toyota',
      Type: 'Corolla',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: ['GPS', 'Leather Seats'],
      price: 50000,
      imageUrl: 'https://example.com/image1.jpg',
      CategoryId: category.id,
      UserId: admin.id
    });
    
    // Very expensive car (exceeds limit)
    const car2 = await Car.create({
      brand: 'Rolls Royce',
      Type: 'Phantom',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: ['Premium Features'],
      price: 3000000000, // 3 billion IDR - exceeds Stripe limit
      imageUrl: 'https://example.com/image2.jpg',
      CategoryId: category.id,
      UserId: admin.id
    });
    
    // Very cheap car (below minimum)
    const car3 = await Car.create({
      brand: 'Mini',
      Type: 'Model',
      released_year: 2020,
      condition: 'Used',
      fuel: 'Gasoline',
      features: ['Basic'],
      price: 5000, // 5,000 IDR - below Stripe minimum
      imageUrl: 'https://example.com/image3.jpg',
      CategoryId: category.id,
      UserId: admin.id
    });
    
    testCarId = car1.id;
    
    // Add car to wishlist
    const wishlistItem = await WishlistItem.create({
      UserId: testUserId,
      CarId: testCarId
    });
    
    testWishlistItemId = wishlistItem.id;
  } catch (error) {
    console.error('Payment comprehensive test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await WishlistItem.destroy({ where: { id: testWishlistItemId } });
    await Car.destroy({ where: { UserId: testAdminId } });
    await Category.destroy({ where: { id: testCategoryId } });
    await User.destroy({ where: { id: testUserId } });
    await User.destroy({ where: { id: testAdminId } });
  } catch (error) {
    console.error('Payment comprehensive test cleanup error:', error);
  }
});

describe('Payment Controller Comprehensive Tests', () => {  describe('POST /payment/create-checkout-session', () => {
    it('should create a checkout session for a valid car', async () => {
      const response = await request(app)
        .post('/payment/create-checkout-session')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ carId: testCarId });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'test_session_id');
      expect(response.body).toHaveProperty('url', 'https://example.com/checkout');
    });
    
    it('should return 404 if car not found', async () => {      const response = await request(app)
        .post('/payment/create-checkout-session')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ carId: 999999 });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 400 if car price exceeds Stripe maximum', async () => {
      // Find the expensive car
      const expensiveCar = await Car.findOne({
        where: { brand: 'Rolls Royce' }
      });
        const response = await request(app)
        .post('/payment/create-checkout-session')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ carId: expensiveCar.id });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('melebihi batas maksimum');
    });
    
    it('should return 400 if car price below Stripe minimum', async () => {
      // Find the cheap car
      const cheapCar = await Car.findOne({
        where: { brand: 'Mini' }
      });
      
      const response = await request(app)
        .post('/payment/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ carId: cheapCar.id });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('minimal');
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/payment/checkout')
        .send({ carId: testCarId });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle Stripe errors gracefully', async () => {
      // Mock Stripe error
      const stripeInstance = require('stripe')();
      stripeInstance.checkout.sessions.create.mockRejectedValueOnce(
        new Error('Stripe API error')
      );
      
      const response = await request(app)
        .post('/payment/checkout')
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
  
  describe('GET /payment/success', () => {
    it('should handle successful payment and remove from wishlist', async () => {
      // Add car to wishlist (if removed in previous test)
      await WishlistItem.findOrCreate({
        where: {
          UserId: testUserId,
          CarId: testCarId
        }
      });
      
      const response = await request(app)
        .get('/payment/success?session_id=test_session_id');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Payment successful');
      expect(response.body.data).toHaveProperty('paymentId', 'pi_123456789');
      
      // Verify item was removed from wishlist
      const wishlistItem = await WishlistItem.findOne({
        where: {
          UserId: testUserId,
          CarId: testCarId
        }
      });
      
      expect(wishlistItem).toBeNull();
    });
    
    it('should handle errors during payment success handling', async () => {
      // Mock Stripe error
      const stripeInstance = require('stripe')();
      stripeInstance.checkout.sessions.retrieve.mockRejectedValueOnce(
        new Error('Stripe session retrieval error')
      );
      
      const response = await request(app)
        .get('/payment/success?session_id=test_session_id');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Reset mock
      stripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        id: 'test_session_id',
        payment_status: 'paid',
        metadata: { 
          carId: '1',
          userId: '1'
        },
        payment_intent: 'pi_123456789'
      });
    });
  });
  
  describe('POST /payment/webhook', () => {
    it('should handle valid Stripe webhook event', async () => {
      const response = await request(app)
        .post('/payment/webhook')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: {
                carId: testCarId,
                userId: testUserId
              }
            }
          }
        }));
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('received', true);
    });
    
    it('should handle webhook signature verification errors', async () => {
      // Mock webhook verification error
      const stripeInstance = require('stripe')();
      stripeInstance.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });
      
      const response = await request(app)
        .post('/payment/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send(JSON.stringify({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: {
                carId: testCarId,
                userId: testUserId
              }
            }
          }
        }));
      
      expect(response.status).toBe(400);
      expect(response.text).toContain('Webhook Error');
      
      // Reset mock
      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {
              carId: '1',
              userId: '1'
            }
          }
        }
      });
    });
  });
});
