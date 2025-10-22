
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    handleAddMedalReward, handleGetTrendRewardSummary,
    handleGetUserRewardStats, handleLeaderboards, handleGetRewardsTypes
} from "../controllers/communityControllers/rewardsController.js"

const router = express.Router();

router.post("/trends/:id/reward'", protect, handleAddMedalReward);
router.get('/reward-types', protect, handleGetRewardsTypes);
router.get('/trends/:id/rewards/summary', protect, handleGetTrendRewardSummary);
router.get('/users/rewards/stats', protect, handleGetUserRewardStats);
router.get("/leaderboards/medals", protect, handleLeaderboards);

export default router;
