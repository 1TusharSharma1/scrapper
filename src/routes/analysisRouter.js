import { Router } from 'express';
import { analyzeMenu } from '../controllers/analysis.Controller.js';
// import { verifyJWT } from '../middlewares/auth.middleware.js'; // Assuming auth is needed

const router = Router();

// Apply authentication middleware if required for this route
// router.use(verifyJWT);

// Route to trigger analysis for a specific menu
router.route('/menu/:menuId/analyze').post(analyzeMenu);

export default router; 