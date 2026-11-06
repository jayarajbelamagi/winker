import express from "express";
import { getNews } from "../controllers/news.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

// Allow reading news either logged-in or public
router.get("/", getNews);

export default router;
