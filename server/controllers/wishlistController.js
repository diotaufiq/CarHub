const { WishlistItem, Car, Category } = require('../models');

class WishlistController {
  static async validateWishlistId(req, res, next) {
    try {
      const { userId, carId } = req.params;
      
      // Validate if wishlist item exists
      const wishlistItem = await WishlistItem.findOne({
        where: { UserId: userId, CarId: carId } // Perbaikan: carId -> CarId
      });
      
      if (!wishlistItem) {
        throw { status: 404, message: 'Wishlist item not found' };
      }
      
      // Attach wishlist item to request object
      req.wishlistItem = wishlistItem;
      next();
    } catch (err) {
      next(err);
    }
  }

  static async addToWishlist(req, res, next) {
    try {
      const UserId = req.user.id; // From authentication middleware
      const { carId } = req.params;

      // Validate if car exists
      const car = await Car.findByPk(carId);
      if (!car) {
        throw { status: 404, message: 'Car not found' };
      }

      // Check if item already in wishlist
      const existingItem = await WishlistItem.findOne({
        where: { UserId, CarId: carId } // Perbaikan: carId -> CarId
      });

      if (existingItem) {
        throw { status: 400, message: 'Car already in wishlist' };
      }

      // Create wishlist item
      const wishlistItem = await WishlistItem.create({
        UserId,
        CarId: carId // Perbaikan: carId -> CarId
      });

      // Get car details for response
      const carWithDetails = await Car.findOne({
        where: { id: carId },
        include: [{ model: Category }]
      });

      res.status(201).json({
        message: 'Car added to wishlist successfully',
        wishlist: {
          id: wishlistItem.id,
          car: {
            id: carWithDetails.id,
            brand: carWithDetails.brand,
            type: carWithDetails.Type,
            category: carWithDetails.Category.name,
            price: carWithDetails.price,
            imageUrl: carWithDetails.imageUrl
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUserWishlist(req, res, next) {
    try {
      const UserId = req.user.id; 
  
      // Get all wishlist items for the user with car details
      const wishlistItems = await WishlistItem.findAll({
        where: { UserId },
        attributes: ['id', 'UserId', 'CarId', 'createdAt', 'updatedAt'], 
        include: [{
          model: Car,
          include: [{ model: Category }]
        }],
        order: [['createdAt', 'DESC']] // Latest first
      });
  
      res.status(200).json(wishlistItems);
    } catch (err) {
      next(err);
    }
  }

  // Add this method to your WishlistController class
  
  static async removeFromWishlist(req, res, next) {
    try {
      const UserId = req.user.id; 
      const { wishlistItemId } = req.params;
  
      // Try to find by id first, then by CarId as fallback
      let wishlistItem = await WishlistItem.findOne({
        where: { id: wishlistItemId, UserId }
      });
      
      // If not found by id, try by CarId (fallback for missing id issue)
      if (!wishlistItem) {
        wishlistItem = await WishlistItem.findOne({
          where: { CarId: wishlistItemId, UserId }
        });
      }
  
      if (!wishlistItem) {
        throw { status: 404, message: 'Wishlist item not found' };
      }
  
      // Delete the wishlist item
      await wishlistItem.destroy();
  
      res.status(200).json({
        message: 'Item removed from wishlist successfully'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WishlistController;