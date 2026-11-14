import express from "express";
import { developerAuth } from "../middleware/developerAuth.js";
import {
	verifyKey,
	getDatabaseStats,
	getAllUsersDetailed,
	getCollectionEntries,
	deleteEntry,
} from "../controllers/developer.controller.js";

const router = express.Router();

// Key Verification
router.post("/verify-key", developerAuth, verifyKey);

// Telemetry & Storage Stats
router.get("/stats", developerAuth, getDatabaseStats);

// Users in Detail
router.get("/users", developerAuth, getAllUsersDetailed);

// Collection Explorer
router.get("/collection/:collection", developerAuth, getCollectionEntries);

// Delete Entry
router.delete("/entry/:collection/:id", developerAuth, deleteEntry);

export default router;
