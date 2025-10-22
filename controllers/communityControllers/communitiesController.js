
import Community from "../../models/commmunity/communityModel.js"


// Create community
export const handleCreateCommunity = async (req, res) => {
  try {
    const { name, description, rules, isPublic, tags } = req.body;
    
    // Check if community name exists
    const existingCommunity = await Community.findOne({ name });
    if (existingCommunity) {
        return res.status(400).json({
            success: false,
            message: 'Community name already exists'
        });
    }

    const community = new Community({
      name,
      description,
      creator: req.user.id,
      moderators: [req.user.id],
      members: [req.user.id],
      rules: rules || [],
      isPublic: isPublic !== false,
      tags: tags || [],
      memberCount: 1
    });

    await community.save();
      res.status(201).json({
        success: true,
        message: "Success",  
        community});
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Get all communities (with pagination and search)
export const handleGetAllCommunities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    let query = { isPublic: true };
    if (search) {
      query = {
        ...query,
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      };
    }

    const communities = await Community.find(query)
      .populate('creator', 'username avatar')
      .sort({ memberCount: -1, trendCount: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Community.countDocuments(query);

    res.json({
        success: true,
        message: "Success",
      communities,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCommunities: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get single community
export const handleGetACommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate('creator', 'username avatar')
      .populate('moderators', 'username avatar');

    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    res.json(community);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Join community
export const handleJoinCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    
    if (!community) {
        return res.status(404).json({
            success: false,
            message: 'Community not found'
        });
    }

    if (community.members.includes(req.user.id)) {
        return res.status(400).json({
            success: false,
            message: 'Already a member'
        });
    }

    community.members.push(req.user.id);
    community.memberCount += 1;
    await community.save();

      res.json({
          success: true,
          message: 'Successfully joined community',
          community
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

