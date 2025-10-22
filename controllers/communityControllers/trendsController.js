

import Trend from "../../models/commmunity/trendsModel.js" ;
import Community from "../../models/commmunity/communityModel.js";
import Comment from "../../models/commmunity/commentModel.js";


// Create trend
export const handleCreateTrend = async (req, res) => {
  try {
    const { title, content, communityId, tags } = req.body;

    // Verify community exists and user is member
    const community = await Community.findById(communityId);
    
    if (!community) {
              return res.status(404).json({
                success: false,
                message: 'Community not found'
              });
    }

    if (!community.members.includes(req.user.id)) {
        return res.status(403).json({
            success: false,
            message: 'You must join the community first'
        });
    }

    const trend = new Trend({
      title,
      content,
      author: req.user.id,
      community: communityId,
      tags: tags || []
    });

    await trend.save();

    community.trendCount += 1;
    await community.save();

    await trend.populate('author', 'username avatar');
    await trend.populate('community', 'name');

    res.status(201).json(trend);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get trends with filtering and pagination
export const handleGetTrendsWithFiltering = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const communityId = req.query.community;
    const sortBy = req.query.sortBy || 'hot';
    const skip = (page - 1) * limit;

    let query = { isActive: true };
    let sort = {};

    // Filter by community if provided
    if (communityId) {
      query.community = communityId;
    }

    // Sorting logic
    switch (sortBy) {
      case 'new':
        sort = { createdAt: -1 };
        break;
      case 'top':
        sort = { voteScore: -1 };
        break;
      case 'hot': 
      default:
        sort = { voteScore: -1, createdAt: -1 };
    }

    const trends = await Trend.find(query)
      .populate('author', 'username avatar')
      .populate('community', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Trend.countDocuments(query);

    res.status(201).json({
      trends,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTrends: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single trend with comments
export const handleGetATrendWithComment = async (req, res) => {
  try {
    const trend = await Trend.findById(req.params.id)
      .populate('author', 'username avatar')
      .populate('community', 'name description');

    if (!trend) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    // Increment views
    trend.views += 1;
    await trend.save();

    // Get comments 
    const comments = await Comment.find({ trend: trend._id, parentComment: null })
      .populate('author', 'username avatar')
      .sort({ voteScore: -1, createdAt: -1 });

    res.status(201).json({ trend, comments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Upvote trend
export const handleUpvoteTrend = async (req, res) => {
  try {
    const trend = await Trend.findById(req.params.id);
    
    if (!trend) {
        return res.status(404).json({
            success: false,
            message: 'Trend not found'
        });
    }

    const userId = req.user.id;

    // Remove from downvotes if exists
    if (trend.downvotes.includes(userId)) {
      trend.downvotes.pull(userId);
    }

    // Toggle upvote
    if (trend.upvotes.includes(userId)) {
      trend.upvotes.pull(userId);
    } else {
      trend.upvotes.push(userId);
    }

    // Calculate vote score
    trend.voteScore = trend.upvotes.length - trend.downvotes.length;
    await trend.save();

    res.status(201).json({ voteScore: trend.voteScore, userVote: 'upvoted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Downvote trend
export const handleDownvoteTrend = async (req, res) => {
  try {
    const trend = await Trend.findById(req.params.id);
    
    if (!trend) {
        return res.status(404).json({
            success: false,
            message: 'Trend not found'
        });
    }

    const userId = req.user.id;

    // Remove from upvotes if exists
    if (trend.upvotes.includes(userId)) {
      trend.upvotes.pull(userId);
    }

    // Toggle downvote
    if (trend.downvotes.includes(userId)) {
      trend.downvotes.pull(userId);
    } else {
      trend.downvotes.push(userId);
    }

    // Calculate vote score
    trend.voteScore = trend.upvotes.length - trend.downvotes.length;
    await trend.save();

    res.status(201).json({ voteScore: trend.voteScore, userVote: 'downvoted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add comment to trend
export const handleCommentOnTrend = async (req, res) => {
  try {
    const { content, parentCommentId } = req.body;
    const trend = await Trend.findById(req.params.id);

    if (!trend) {
        return res.status(404).json({
            success: false,
            message: 'Trend not found'
        });
    }

    const comment = new Comment({
      content,
      author: req.user.id,
      trend: trend._id,
      parentComment: parentCommentId || null,
      depth: parentCommentId ? 1 : 0 
    });

    await comment.save();

    // Add comment to trend
    trend.comments.push(comment._id);
    trend.commentCount += 1;
    await trend.save();

    // If it's a reply, add to parent comment
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment) {
        parentComment.replies.push(comment._id);
        await parentComment.save();
      }
    }

    await comment.populate('author', 'username avatar');

      res.status(201).json({
          success: true,
          message: "success",
          comment});
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};