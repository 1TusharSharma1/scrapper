import { Router } from "express";
import { scrape } from "../controllers/scapperController.js";
const router = Router();

router.route("/").get(scrape);

export default router;