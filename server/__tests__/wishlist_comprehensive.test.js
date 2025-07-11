const request = require('supertest');
const app = require('../app');
const { User, Car, Category, WishlistItem } = require('../models');
const { generateToken } = require('../helpers/jwt');

let userToken;
let adminToken;
let testUserId;
let testCarId;
let testCategoryId;
let testWishlistItemId;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET = 'test_jwt_secret';
    
    // Create test admin user
    const admin = await User.create({
      username: 'wishadmin',
      email: 'wishadmin@example.com',
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
      username: 'wishuser',
      email: 'wishuser@example.com',
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
      name: 'Wish Test Category'
    });
    
    testCategoryId = category.id;
    
    // Create test car
    const car = await Car.create({
      brand: 'Wish Test Brand',
      type: 'Wish Test Type',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: 'Test Features',
      price: 50000,
      imageUrl: 'https://example.com/image.jpg',
      CategoryId: testCategoryId,
      UserId: admin.id
    });
    
    testCarId = car.id;
    
    // Create test wishlist item
    const wishlistItem = await WishlistItem.create({
      UserId: testUserId,
      CarId: testCarId
    });
    
    testWishlistItemId = wishlistItem.id;
  } catch (error) {
    console.error('Wishlist test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await WishlistItem.destroy({ where: { id: testWishlistItemId } });
    await Car.destroy({ where: { id: testCarId } });
    await Category.destroy({ where: { id: testCategoryId } });
    await User.destroy({ where: { email: 'wishadmin@example.com' } });
    await User.destroy({ where: { email: 'wishuser@example.com' } });
  } catch (error) {
    console.error('Wishlist test cleanup error:', error);
  }
});

describe('Wishlist Controller', () => {
  describe('GET /wishlists', () => {
    it('should return all wishlist items for the logged-in user', async () => {
      const response = await request(app)
        .get('/wishlists')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('Car');
    });    it('should return 401 if not authenticated', async () => {
      const response = await request(app).get('/wishlists');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('POST /wishlists/:carId', () => {
    let newCarId;

    beforeAll(async () => {
      // Create a new car for this test
      const newCar = await Car.create({
        brand: 'New Wish Test Brand',
        type: 'New Wish Test Type',
        released_year: 2023,
        condition: 'New',
        fuel: 'Gasoline',
        features: 'Test Features',
        price: 60000,
        imageUrl: 'https://example.com/image2.jpg',
        CategoryId: testCategoryId,
        UserId: testUserId
      });
      
      newCarId = newCar.id;
    });

    afterAll(async () => {
      // Clean up test data
      await WishlistItem.destroy({ where: { CarId: newCarId } });
      await Car.destroy({ where: { id: newCarId } });
    });

    it('should add a car to wishlist', async () => {
      const response = await request(app)
        .post(`/wishlist/${newCarId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('Car');
      expect(response.body.Car.id).toBe(newCarId);
    });

    it('should return 400 if car already in wishlist', async () => {
      const response = await request(app)
        .post(`/wishlist/${testCarId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 404 if car not found', async () => {
      const response = await request(app)
        .post('/wishlist/999999')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app).post(`/wishlist/${newCarId}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('DELETE /wishlist/:carId', () => {
    let tempCarId;
    let tempWishlistItemId;

    beforeEach(async () => {
      // Create a new car and wishlist item for this test
      const tempCar = await Car.create({
        brand: 'Temp Wish Test Brand',
        type: 'Temp Wish Test Type',
        released_year: 2023,
        condition: 'New',
        fuel: 'Gasoline',
        features: 'Test Features',
        price: 70000,
        imageUrl: 'https://example.com/image3.jpg',
        CategoryId: testCategoryId,
        UserId: testUserId
      });
      
      tempCarId = tempCar.id;
      
      const tempWishlistItem = await WishlistItem.create({
        UserId: testUserId,
        CarId: tempCarId
      });
      
      tempWishlistItemId = tempWishlistItem.id;
    });

    afterEach(async () => {
      // Clean up test data
      await WishlistItem.destroy({ where: { id: tempWishlistItemId } });
      await Car.destroy({ where: { id: tempCarId } });
    });

    it('should remove a car from wishlist', async () => {
      const response = await request(app)
        .delete(`/wishlist/${tempCarId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Check if the item was actually deleted
      const deletedItem = await WishlistItem.findOne({
        where: { UserId: testUserId, CarId: tempCarId }
      });
      
      expect(deletedItem).toBeNull();
    });

    it('should return 404 if wishlist item not found', async () => {
      const response = await request(app)
        .delete('/wishlist/999999')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app).delete(`/wishlist/${tempCarId}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('validateWishlistId middleware', () => {
    it('should return 404 if wishlist item not found', async () => {
      // This middleware is used in the route, so we need to test it through the route
      const response = await request(app)
        .delete('/wishlist/999999')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
  });
});
