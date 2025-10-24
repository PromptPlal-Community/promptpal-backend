
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    handleCommentOnTrend, handleCreateTrend,
    handleGetATrendWithComment, handleGetTrendsWithFiltering,
    handleUpvoteTrend, handleDownvoteTrend, handleDeleteComment, handleDeleteTrend, handleUpvoteComment, handleDownvoteComment
} from "../controllers/communityControllers/trendsController.js"

const router = express.Router();

router.post("/", protect, handleCreateTrend);
router.get("/:id", protect, handleGetATrendWithComment);
router.get("/", protect, handleGetTrendsWithFiltering);
router.delete("/:id/delete", protect, handleDeleteTrend);
router.post("/:id/upvote", protect, handleUpvoteTrend);
router.post("/:id/downvote", protect, handleDownvoteTrend);
router.post("/:id/upvote/comment", protect, handleUpvoteComment);
router.post("/:id/downvote/comment", protect, handleDownvoteComment);
router.post("/:id/comments", protect, handleCommentOnTrend);
router.delete("/:id/comments/delete", protect, handleDeleteComment);

export default router;
