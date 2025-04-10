import express from "express";
import * as scrapeController from "../controllers/scapperController.js";
const router = express.Router();

router.route("/").get(scrapeController.scrape);

export default router;
