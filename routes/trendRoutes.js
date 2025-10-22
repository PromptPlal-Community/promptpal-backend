
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    handleCommentOnTrend, handleCreateTrend,
    handleGetATrendWithComment, handleGetTrendsWithFiltering,
    handleUpvoteTrend, handleDownvoteTrend
} from "../controllers/communityControllers/trendsController.js"

const router = express.Router();

router.post("/", protect, handleCreateTrend);
router.get("/:id", protect, handleGetATrendWithComment);
router.get("/", protect, handleGetTrendsWithFiltering);
router.post("/:id/upvote", protect, handleUpvoteTrend);
router.post("/:id/downvote", protect, handleDownvoteTrend);
router.post("/:id/comments", protect, handleCommentOnTrend);

export default router;
