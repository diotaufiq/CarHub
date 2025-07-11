const request = require('supertest');
const app = require('../app');
const { User, Car, Category } = require('../models');
const { generateToken } = require('../helpers/jwt');

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn().mockResolvedValue({
        secure_url: 'https://example.com/uploaded-image.jpg'
      })
    }
  }
}));

let userToken;
let adminToken;
let testUserId;
let testAdminId;
let testCarId;
let testCategoryId;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET = 'test_jwt_secret';
    
    // Create test admin user
    const admin = await User.create({
      username: 'car_admin',
      email: 'car_admin@example.com',
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
      username: 'car_user',
      email: 'car_user@example.com',
      password: 'password123',
      role: 'customer'
    });
    
    testUserId = user.id;
    userToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // Create test categories
    const category1 = await Category.create({
      name: 'Car Test Category 1'
    });
    
    const category2 = await Category.create({
      name: 'Car Test Category 2'
    });
    
    testCategoryId = category1.id;
    
    // Create test car
    const car = await Car.create({
      brand: 'Car Test Brand',
      Type: 'Car Test Type',
      released_year: 2023,
      condition: 'New',
      fuel: 'Gasoline',
      features: 'Test Features',
      price: 50000,
      imageUrl: 'https://example.com/car-image.jpg',
      CategoryId: testCategoryId,
      UserId: testAdminId
    });
    
    testCarId = car.id;
  } catch (error) {
    console.error('Car comprehensive test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await Car.destroy({ where: { id: testCarId } });
    await Category.destroy({ where: { name: 'Car Test Category 1' } });
    await Category.destroy({ where: { name: 'Car Test Category 2' } });
    await User.destroy({ where: { id: testUserId } });
    await User.destroy({ where: { id: testAdminId } });
  } catch (error) {
    console.error('Car comprehensive test cleanup error:', error);
  }
});

describe('Car Controller Comprehensive Tests', () => {
  describe('GET /cars', () => {
    it('should return all cars', async () => {
      const response = await request(app).get('/cars');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('brand');
      expect(response.body[0]).toHaveProperty('Type');
      expect(response.body[0]).toHaveProperty('Category');
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findAll to throw error
      const findAllSpy = jest.spyOn(Car, 'findAll').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app).get('/cars');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore the original implementation
      findAllSpy.mockRestore();
    });
  });
  
  describe('GET /cars/:carId', () => {
    it('should return a specific car by ID', async () => {
      const response = await request(app).get(`/cars/${testCarId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testCarId);
      expect(response.body).toHaveProperty('brand', 'Car Test Brand');
      expect(response.body).toHaveProperty('Category');
    });
    
    it('should return 404 if car not found', async () => {
      const response = await request(app).get('/cars/999999');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findByPk to throw error
      const findByPkSpy = jest.spyOn(Car, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app).get(`/cars/${testCarId}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore the original implementation
      findByPkSpy.mockRestore();
    });
  });
  
  describe('POST /cars', () => {
    it('should create a new car when authenticated as admin', async () => {
      const newCar = {
        brand: 'New Car Brand',
        Type: 'New Car Type',
        released_year: 2024,
        condition: 'New',
        fuel: 'Electric',
        features: 'New Features',
        price: 60000,
        imageUrl: 'https://example.com/new-car.jpg',
        CategoryId: testCategoryId
      };
      
      const response = await request(app)
        .post('/cars')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCar);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('brand', 'New Car Brand');
      
      // Clean up the created car
      await Car.destroy({ where: { id: response.body.id } });
    });
    
    it('should return 401 if not authenticated', async () => {
      const newCar = {
        brand: 'Unauthenticated Car',
        Type: 'Unauthenticated Type',
        released_year: 2024,
        condition: 'New',
        fuel: 'Gasoline',
        price: 55000,
        CategoryId: testCategoryId
      };
      
      const response = await request(app)
        .post('/cars')
        .send(newCar);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle validation errors', async () => {
      const invalidCar = {
        // Missing required fields
        brand: '',
        fuel: 'Gasoline'
      };
      
      const response = await request(app)
        .post('/cars')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCar);
      
      expect([400, 500]).toContain(response.status);
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock create to throw error
      const createSpy = jest.spyOn(Car, 'create').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const newCar = {
        brand: 'Error Car Brand',
        Type: 'Error Car Type',
        released_year: 2024,
        condition: 'New',
        fuel: 'Hybrid',
        features: 'Error Features',
        price: 65000,
        imageUrl: 'https://example.com/error-car.jpg',
        CategoryId: testCategoryId
      };
      
      const response = await request(app)
        .post('/cars')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCar);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore the original implementation
      createSpy.mockRestore();
    });
  });
  
  describe('PUT /cars/:carId', () => {
    it('should update an existing car when authenticated as admin', async () => {
      const updatedCar = {
        brand: 'Updated Car Brand',
        Type: 'Updated Car Type',
        released_year: 2025,
        condition: 'Used',
        fuel: 'Hybrid',
        features: 'Updated Features',
        price: 55000,
        imageUrl: 'https://example.com/updated-car.jpg',
        CategoryId: testCategoryId
      };
      
      const response = await request(app)
        .put(`/cars/${testCarId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCar);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testCarId);
      expect(response.body).toHaveProperty('brand', 'Updated Car Brand');
      expect(response.body).toHaveProperty('Type', 'Updated Car Type');
      
      // Reset the car to original state for other tests
      await Car.update({
        brand: 'Car Test Brand',
        Type: 'Car Test Type',
        released_year: 2023,
        condition: 'New',
        fuel: 'Gasoline',
        features: 'Test Features',
        price: 50000,
        imageUrl: 'https://example.com/car-image.jpg',
      }, {
        where: { id: testCarId }
      });
    });
    
    it('should return 401 if not authenticated', async () => {
      const updatedCar = {
        brand: 'Unauthorized Update',
        Type: 'Unauthorized Type'
      };
      
      const response = await request(app)
        .put(`/cars/${testCarId}`)
        .send(updatedCar);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 404 if car not found', async () => {
      const updatedCar = {
        brand: 'Not Found Update',
        Type: 'Not Found Type'
      };
      
      const response = await request(app)
        .put('/cars/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCar);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findByPk to throw error
      const findByPkSpy = jest.spyOn(Car, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const updatedCar = {
        brand: 'Error Update Brand',
        Type: 'Error Update Type'
      };
      
      const response = await request(app)
        .put(`/cars/${testCarId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCar);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore the original implementation
      findByPkSpy.mockRestore();
    });
  });
  
  describe('DELETE /cars/:carId', () => {
    let tempCarId;
    
    beforeEach(async () => {
      // Create a temporary car for delete tests
      const tempCar = await Car.create({
        brand: 'Temp Car Brand',
        Type: 'Temp Car Type',
        released_year: 2023,
        condition: 'New',
        fuel: 'Gasoline',
        features: 'Temp Features',
        price: 45000,
        imageUrl: 'https://example.com/temp-car.jpg',
        CategoryId: testCategoryId,
        UserId: testAdminId
      });
      
      tempCarId = tempCar.id;
    });
    
    it('should delete a car when authenticated as admin', async () => {
      const response = await request(app)
        .delete(`/cars/${tempCarId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Car deleted successfully');
      
      // Verify car was actually deleted
      const deletedCar = await Car.findByPk(tempCarId);
      expect(deletedCar).toBeNull();
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .delete(`/cars/${tempCarId}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
      
      // Clean up - delete the car manually
      await Car.destroy({ where: { id: tempCarId } });
    });
    
    it('should return 404 if car not found', async () => {
      const response = await request(app)
        .delete('/cars/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findByPk to throw error
      const findByPkSpy = jest.spyOn(Car, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .delete(`/cars/${tempCarId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore the original implementation
      findByPkSpy.mockRestore();
      
      // Clean up - delete the car manually
      await Car.destroy({ where: { id: tempCarId } });
    });
  });
  
  describe('POST /cars/:carId/upload', () => {
    it('should upload an image for a car', async () => {
      const response = await request(app)
        .post(`/cars/${testCarId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Image has been updated successfully');
      expect(response.body).toHaveProperty('imageUrl');
    });
    
    it('should return 400 if no file uploaded', async () => {
      const response = await request(app)
        .post(`/cars/${testCarId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 404 if car not found', async () => {
      const response = await request(app)
        .post('/cars/999999/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle cloudinary errors gracefully', async () => {
      // Mock cloudinary upload to throw error
      const cloudinary = require('cloudinary');
      cloudinary.v2.uploader.upload.mockRejectedValueOnce({
        http_code: 400,
        message: 'Cloudinary upload error'
      });
      
      const response = await request(app)
        .post(`/cars/${testCarId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cloudinary error');
      
      // Reset mock
      cloudinary.v2.uploader.upload.mockResolvedValue({
        secure_url: 'https://example.com/uploaded-image.jpg'
      });
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findByPk to throw error
      const findByPkSpy = jest.spyOn(Car, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .post(`/cars/${testCarId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore the original implementation
      findByPkSpy.mockRestore();
    });
  });
});
