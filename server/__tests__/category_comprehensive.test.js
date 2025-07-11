const request = require('supertest');
const app = require('../app');
const { User, Category } = require('../models');
const { generateToken } = require('../helpers/jwt');

let userToken;
let adminToken;
let testCategoryId;
let testUserId;
let testAdminId;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET = 'test_jwt_secret';
    
    // Create test admin user
    const admin = await User.create({
      username: 'catadmin',
      email: 'catadmin@example.com',
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
      username: 'catuser',
      email: 'catuser@example.com',
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
      name: 'Test Category for Comprehensive Test'
    });
    
    testCategoryId = category.id;
  } catch (error) {
    console.error('Category test setup error:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await Category.destroy({ where: { id: testCategoryId } });
    await User.destroy({ where: { id: testUserId } });
    await User.destroy({ where: { id: testAdminId } });
  } catch (error) {
    console.error('Category test cleanup error:', error);
  }
});

describe('Category Controller', () => {
  describe('GET /categories', () => {
    it('should return all categories', async () => {
      const response = await request(app).get('/categories');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
    });
  });

  describe('GET /categories/:id', () => {
    it('should return a specific category by id', async () => {
      const response = await request(app)
        .get(`/categories/${testCategoryId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testCategoryId);
      expect(response.body).toHaveProperty('name', 'Test Category for Comprehensive Test');
    });

    it('should return 404 if category not found', async () => {
      const response = await request(app)
        .get('/categories/999999');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('POST /categories', () => {
    it('should create a new category if admin', async () => {
      const newCategory = {
        name: 'New Test Category'
      };
      
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCategory);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', newCategory.name);
      
      // Clean up created category
      await Category.destroy({ where: { id: response.body.id } });
    });

    it('should return 401 if not authenticated', async () => {
      const newCategory = {
        name: 'Unauthorized Category'
      };
      
      const response = await request(app)
        .post('/categories')
        .send(newCategory);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 403 if not admin', async () => {
      const newCategory = {
        name: 'Forbidden Category'
      };
      
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newCategory);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('PUT /categories/:id', () => {
    let updateCategoryId;

    beforeEach(async () => {
      // Create a category for update tests
      const updateCategory = await Category.create({
        name: 'Category to Update'
      });
      updateCategoryId = updateCategory.id;
    });

    afterEach(async () => {
      // Clean up test category
      await Category.destroy({ where: { id: updateCategoryId } });
    });

    it('should update a category if admin', async () => {
      const updatedData = {
        name: 'Updated Category Name'
      };
      
      const response = await request(app)
        .put(`/categories/${updateCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Category updated successfully');
      
      // Verify the category was actually updated
      const updatedCategory = await Category.findByPk(updateCategoryId);
      expect(updatedCategory.name).toBe(updatedData.name);
    });

    it('should return 404 if category not found', async () => {
      const updatedData = {
        name: 'Not Found Category'
      };
      
      const response = await request(app)
        .put('/categories/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 401 if not authenticated', async () => {
      const updatedData = {
        name: 'Unauthorized Update'
      };
      
      const response = await request(app)
        .put(`/categories/${updateCategoryId}`)
        .send(updatedData);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 403 if not admin', async () => {
      const updatedData = {
        name: 'Forbidden Update'
      };
      
      const response = await request(app)
        .put(`/categories/${updateCategoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('DELETE /categories/:id', () => {
    let deleteCategoryId;

    beforeEach(async () => {
      // Create a category for delete tests
      const deleteCategory = await Category.create({
        name: 'Category to Delete'
      });
      deleteCategoryId = deleteCategory.id;
    });

    afterEach(async () => {
      // Make sure category is deleted
      await Category.destroy({ where: { id: deleteCategoryId } });
    });

    it('should delete a category if admin', async () => {
      const response = await request(app)
        .delete(`/categories/${deleteCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Category deleted successfully');
      
      // Verify the category was actually deleted
      const deletedCategory = await Category.findByPk(deleteCategoryId);
      expect(deletedCategory).toBeNull();
    });

    it('should return 404 if category not found', async () => {
      const response = await request(app)
        .delete('/categories/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .delete(`/categories/${deleteCategoryId}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });

    it('should return 403 if not admin', async () => {
      const response = await request(app)
        .delete(`/categories/${deleteCategoryId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeTruthy();
    });
  });
});
