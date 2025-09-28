
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    activateFreePlan,
    getAvailablePlans,
    checkUsageLimits,
    cancelSubscription
} from "../controllers/subscriptionController.js";

const router = express.Router();

router.post("/", protect, activateFreePlan);
router.get("/", protect, getAvailablePlans);
router.delete("/:id/cancel", protect, cancelSubscription);
router.get("/usage", protect, checkUsageLimits);

export default router;
