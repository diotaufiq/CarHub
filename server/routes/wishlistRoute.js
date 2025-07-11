const express = require('express');
const router = express.Router();
const WishlistController = require("../controllers/wishlistController");
const authentication = require("../middlewares/authentication");

router.use(authentication);

// Get user's wishlist
router.get("/", WishlistController.getUserWishlist);

// Add to wishlist endpoint
router.post("/:carId", WishlistController.addToWishlist);

// Middleware for routes that need wishlist validation
router.use("/:userId/:carId", WishlistController.validateWishlistId);

// Validation route for testing the middleware
router.get("/:userId/:carId/validate", (req, res) => {
  // If middleware passes, we reach here
  res.status(200).json({ message: 'Wishlist item validated successfully' });
});

// Remove from wishlist
router.delete('/:wishlistItemId', WishlistController.removeFromWishlist);

module.exports = router;