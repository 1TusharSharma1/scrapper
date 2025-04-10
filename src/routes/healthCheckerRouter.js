import { Router } from "express";
import { healthcheck } from "../controllers/healthController.js";

const router = Router();

router.route("/health").get(healthcheck);

export default router;
