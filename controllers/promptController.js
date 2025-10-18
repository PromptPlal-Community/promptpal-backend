import Prompt from '../models/promptModel.js';
import User from '../models/userModel.js';
import CloudinaryService from '../utils/CloudinaryService.js';



// Create prompt with images
/**
 * @swagger
 * /prompts:
 *   post:
 *     summary: Create a new prompt
 *     description: Create a new prompt with images
 *     tags: [Prompts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               promptText:
 *                 type: string
 *               resultText:
 *                 type: string
 *               aiTool:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isPublic:
 *                 type: boolean
 *               isDraft:
 *                  type: boolean
 *               version:
 *                  type: number
 *               requiresLevel:
 *                 type: string
 *               difficulty:
 *                 type: string
 *               category:
 *                 type: string
 *               captions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Prompt created successfully
 *       400:
 *         description: Bad request
 */
export const createPrompt = async (req, res) => {
try {
    const { 
      title, 
      description, 
      promptText, 
      resultText, 
      aiTool, 
      tags, 
      isPublic,
      isDraft, 
      requiresLevel, 
      difficulty, 
      category,
      captions 
    } = req.body;

    // Check user's storage limit before processing images
    const user = await User.findById(req.user._id);
    let totalImageSize = 0;
    let processedImages = [];

    if (req.files && req.files.length > 0) {
      // Calculate total size first
      for (const file of req.files) {
        const canUpload = await user.canUploadImage(file.size);
        if (!canUpload.allowed) {
          return res.status(400).json({ error: canUpload.reason });
        }
        totalImageSize += file.size;
      }

      // Upload images to Cloudinary
      const uploadResults = await CloudinaryService.uploadMultiple(req.files, {
        folder: `users/${req.user._id}/prompts`,
        transformation: [
          {
            width: 1200,
            height: 800,
            crop: 'limit',
            quality: 'auto:good',
            format: 'auto'
          }
        ]
      });

      // Process uploaded images
      processedImages = uploadResults.map((result, index) => {
        const caption = captions ? 
          (Array.isArray(captions) ? captions[index] : JSON.parse(captions)[index]) : 
          '';

        return {
          public_id: result.public_id,
          url: result.secure_url,
          thumbnail_url: CloudinaryService.generateThumbnailUrl(result.public_id),
          optimized_url: CloudinaryService.generateOptimizedUrl(result.public_id),
          responsive_urls: CloudinaryService.generateResponsiveUrls(result.public_id),
          caption,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          transformation: result.transformation
        };
      });
    }

    const prompt = new Prompt({
      title,
      description,
      promptText,
      resultText,
      aiTool,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
      author: req.user._id,
      isPublic: isPublic !== 'false',
      isDraft: isDraft === 'true',
      version: 1,
      requiresLevel: requiresLevel || 'Newbie',
      difficulty: difficulty || 'Beginner',
      category: category || 'Other',
      images: processedImages,
        metadata: {
        wordCount: promptText.split(/\s+/).length,
        characterCount: promptText.length,
        hasImages: processedImages.length > 0,
        hasCode: promptText.includes('```') || (resultText && resultText.includes('```')),
        imageCount: processedImages.length,
        },
    });

    await prompt.save();


    if (processedImages.length > 0) {
      await user.trackImageUpload(totalImageSize);
    }

    res.status(201).json({
      success: true,
      message: 'Prompt created successfully',
      prompt: await prompt.populate('author', 'username profile avatar level profession')
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Add images to existing prompt
/**
 * @swagger
 * /prompts/{id}/images:
 *   post:
 *     summary: Add images to an existing prompt
 *     description: Upload images to an existing prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images added successfully
 *       400:
 *         description: Bad request
 */
export const addImagesToPrompt = async (req, res) => {
          try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    if (prompt.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to modify this prompt' });
    }

    const user = await User.findById(req.user._id);
    let totalImageSize = 0;
    
    if (req.files && req.files.length > 0) {
      // Check storage limits
      for (const file of req.files) {
        const canUpload = await user.canUploadImage(file.size);
        if (!canUpload.allowed) {
          return res.status(400).json({ error: canUpload.reason });
        }
        totalImageSize += file.size;
      }

      // Upload to Cloudinary
      const uploadResults = await CloudinaryService.uploadMultiple(req.files, {
        folder: `users/${req.user._id}/prompts`
      });

      // Add images to prompt
      for (const result of uploadResults) {
        await prompt.addCloudinaryImage(result);
      }

      // Update user storage
      await user.trackImageUpload(totalImageSize);
    }

    res.json({
      success: true,
      message: 'Images added successfully',
      images: prompt.images
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Get all prompts
/**
 * @swagger
 * /users/me/prompts:
 *   get:
 *     summary: Get all prompts created by the user
 *     description: Retrieve all prompts created by the authenticated user
 *     tags: [Prompts]
 *     responses:
 *       200:
 *         description: Prompts retrieved successfully
 *       400:
 *         description: Bad request
 */
export const getUserPrompts = async (req, res) => {
  try {
    const prompts = await Prompt.find({ author: req.user._id });
    res.json({
      success: true,
      prompts
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Get prompts with images
/**
 * @swagger
 * /prompts/with-images:
 *   get:
 *     summary: Get prompts that have images
 *     description: Retrieve prompts that include images with pagination and filtering
 *     tags: [Prompts]
 *     parameters:
 *       - in: query
 *         name: page
 *         description: Page number for pagination
 *         default: 1
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         description: Number of prompts to retrieve per page
 *         default: 12
 *         schema:
 *           type: integer
 *       - in: query
 *         name: aiTool
 *         description: Filter prompts by AI tool
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         description: Filter prompts by category
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         description: Filter prompts by difficulty level
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prompts retrieved successfully
 *       400:
 *         description: Bad request
 */
export const getPromptsWithImages = async (req, res) => {
  try {
    const { page = 1, limit = 12, aiTool, category, difficulty } = req.query;
    
    const query = { 
      isPublic: true, 
      isDraft: false,
      'images.0': { $exists: true } 
    };

    if (aiTool) query.aiTool = aiTool;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const prompts = await Prompt.find(query)
      .populate('author', 'username profile avatar level profession')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Prompt.countDocuments(query);

    res.json({
      success: true,
      prompts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Delete image from prompt
/**
 * @swagger
 * /prompts/{id}/images/{imageIndex}:
 *   delete:
 *     summary: Delete an image from a prompt
 *     description: Remove an image from a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *       - in: path
 *         name: imageIndex
 *         required: true
 *         description: Index of the image to delete
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       404:
 *         description: Prompt or image not found
 *       403:
 *         description: Not authorized to delete this image
 */
export const deleteImageFromPrompt = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    if (prompt.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to modify this prompt' });
    }

    const imageIndex = parseInt(req.params.imageIndex);
    await prompt.deleteCloudinaryImage(imageIndex);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Get all prompts with pagination and filtering
/**
 * @swagger
 * /prompts:
 *   get:
 *     summary: Get all prompts
 *     description: Retrieve all prompts with optional filtering and pagination
 *     tags: [Prompts]
 *     parameters:
 *       - in: query
 *         name: page
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         description: Number of prompts to retrieve per page
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: aiTool
 *         description: Filter prompts by AI tool
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         description: Filter prompts by category
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         description: Filter prompts by difficulty level
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prompts retrieved successfully
 *       400:
 *         description: Bad request
 */
export const getAllPrompts = async (req, res) => {
  try {
    const { page = 1, limit = 10, aiTool, tags, author, isPublic } = req.query;
    const filter = {};
    if (aiTool) filter.aiTool = aiTool;
    if (tags) filter.tags = { $in: tags.split(',').map(tag => tag.trim()) };
    if (author) filter.author = author;
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';

    const prompts = await Prompt.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', 'name');

    const totalPrompts = await Prompt.countDocuments(filter);

    res.json({
      success: true,
      data: prompts,
      totalPages: Math.ceil(totalPrompts / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Get single prompt by ID
/**
 * @swagger
 * /prompts/{id}:
 *   get:
 *     summary: Get a single prompt by ID
 *     description: Retrieve a specific prompt by its ID
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt retrieved successfully
 *       404:
 *         description: Prompt not found
 */
export const getPromptById = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id).populate('author', 'name');
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json({
      success: true,
      data: prompt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Update prompt details and images
/**
 * @swagger
 * /prompts/{id}:
 *   put:
 *     summary: Update a prompt by ID
 *     description: Update the details of a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt updated successfully
 *       404:
 *         description: Prompt not found
 *       403:
 *         description: Not authorized to update this prompt
 */
export const updatePrompt = async (req, res) => {
    try {
      const prompt = await Prompt.findById(req.params.id)
        .populate('author', 'username profile avatar level');
      
      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      // Check authorization - only author can update
      if (prompt.author._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Not authorized to update this prompt' });
      }

      const user = await User.findById(req.user._id);
      const {
        title,
        description,
        promptText,
        resultText,
        aiTool,
        tags,
        isPublic,
        isDraft,
        requiresLevel,
        difficulty,
        category,
        imagesToDelete,
        captions
      } = req.body;

      // Update basic prompt details
      prompt.title = title || prompt.title;
      prompt.description = description || prompt.description;
      prompt.promptText = promptText || prompt.promptText;
      prompt.resultText = resultText !== undefined ? resultText : prompt.resultText;
      prompt.isPublic = isPublic !== undefined ? isPublic === 'true' : prompt.isPublic;
      prompt.isDraft = isDraft !== undefined ? isDraft === 'true' : prompt.isDraft;
      prompt.requiresLevel = requiresLevel || prompt.requiresLevel;
      prompt.difficulty = difficulty || prompt.difficulty;
      prompt.category = category || prompt.category;
      prompt.aiTool = aiTool || prompt.aiTool;

      // Update tags if provided
      if (tags !== undefined) {
        prompt.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
      }


      // Handle image deletions first
      if (imagesToDelete) {
        const deleteIndexes = Array.isArray(imagesToDelete) ? imagesToDelete : JSON.parse(imagesToDelete);
        
        for (const index of deleteIndexes.sort((a, b) => b - a)) {
          await prompt.deleteCloudinaryImage(parseInt(index));
        }
      }

      // Handle new image uploads
      if (req.files && req.files.length > 0) {
        let totalNewImageSize = 0;
        
        // Check storage limits for new images
        for (const file of req.files) {
          const canUpload = await user.canUploadImage(file.size);
          if (!canUpload.allowed) {
            // Clean up any already processed files
            req.files.forEach(f => {
              if (f.buffer) {
                // Memory storage - no file to delete, but we should not proceed
              }
            });
            return res.status(400).json({ error: canUpload.reason });
          }
          totalNewImageSize += file.size;
        }

        // Upload new images to Cloudinary
        const uploadResults = await CloudinaryService.uploadMultiple(req.files, {
          folder: `users/${req.user._id}/prompts`,
          transformation: [
            {
              width: 1200,
              height: 800,
              crop: 'limit',
              quality: 'auto:good',
              format: 'auto'
            }
          ]
        });

        // Process uploaded images with captions
        const newImages = uploadResults.map((result, index) => {
          let caption = '';
          
          // Handle captions input
          if (captions) {
            if (Array.isArray(captions)) {
              caption = captions[index] || '';
            } else if (typeof captions === 'object') {
              caption = captions[index] || '';
            } else {
              try {
                const parsedCaptions = JSON.parse(captions);
                caption = parsedCaptions[index] || '';
              } catch {
                caption = '';
              }
            }
          }

          return {
            public_id: result.public_id,
            url: result.secure_url,
            thumbnail_url: CloudinaryService.generateThumbnailUrl(result.public_id),
            optimized_url: CloudinaryService.generateOptimizedUrl(result.public_id),
            responsive_urls: CloudinaryService.generateResponsiveUrls(result.public_id),
            caption,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            transformation: result.transformation,
            isPrimary: prompt.images.length === 0 && index === 0 // Set as primary if no images exist
          };
        });

        // Add new images to prompt
        prompt.images.push(...newImages);

        // Update user's storage usage
        await user.trackImageUpload(totalNewImageSize);
      }

      // Handle primary image setting
      if (req.body.primaryImageIndex !== undefined) {
        await prompt.setPrimaryImage(parseInt(req.body.primaryImageIndex));
      }

      // Update metadata
      prompt.metadata = {
        ...prompt.metadata,
        wordCount: prompt.promptText.split(/\s+/).length,
        characterCount: prompt.promptText.length,
        hasImages: prompt.images.length > 0,
        hasCode: prompt.promptText.includes('```') || (prompt.resultText && prompt.resultText.includes('```')),
        imageCount: prompt.images.length
      };

      prompt.updatedAt = new Date();
      await prompt.save();

      // Populate the updated prompt for response
      const updatedPrompt = await Prompt.findById(prompt._id)
        .populate('author', 'username profile avatar level profession')
        .populate('community', 'name description');

      res.json({
        success: true,
        message: 'Prompt updated successfully',
        data: {
          ...updatedPrompt.toObject(),
          primaryImage: updatedPrompt.primaryImage,
          totalImagesSize: updatedPrompt.totalImagesSize
        }
      });

    } catch (error) {
      console.error('Error updating prompt:', error);
      
        // Clean up any uploaded Cloudinary images if error occurred after upload
        if (req.files && req.files.length > 0) {
          try {
            await CloudinaryService.deleteMultiple(req.files.map(file => file.public_id));
            console.error('Error occurred after image uploads. Images may need manual cleanup.');
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
        }
      }

      res.status(400).json({ 
        error: error.message || 'Failed to update prompt' 
      });
};

// Delete prompt
/**
 * @swagger
 * /prompts/{id}:
 *   delete:
 *     summary: Delete a prompt by ID
 *     description: Remove a specific prompt by its ID
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt deleted successfully
 *       404:
 *         description: Prompt not found
 *       403:
 *         description: Not authorized to delete this prompt
 *       500:
 *         description: Internal server error
 */
export const deletePrompt = async (req, res) => {
      try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    await prompt.remove();
    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Set primary image for prompt
/**
 * @swagger
 * /prompts/{id}/images/primary:
 *   put:
 *     summary: Set primary image for a prompt
 *     description: Update the primary image of a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *       - in: body
 *         name: body
 *         required: true
 *         description: New primary image ID
 *         schema:
 *           type: object
 *           properties:
 *             imageId:
 *               type: string
 *               description: ID of the image to set as primary
 *     responses:
 *       200:
 *         description: Primary image set successfully
 *       404:
 *         description: Prompt or image not found
 *       403:
 *         description: Not authorized to update this prompt
 *       500:
 *         description: Internal server error
 */
export const setPrimaryImage = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const { imageId } = req.body;
    const image = prompt.images.find(img => img.public_id === imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    prompt.images.forEach(img => {
      img.isPrimary = img.public_id === imageId;
    });

    await prompt.save();
    res.json({
      success: true,
      message: 'Primary image set successfully',
      data: prompt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};



// Rate a prompt
/**
 * @swagger
 * /prompts/{id}/rate:
 *   post:
 *     summary: Rate a prompt
 *     description: Submit a rating for a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *       - in: body
 *         name: body
 *         required: true
 *         description: Rating value
 *         schema:
 *           type: object
 *           properties:
 *             rating:
 *               type: integer
 *               description: Rating value (1-5)
 *     responses:
 *       200:
 *         description: Prompt rated successfully
 *       404:
 *         description: Prompt not found
 *       403:
 *         description: Not authorized to rate this prompt
 *       500:
 *         description: Internal server error
 */
export const ratePrompt = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating. Please provide a rating between 1 and 5.' });
    }

    prompt.ratings.push(rating);
    await prompt.save();

    res.json({
      success: true,
      message: 'Prompt rated successfully',
      data: prompt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// search prompts by title description, tags, ai author, username, prompt, profession and other fields
/**
 * @swagger
 * /prompts/search:
 *   get:
 *     summary: Search prompts
 *     description: Search for prompts by various fields
 *     tags: [Prompts]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         description: Search query
 *     responses:
 *       200:
 *         description: Prompts retrieved successfully
 *       400:
 *         description: Invalid search query
 *       500:
 *         description: Internal server error
 */
export const searchPrompts = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const prompts = await Prompt.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } },
        { 'author.username': { $regex: query, $options: 'i' } },
        { ai: { $regex: query, $options: 'i' } },
        { profession: { $regex: query, $options: 'i' } },
        { prompt: { $regex: query, $options: 'i' } }
      ]
    });

    res.json({
      success: true,
      data: prompts
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};



// Increment prompt view count based on clicks
/**
 * @swagger
 * /prompts/{id}/views:
 *   post:
 *     summary: Increment prompt views
 *     description: Increment the view count for a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt views incremented successfully
 *       404:
 *         description: Prompt not found
 *       500:
 *         description: Internal server error
 */
export const incrementPromptViews = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    prompt.views += 1;
    await prompt.save();

    res.json({
      success: true,
      data: prompt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// get prompt view count
/**
 * @swagger
 * /prompts/{id}/views:
 *   get:
 *     summary: Get prompt views
 *     description: Get the view count for a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt views retrieved successfully
 *       404:
 *         description: Prompt not found
 *       500:
 *         description: Internal server error
 */
export const getPromptViews = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({
      success: true,
      data: prompt.views
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Upvote a prompt
/**
 * @swagger
 * /prompts/{id}/upvote:
 *   post:
 *     summary: Upvote a prompt
 *     description: Increment the upvote count for a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt upvoted successfully
 *       404:
 *         description: Prompt not found
 *       500:
 *         description: Internal server error
 */
export const upvotePrompt = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    prompt.upvotes += 1;
    await prompt.save();

    res.json({
      success: true,
      data: prompt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Downvote a prompt
/**
 * @swagger
 * /prompts/{id}/downvote:
 *   post:
 *     summary: Downvote a prompt
 *     description: Increment the downvote count for a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt downvoted successfully
 *       404:
 *         description: Prompt not found
 *       500:
 *         description: Internal server error
 */
export const downvotePrompt = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    prompt.downvotes += 1;
    await prompt.save();

    res.json({
      success: true,
      data: prompt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// get prompt upvote count
/**
 * @swagger
 * /prompts/{id}/upvote:
 *   get:
 *     summary: Get prompt upvotes
 *     description: Get the upvote count for a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt upvotes retrieved successfully
 *       404:
 *         description: Prompt not found
 *       500:
 *         description: Internal server error
 */
export const getPromptUpvotes = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({
      success: true,
      data: prompt.upvotes
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// get prompt downvote count
/**
 * @swagger
 * /prompts/{id}/downvote:
 *   get:
 *     summary: Get prompt downvotes
 *     description: Get the downvote count for a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt downvotes retrieved successfully
 *       404:
 *         description: Prompt not found
 *       500:
 *         description: Internal server error
 */
export const getPromptDownvotes = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({
      success: true,
      data: prompt.downvotes
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// get popular prompts
/**
 * @swagger
 * /prompts/popular:
 *   get:
 *     summary: Get popular prompts
 *     description: Get a list of the most popular prompts based on upvotes
 *     tags: [Prompts]
 *     responses:
 *       200:
 *         description: Popular prompts retrieved successfully
 *       500:
 *         description: Internal server error
 */
export const getPopularPrompts = async (req, res) => {
  try {
    const prompts = await Prompt.find().sort({ upvotes: -1 }).limit(10);
    res.json({
      success: true,
      data: prompts
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};



// get prompts favorited by user
/**
 * @swagger
 * /favorites/user/:userId:
 *   get:
 *     summary: Get user favorite prompts
 *     description: Get a list of prompts favorited by a specific user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: User favorite prompts retrieved successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const getUserFavoritePrompts = async (req, res) => {
  try {
    const userId = req.params.id;
    const prompts = await User.findById(userId).populate('favoritePrompts');
    res.json({
      success: true,
      data: prompts
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Favorite a prompt
/**
 * @swagger
 * /prompts/{id}/favorite:
 *   post:
 *     summary: Favorite a prompt
 *     description: Add a prompt to the user's favorites
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt favorited successfully
 *       404:
 *         description: User or prompt not found
 *       500:
 *         description: Internal server error
 */
export const favoritePrompt = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.favoritePrompts.push(req.params.id);
    await user.save();

    res.json({
      success: true,
      data: user.favoritePrompts
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Remove prompt from favorites
/**
 * @swagger
 * /prompts/{id}/unfavorite:
 *   post:
 *     summary: Remove a prompt from favorites
 *     description: Remove a prompt from the user's favorites
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Prompt unfavorited successfully
 *       404:
 *         description: User or prompt not found
 *       500:
 *         description: Internal server error
 */
export const removePromptFromFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.favoritePrompts.pull(req.params.id);
    await user.save();

    res.json({
      success: true,
      data: user.favoritePrompts
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Get comments for a prompt
/**
 * @swagger
 * /prompts/{id}/comments:
 *   get:
 *     summary: Get comments for a prompt
 *     description: Retrieve a list of comments for a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *       404:
 *         description: Prompt not found
 *       500:
 *         description: Internal server error
 */
export const getPromptComments = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id).populate('comments');
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({
      success: true,
      data: prompt.comments
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Add comment to a prompt
/**
 * @swagger
 * /prompts/{id}/comments:
 *   post:
 *     summary: Add a comment to a prompt
 *     description: Add a comment to a specific prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *     responses:
 *       200:
 *         description: Comment added successfully
 *       404:
 *         description: Prompt not found
 *       500:
 *         description: Internal server error
 */
export const addCommentToPrompt = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const comment = new Comment({
      text: req.body.text,
      prompt: prompt._id,
      user: req.user.id
    });

    await comment.save();
    prompt.comments.push(comment._id);
    await prompt.save();

    res.json({
      success: true,
      data: comment
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// rate a comment
/**
 * @swagger
 * /prompts/{id}/comments/{commentId}/rate:
 *   post:
 *     summary: Rate a comment
 *     description: Rate a specific comment on a prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *       - in: path
 *         name: commentId
 *         required: true
 *         description: ID of the comment
 *     responses:
 *       200:
 *         description: Comment rated successfully
 *       404:
 *         description: Prompt or comment not found
 *       500:
 *         description: Internal server error
 */
export const rateComment = async (req, res) => {
    try {
        const prompt = await Prompt.findById(req.params.id);
        if (!prompt) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        const comment = prompt.comments.id(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const existingRating = comment.ratings.find(r => r.user.toString() === req.user.id);
        if (existingRating) {
            existingRating.value = req.body.value;
        } else {
            comment.ratings.push({
                user: req.user.id,
                value: req.body.value
            });
        }

        await prompt.save();

        res.json({
            success: true,
            data: comment
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// get comment ratings
/**
 * @swagger
 * /prompts/{id}/comments/{commentId}/ratings:
 *   get:
 *     summary: Get ratings for a comment
 *     description: Retrieve all ratings for a specific comment on a prompt
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the prompt
 *       - in: path
 *         name: commentId
 *         required: true
 *         description: ID of the comment
 *     responses:
 *       200:
 *         description: Ratings retrieved successfully
 *       404:
 *         description: Prompt or comment not found
 *       500:
 *         description: Internal server error
 */
export const getCommentRatings = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const comment = prompt.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({
      success: true,
      data: comment.ratings
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
