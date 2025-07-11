const request = require('supertest');
const app = require('../app');
const { User, Car, Category } = require('../models');
const { generateToken } = require('../helpers/jwt');
const aiController = require('../controllers/aiController');
const { generateContent } = require('../lib/gemini.api');

// Mock gemini API
jest.mock('../lib/gemini.api', () => ({
  generateContent: jest.fn(),
  generateImage: jest.fn()
}));

let userToken;
let adminToken;
let testCarId;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET = 'test_jwt_secret';
    
    // Create test admin user
    const admin = await User.create({
      username: 'aiadmin',
      email: 'aiadmin@example.com',
      password: 'password123',
      role: 'admin'
    });
    
    adminToken = generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role
    });
    
    // Create test regular user
    const user = await User.create({
      username: 'aiuser',
      email: 'aiuser@example.com',
      password: 'password123',
      role: 'customer'
    });
    
    userToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // Create test category
    const category = await Category.create({
      name: 'AI Test Category'
    });
    
    // Create test car
    const car = await Car.create({
      brand: 'AI Test Brand',
      type: 'AI Test Type',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: 'Test Features',
      price: 50000,
      imageUrl: 'https://example.com/image.jpg',
      CategoryId: category.id,
      UserId: admin.id
    });
    
    testCarId = car.id;
  } catch (error) {
    console.error('AI test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await Car.destroy({ where: { brand: 'AI Test Brand' } });
    await Category.destroy({ where: { name: 'AI Test Category' } });
    await User.destroy({ where: { email: 'aiadmin@example.com' } });
    await User.destroy({ where: { email: 'aiuser@example.com' } });
  } catch (error) {
    console.error('AI test cleanup error:', error);
  }
});

describe('AI Controller', () => {
  describe('GET /ai/recommendation', () => {
    // Mock the generateContent function for all tests in this block
    beforeEach(() => {
      generateContent.mockResolvedValue({
        text: () => 'This is a mock AI recommendation for a car'
      });
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
    });    it('should return recommendation based on budget and preferences', async () => {
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 60000, preferences: { brand: 'AI Test Brand' } });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body).toHaveProperty('matchingCars');
    });    it('should return recommendation with category filter', async () => {
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          budget: 60000, 
          preferences: { 
            category: 'AI Test Category'
          } 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body).toHaveProperty('matchingCars');
    });    it('should return recommendation with fuel filter', async () => {
      const response = await request(app)
        .post('/ai/recommend')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          budget: 60000, 
          preferences: { 
            fuel: 'Gasoline'
          } 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body).toHaveProperty('matchingCars');
    });
  });

  describe('POST /ai/car-description/:carId', () => {
    beforeEach(() => {
      generateContent.mockResolvedValue({
        text: () => 'This is a mock AI description for a car'
      });
    });

    it('should return 404 if car not found', async () => {
      const response = await request(app)
        .post('/ai/car-description/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });

    it('should generate a car description', async () => {
      const response = await request(app)
        .post(`/ai/car-description/${testCarId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('description');
    });

    it('should handle error when AI generation fails', async () => {
      generateContent.mockRejectedValue(new Error('AI generation error'));
      
      const response = await request(app)
        .post(`/ai/car-description/${testCarId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('POST /ai/image', () => {
    it('should generate an image based on prompt', async () => {
      // Mock generateImage for this test
      const mockImageUrl = 'https://example.com/generated-image.jpg';
      require('../lib/gemini.api').generateImage.mockResolvedValue(mockImageUrl);
      
      const response = await request(app)
        .post('/ai/image')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prompt: 'a red sports car' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('imageUrl', mockImageUrl);
    });

    it('should return 400 if prompt is missing', async () => {
      const response = await request(app)
        .post('/ai/image')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    });

    it('should handle error when AI image generation fails', async () => {
      require('../lib/gemini.api').generateImage.mockRejectedValue(new Error('Image generation error'));
      
      const response = await request(app)
        .post('/ai/image')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prompt: 'a red sports car' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
    });
  });
});
