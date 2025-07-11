const request = require('supertest');
const app = require('../app');
const { User, Car, Category, WishlistItem } = require('../models');
const { generateToken } = require('../helpers/jwt');

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
    
    // Create test admin user
    const admin = await User.create({
      username: 'wishlist_admin_fixed',
      email: 'wishlist_admin_fixed@example.com',
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
      username: 'wishlist_user_fixed',
      email: 'wishlist_user_fixed@example.com',
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
      name: 'Wishlist Fixed Test Category'
    });
    
    testCategoryId = category.id;
    
    // Create test car
    const car = await Car.create({
      brand: 'Wishlist Fixed Test Brand',
      Type: 'Wishlist Fixed Test Type',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: 'Test Features',
      price: 50000,
      imageUrl: 'https://example.com/image.jpg',
      CategoryId: testCategoryId,
      UserId: testAdminId
    });
    
    testCarId = car.id;
    
    // Create test wishlist item
    const wishlistItem = await WishlistItem.create({
      UserId: testUserId,
      CarId: testCarId
    });
    
    testWishlistItemId = wishlistItem.id;
    
    console.log('Test setup complete with IDs:', {
      testUserId,
      testAdminId,
      testCarId,
      testCategoryId,
      testWishlistItemId
    });
  } catch (error) {
    console.error('Wishlist fixed test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await WishlistItem.destroy({ where: { id: testWishlistItemId } });
    await Car.destroy({ where: { id: testCarId } });
    await Category.destroy({ where: { id: testCategoryId } });
    await User.destroy({ where: { id: testUserId } });
    await User.destroy({ where: { id: testAdminId } });
  } catch (error) {
    console.error('Wishlist fixed test cleanup error:', error);
  }
});

describe('Wishlist Controller Complete Coverage Tests', () => {
  describe('Wishlist Validation Middleware', () => {
    it('should validate wishlist ID correctly', async () => {
      const response = await request(app)
        .get(`/wishlist/${testUserId}/${testCarId}/validate`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
    });
    
    it('should return 404 if wishlist item not found during validation', async () => {
      const response = await request(app)
        .get(`/wishlist/${testUserId}/999999/validate`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Wishlist item not found');
    });
    
    it('should handle database errors during validation', async () => {
      // Mock findOne to throw error
      const findOneSpy = jest.spyOn(WishlistItem, 'findOne').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .get(`/wishlist/${testUserId}/${testCarId}/validate`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(500);
      
      // Restore original implementation
      findOneSpy.mockRestore();
    });
  });
  
  describe('GET /wishlist', () => {
    it('should return user wishlist items', async () => {
      const response = await request(app)
        .get('/wishlists')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // At least one item should be in the wishlist (the one we created in setup)
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify the structure of returned items
      const item = response.body[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('UserId', testUserId);
      expect(item).toHaveProperty('CarId');
      expect(item).toHaveProperty('Car');
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app).get('/wishlists');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findAll to throw error
      const findAllSpy = jest.spyOn(WishlistItem, 'findAll').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
        const response = await request(app)
        .get('/wishlists')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      findAllSpy.mockRestore();
    });
  });
  
  describe('POST /wishlist/:carId', () => {
    let newCarId;
    
    beforeAll(async () => {
      // Create a new car for this test
      const newCar = await Car.create({
        brand: 'New Wishlist Test Brand',
        Type: 'New Wishlist Test Type',
        released_year: 2023,
        condition: 'New',
        fuel: 'Gasoline',
        features: 'Test Features',
        price: 60000,
        imageUrl: 'https://example.com/new-wishlist.jpg',
        CategoryId: testCategoryId,
        UserId: testAdminId
      });
      
      newCarId = newCar.id;
    });
    
    afterAll(async () => {
      // Clean up
      await WishlistItem.destroy({ where: { CarId: newCarId } });
      await Car.destroy({ where: { id: newCarId } });
    });
    
    it('should add a car to wishlist', async () => {
      const response = await request(app)
        .post(`/wishlist/${newCarId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Car added to wishlist successfully');
      expect(response.body.wishlist).toHaveProperty('car');
      expect(response.body.wishlist.car).toHaveProperty('id', newCarId);
    });
    
    it('should return 404 if car not found', async () => {      const response = await request(app)
        .post('/wishlists/999999')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 400 if car already in wishlist', async () => {
      // Car is already added from the previous test
      const response = await request(app)
        .post(`/wishlist/${newCarId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app).post(`/wishlist/${newCarId}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Delete the item first to avoid duplicate error
      await WishlistItem.destroy({ where: { CarId: newCarId, UserId: testUserId } });
      
      // Mock Car.findByPk to throw error
      const findByPkSpy = jest.spyOn(Car, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .post(`/wishlist/${newCarId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      findByPkSpy.mockRestore();
    });
  });
  
  describe('DELETE /wishlist/:wishlistItemId', () => {
    let tempCarId;
    let tempWishlistItemId;
    
    beforeEach(async () => {
      // Create a new car and wishlist item for this test
      const tempCar = await Car.create({
        brand: 'Temp Wishlist Test Brand',
        Type: 'Temp Wishlist Test Type',
        released_year: 2023,
        condition: 'New',
        fuel: 'Gasoline',
        features: 'Test Features',
        price: 55000,
        imageUrl: 'https://example.com/temp-wishlist.jpg',
        CategoryId: testCategoryId,
        UserId: testAdminId
      });
      
      tempCarId = tempCar.id;
      
      const tempWishlistItem = await WishlistItem.create({
        UserId: testUserId,
        CarId: tempCarId
      });
      
      tempWishlistItemId = tempWishlistItem.id;
    });
    
    afterEach(async () => {      // Clean up
      await WishlistItem.destroy({ where: { 
        UserId: testUserId,
        CarId: tempCarId 
      }});
      await Car.destroy({ where: { id: tempCarId } });
    });
    
    it('should remove a car from wishlist using wishlist ID', async () => {
      const response = await request(app)
        .delete(`/wishlist/${tempWishlistItemId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Item removed from wishlist successfully');
      
      // Verify it was actually removed
      const deletedItem = await WishlistItem.findByPk(tempWishlistItemId);
      expect(deletedItem).toBeNull();
    });
    
    it('should remove a car from wishlist using car ID as fallback', async () => {
      const response = await request(app)
        .delete(`/wishlist/${tempCarId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Item removed from wishlist successfully');
      
      // Verify it was actually removed
      const deletedItem = await WishlistItem.findOne({
        where: { CarId: tempCarId, UserId: testUserId }
      });
      expect(deletedItem).toBeNull();
    });
    
    it('should return 404 if wishlist item not found', async () => {
      const response = await request(app)        .delete('/wishlists/999999')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app).delete(`/wishlists/${tempWishlistItemId}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findOne to throw error
      const findOneSpy = jest.spyOn(WishlistItem, 'findOne').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .delete(`/wishlist/${tempWishlistItemId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      findOneSpy.mockRestore();
    });
  });
});
