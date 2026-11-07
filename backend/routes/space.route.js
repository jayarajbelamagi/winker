import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	getActiveSpaces,
	createSpace,
	joinSpace,
	leaveSpace,
	raiseHand,
	promoteToSpeaker,
	endSpace,
} from "../controllers/space.controller.js";

const router = express.Router();

router.get("/active", protectRoute, getActiveSpaces);
router.post("/create", protectRoute, createSpace);
router.post("/:spaceId/join", protectRoute, joinSpace);
router.post("/:spaceId/leave", protectRoute, leaveSpace);
router.post("/:spaceId/raise-hand", protectRoute, raiseHand);
router.post("/:spaceId/promote", protectRoute, promoteToSpeaker);
router.post("/:spaceId/end", protectRoute, endSpace);

export default router;
