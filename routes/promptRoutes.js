import express from "express";
import upload from '../utils/multer.js';
import {
    createPrompt,
    getAllPrompts,
    getPromptById,
    updatePrompt,
    deletePrompt,
    addImagesToPrompt,
    deleteImageFromPrompt,
    getPromptsWithImages,
    ratePrompt,
    searchPrompts,
    incrementPromptViews,
    getPromptViews,
    upvotePrompt,
    downvotePrompt,
    getPromptUpvotes,
    getPromptDownvotes,
    getPopularPrompts,
    getPromptComments,
    addCommentToPrompt,
    getUserFavoritePrompts,
    favoritePrompt,
    removePromptFromFavorites,
    rateComment,
    getCommentRatings,
    getUserPrompts,

} from "../controllers/promptController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", upload.array('images', 2), protect, createPrompt);
router.get("/filtered", protect, getAllPrompts);
router.get("/", protect, getUserPrompts);
router.get("/:id", protect, getPromptById);
router.put("/:id", upload.array('images', 2), protect, updatePrompt);
router.delete("/:id", protect, deletePrompt);
router.post("/:id/images", upload.array('images', 2), protect, addImagesToPrompt);
router.delete("/:id/images/:imageId", protect, deleteImageFromPrompt);
router.get("/with-images", protect, getPromptsWithImages);
router.post("/:id/rate", protect, ratePrompt);
router.get("/search", protect, searchPrompts);
router.post("/:id/views", protect, incrementPromptViews);
router.get("/:id/views", protect, getPromptViews);
router.post("/:id/upvote", protect, upvotePrompt);
router.post("/:id/downvote", protect, downvotePrompt);
router.get("/:id/upvotes", protect, getPromptUpvotes);
router.get("/:id/downvotes", protect, getPromptDownvotes);
router.get("/favorites/user/:userId", protect, getUserFavoritePrompts);
router.post("/:id/favorite", protect, favoritePrompt);
router.delete("/:id/favorite", protect, removePromptFromFavorites);
router.post("/:id/comments", protect, addCommentToPrompt);
router.get("/:id/comments", protect, getPromptComments);
router.post("/:id/comments/:commentId/rate", protect, rateComment);
router.get("/:id/comments/:commentId/ratings", protect, getCommentRatings);
router.get("/popular", getPopularPrompts);

export default router;
