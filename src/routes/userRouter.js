import { Router } from "express";
import protect from "../middlewares/authMiddleware.js";
import * as userController from "../controllers/userController.js";
import * as userValidator from "../validators/userValidator.js";
const router = Router();

router
  .route("/login")
  .post(userValidator.loginValidator, userController.loginUser);
router
  .route("/register")
  .post(userValidator.registerValidator, userController.registerUser);

router.route("/renewAccessToken").post(userController.renewAccessToken);
//protected routes
router.route("/logout").post(protect, userController.logoutUser);

router
  .route("/changePassword")
  .patch(protect, userValidator.changePassword, userController.changePassword);

export default router;
