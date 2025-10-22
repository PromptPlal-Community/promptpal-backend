
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { handleCreateCommunity, handleGetACommunity, handleJoinCommunity, handleGetAllCommunities} from "../controllers/communityControllers/communitiesController.js"

const router = express.Router();

router.post("/", protect, handleCreateCommunity);
router.get("/", protect, handleGetAllCommunities);
router.get("/:id/", protect, handleGetACommunity);
router.post("/:id/join", protect, handleJoinCommunity);

export default router;
