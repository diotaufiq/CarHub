const request = require('supertest');
const app = require('../app');
const { User, Car, Category } = require('../models');
const { generateToken } = require('../helpers/jwt');
const { generateContent } = require('../lib/gemini.api');

// Mock gemini API
jest.mock('../lib/gemini.api', () => ({
  generateContent: jest.fn()
}));

let userToken;
let adminToken;
let testCarId;
let testCategoryId;
let testUserId;
let testAdminId;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET = 'test_jwt_secret';
    
    // Create test admin user
    const admin = await User.create({
      username: 'aiadmin_comprehensive',
      email: 'aiadmin_comprehensive@example.com',
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
      username: 'aiuser_comprehensive',
      email: 'aiuser_comprehensive@example.com',
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
      name: 'AI Comprehensive Test Category'
    });
    
    testCategoryId = category.id;
    
    // Create test cars with different prices and brands
    const car1 = await Car.create({
      brand: 'Toyota',
      Type: 'Corolla',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: ['GPS', 'Leather Seats', 'Bluetooth'],
      price: 50000,
      imageUrl: 'https://example.com/image1.jpg',
      CategoryId: category.id,
      UserId: admin.id
    });
    
    const car2 = await Car.create({
      brand: 'Honda',
      Type: 'Civic',
      released_year: 2022,
      condition: 'New',
      fuel: 'Hybrid',
      features: ['Rearview Camera', 'Sunroof', 'Lane Assist'],
      price: 45000,
      imageUrl: 'https://example.com/image2.jpg',
      CategoryId: category.id,
      UserId: admin.id
    });
    
    const car3 = await Car.create({
      brand: 'BMW',
      Type: '3 Series',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: ['Leather Seats', 'Premium Sound', 'Navigation'],
      price: 70000,
      imageUrl: 'https://example.com/image3.jpg',
      CategoryId: category.id,
      UserId: admin.id
    });
    
    testCarId = car1.id;
  } catch (error) {
    console.error('AI comprehensive test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await Car.destroy({ where: { UserId: testAdminId } });
    await Category.destroy({ where: { name: 'AI Comprehensive Test Category' } });
    await User.destroy({ where: { email: 'aiadmin_comprehensive@example.com' } });
    await User.destroy({ where: { email: 'aiuser_comprehensive@example.com' } });
  } catch (error) {
    console.error('AI comprehensive test cleanup error:', error);
  }
});

describe('AI Controller Comprehensive Tests', () => {
  describe('POST /ai/recommend', () => {
    beforeEach(() => {
      // Reset mock before each test
      generateContent.mockReset();
    });    it('should return 400 if budget is missing', async () => {
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ preferences: { brand: 'Toyota' } });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    });    it('should return 400 if budget is invalid', async () => {
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 'invalid', preferences: { brand: 'Toyota' } });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    });    it('should return 400 if budget is zero or negative', async () => {
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 0, preferences: { brand: 'Toyota' } });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    });

    it('should return recommendations with brand preference', async () => {
      // Mock AI response as a proper JSON array of car IDs
      generateContent.mockResolvedValue('[1, 2, 3]');
        const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          budget: 60000, 
          preferences: { 
            brand: 'Toyota'
          } 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });

    it('should return recommendations with category preference', async () => {
      // Mock AI response
      generateContent.mockResolvedValue('[1, 2, 3]');
        const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          budget: 60000, 
          preferences: { 
            category: 'AI Comprehensive Test Category'
          } 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('recommendations');
    });

    it('should return recommendations with fuel preference', async () => {
      // Mock AI response
      generateContent.mockResolvedValue('[1, 2, 3]');
        const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          budget: 60000, 
          preferences: { 
            fuel: 'Hybrid'
          } 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('recommendations');
    });    it('should handle AI parsing errors gracefully', async () => {
      // Mock invalid JSON response from AI
      generateContent.mockResolvedValue('This is not valid JSON');
      
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 60000, preferences: { brand: 'Toyota' } });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('recommendations');
      // Should fallback to providing recommendations despite parsing error
    });    it('should handle empty AI response gracefully', async () => {
      // Mock empty array response from AI
      generateContent.mockResolvedValue('[]');
      
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 60000, preferences: { brand: 'Toyota' } });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('recommendations');
      // Should fallback to providing recommendations despite empty AI response
    });    it('should handle AI error gracefully', async () => {
      // Mock AI error
      generateContent.mockRejectedValue(new Error('AI error'));
      
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 60000, preferences: { brand: 'Toyota' } });
      
      expect(response.status).toBe(500);
    });    it('should handle no matching cars scenario', async () => {
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 1, preferences: { brand: 'NonexistentBrand' } });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('tidak ada kendaraan');
      expect(response.body.recommendations).toEqual([]);
    });
  });
});
