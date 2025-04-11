import express from "express";
import * as analysisController from "../controllers/analysis.Controller.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();
// Route to trigger analysis for a specific menu
router.route("/menu/:menuId").post(protect, analysisController.analyzeMenu);

export default router;
