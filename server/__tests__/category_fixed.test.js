const request = require('supertest');
const app = require('../app');
const { User, Car, Category } = require('../models');
const { generateToken } = require('../helpers/jwt');

let userToken;
let adminToken;
let testUserId;
let testAdminId;
let testCategoryId;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET = 'test_jwt_secret';
    
    // Create test admin user
    const admin = await User.create({
      username: 'category_admin_fixed',
      email: 'category_admin_fixed@example.com',
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
      username: 'category_user_fixed',
      email: 'category_user_fixed@example.com',
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
      name: 'Category Fixed Test'
    });
    
    testCategoryId = category.id;
    
    console.log('Test setup complete with IDs:', {
      testUserId,
      testAdminId,
      testCategoryId
    });
  } catch (error) {
    console.error('Category fixed test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await Category.destroy({ where: { id: testCategoryId } });
    await User.destroy({ where: { id: testUserId } });
    await User.destroy({ where: { id: testAdminId } });
  } catch (error) {
    console.error('Category fixed test cleanup error:', error);
  }
});

describe('Category Controller Complete Coverage Tests', () => {
  describe('GET /categories', () => {
    it('should return all categories', async () => {
      const response = await request(app).get('/categories');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify structure of returned items
      const category = response.body.find(cat => cat.id === testCategoryId);
      expect(category).toBeDefined();
      expect(category).toHaveProperty('name', 'Category Fixed Test');
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findAll to throw error
      const findAllSpy = jest.spyOn(Category, 'findAll').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app).get('/categories');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      findAllSpy.mockRestore();
    });
  });
  
  describe('GET /categories/:categoryId', () => {
    it('should return a specific category by ID', async () => {
      const response = await request(app).get(`/categories/${testCategoryId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testCategoryId);
      expect(response.body).toHaveProperty('name', 'Category Fixed Test');
    });
    
    it('should return 404 if category not found', async () => {
      const response = await request(app).get('/categories/999999');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findByPk to throw error
      const findByPkSpy = jest.spyOn(Category, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app).get(`/categories/${testCategoryId}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      findByPkSpy.mockRestore();
    });
  });
  
  describe('POST /categories', () => {
    it('should create a new category when authenticated as admin', async () => {
      const newCategory = {
        name: 'New Test Category'
      };
      
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCategory);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'New Test Category');
      
      // Clean up the created category
      await Category.destroy({ where: { id: response.body.id } });
    });
    
    it('should return 401 if not authenticated', async () => {
      const newCategory = {
        name: 'Unauthenticated Category'
      };
      
      const response = await request(app)
        .post('/categories')
        .send(newCategory);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 403 if authenticated as regular user (not admin)', async () => {
      const newCategory = {
        name: 'Unauthorized Category'
      };
      
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newCategory);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle validation errors', async () => {
      const invalidCategory = {
        name: '' // Name cannot be empty
      };
      
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCategory);
      
      expect([400, 500]).toContain(response.status);
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock create to throw error
      const createSpy = jest.spyOn(Category, 'create').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const newCategory = {
        name: 'Error Category'
      };
      
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCategory);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      createSpy.mockRestore();
    });
  });
  
  describe('PUT /categories/:categoryId', () => {
    it('should update an existing category when authenticated as admin', async () => {
      const updatedCategory = {
        name: 'Updated Category Name'
      };
      
      const response = await request(app)
        .put(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCategory);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testCategoryId);
      expect(response.body).toHaveProperty('name', 'Updated Category Name');
      
      // Reset to original name for other tests
      await Category.update({ name: 'Category Fixed Test' }, {
        where: { id: testCategoryId }
      });
    });
    
    it('should return 401 if not authenticated', async () => {
      const updatedCategory = {
        name: 'Unauthenticated Update'
      };
      
      const response = await request(app)
        .put(`/categories/${testCategoryId}`)
        .send(updatedCategory);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 403 if authenticated as regular user (not admin)', async () => {
      const updatedCategory = {
        name: 'Unauthorized Update'
      };
      
      const response = await request(app)
        .put(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatedCategory);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 404 if category not found', async () => {
      const updatedCategory = {
        name: 'Not Found Update'
      };
      
      const response = await request(app)
        .put('/categories/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCategory);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle validation errors', async () => {
      const invalidCategory = {
        name: '' // Name cannot be empty
      };
      
      const response = await request(app)
        .put(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCategory);
      
      expect([400, 500]).toContain(response.status);
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findByPk to throw error
      const findByPkSpy = jest.spyOn(Category, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const updatedCategory = {
        name: 'Error Update'
      };
      
      const response = await request(app)
        .put(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCategory);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      findByPkSpy.mockRestore();
    });
  });
  
  describe('DELETE /categories/:categoryId', () => {
    let tempCategoryId;
    
    beforeEach(async () => {
      // Create a temporary category for delete tests
      const tempCategory = await Category.create({
        name: 'Temp Category'
      });
      
      tempCategoryId = tempCategory.id;
    });
    
    it('should delete a category when authenticated as admin', async () => {
      const response = await request(app)
        .delete(`/categories/${tempCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Category deleted successfully');
      
      // Verify category was actually deleted
      const deletedCategory = await Category.findByPk(tempCategoryId);
      expect(deletedCategory).toBeNull();
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .delete(`/categories/${tempCategoryId}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
      
      // Clean up - delete the category manually
      await Category.destroy({ where: { id: tempCategoryId } });
    });
    
    it('should return 403 if authenticated as regular user (not admin)', async () => {
      const response = await request(app)
        .delete(`/categories/${tempCategoryId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeTruthy();
      
      // Clean up - delete the category manually
      await Category.destroy({ where: { id: tempCategoryId } });
    });
    
    it('should return 404 if category not found', async () => {
      const response = await request(app)
        .delete('/categories/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findByPk to throw error
      const findByPkSpy = jest.spyOn(Category, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .delete(`/categories/${tempCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      findByPkSpy.mockRestore();
      
      // Clean up - delete the category manually
      await Category.destroy({ where: { id: tempCategoryId } });
    });
  });
  
  describe('GET /categories/:categoryId/cars', () => {
    let categoryCar;
    
    beforeAll(async () => {
      // Create a car for the category
      categoryCar = await Car.create({
        brand: 'Category Test Brand',
        Type: 'Category Test Type',
        released_year: 2023,
        condition: 'New',
        fuel: 'Gasoline',
        features: 'Test Features',
        price: 50000,
        imageUrl: 'https://example.com/category-car.jpg',
        CategoryId: testCategoryId,
        UserId: testAdminId
      });
    });
    
    afterAll(async () => {
      // Clean up
      await Car.destroy({ where: { id: categoryCar.id } });
    });
    
    it('should return all cars for a specific category', async () => {
      const response = await request(app).get(`/categories/${testCategoryId}/cars`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify structure of returned items
      const car = response.body.find(c => c.id === categoryCar.id);
      expect(car).toBeDefined();
      expect(car).toHaveProperty('brand', 'Category Test Brand');
      expect(car).toHaveProperty('CategoryId', testCategoryId);
    });
    
    it('should return 404 if category not found', async () => {
      const response = await request(app).get('/categories/999999/cars');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock findByPk to throw error
      const findByPkSpy = jest.spyOn(Category, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app).get(`/categories/${testCategoryId}/cars`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
      
      // Restore original implementation
      findByPkSpy.mockRestore();
    });
  });
});
