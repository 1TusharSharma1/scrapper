import express from "express";
import * as menuValidator from "../validators/menuValidator.js";
import * as menuController from "../controllers/menuController.js";
import protect from "../middlewares/authMiddleware.js";
const router = express.Router();

//menu routes
router
  .route("/")
  .post(protect, menuValidator.addMenuValidator, menuController.addMenu);
router
  .route("/:id")
  .delete(
    protect,
    menuValidator.deleteMenuValidator,
    menuController.deleteMenu
  );

//menu items routes
router
  .route("/:id/items")
  .post(
    protect,
    menuValidator.addMenuItemValidator,
    menuController.addMenuItem
  );
router
  .route("/:id/items/:itemId")
  .delete(
    protect,
    menuValidator.deleteMenuItemValidator,
    menuController.deleteMenuItem
  );
router
  .route("/:id/items/:itemId")
  .put(
    protect,
    menuValidator.updateMenuItemValidator,
    menuController.updateMenuItem
  );

//get routes
router
  .route("/:id")
  .get(protect, menuValidator.getMenuValidator, menuController.getMenuById);
router.route("/").get(protect, menuController.getMenuForUser);

export default router;
