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

    // Validate required fields
    if (!title || !promptText) {
      return res.status(400).json({ error: "Title and prompt text are required" });
    }

    // Parse and validate AI tools
    let parsedAiTools = [];
    if (aiTool) {
      try {
        if (Array.isArray(aiTool)) {
          parsedAiTools = aiTool;
        } else if (typeof aiTool === 'string') {
          // Handle JSON string or comma-separated string
          if (aiTool.startsWith('[')) {
            parsedAiTools = JSON.parse(aiTool);
          } else {
            parsedAiTools = aiTool.split(',').map(tool => tool.trim()).filter(tool => tool !== '');
          }
        }
      } catch (error) {
        console.error('Error parsing aiTool:', error);
        return res.status(400).json({ error: "Invalid AI tools format" });
      }
    }

    // Validate at least one AI tool is selected
    if (parsedAiTools.length === 0) {
      return res.status(400).json({ error: "At least one AI tool must be selected" });
    }

    // Parse and validate tags
    let parsedTags = [];
    if (tags) {
      try {
        if (Array.isArray(tags)) {
          parsedTags = tags;
        } else if (typeof tags === 'string') {
          if (tags.startsWith('[')) {
            parsedTags = JSON.parse(tags);
          } else {
            parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
          }
        }
      } catch (error) {
        console.error('Error parsing tags:', error);
        parsedTags = []; // Default to empty array if parsing fails
      }
    }

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
        let caption = '';
        if (captions) {
          try {
            const captionArray = Array.isArray(captions) ? captions : JSON.parse(captions);
            caption = captionArray[index] || '';
          } catch (error) {
            console.error('Error parsing captions:', error);
            caption = '';
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
          transformation: result.transformation
        };
      });
    }

    const prompt = new Prompt({
      title,
      description,
      promptText,
      resultText,
      aiTool: parsedAiTools,
      tags: parsedTags,
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
        hasCode: promptText.includes('```') || (resultText ? resultText.includes('```') : false),
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
    console.error('Create prompt error:', error);
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

// user get prompt save in drafts by ID
/**
 * @swagger
 * /prompts/{id}/drafts:
 *   get:
 *     summary: Get a user's saved draft prompt by ID
 *     description: Retrieve a specific draft prompt created by the authenticated user
 *     tags: [Prompts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the draft prompt
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Draft prompt retrieved successfully
 *       404:
 *         description: Draft prompt not found
 *       403:
 *         description: Not authorized to access this draft prompt
 */
export const getUserDraftPromptById = async (req, res) => {
  try {
    const prompt = await Prompt.findOne({ _id: req.params.id, author: req.user._id, isDraft: true });
    if (!prompt) {
      return res.status(404).json({ error: 'Draft prompt not found' });
    }
    res.json({
      success: true,
      prompt
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
      // Update tags if provided
      if (tags !== undefined) {
        prompt.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
      }

      if (aiTool !== undefined) {
        prompt.aiTool = Array.isArray(aiTool) ? aiTool : aiTool.split(',').map(tag => tag.trim());
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
    console.log('Delete request received for prompt ID:', req.params.id);
    console.log('User ID making request:', req.user._id);

    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) {
      console.log('Prompt not found with ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Prompt not found' });
    }

    console.log('Found prompt author:', prompt.author.toString());
    console.log('Request user ID:', req.user._id.toString());

    // Check if user owns the prompt
    if (prompt.author.toString() !== req.user._id.toString()) {
      console.log('Authorization failed: User does not own this prompt');
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to delete this prompt'
      });
    }

    console.log('Authorization successful, proceeding with deletion');

    // Delete associated images from Cloudinary (with error handling)
    if (prompt.images && prompt.images.length > 0) {
      console.log('Deleting', prompt.images.length, 'images from Cloudinary');
      for (const image of prompt.images) {
        try {
          if (image.public_id) {
            await CloudinaryService.deleteImage(image.public_id);
            console.log('Successfully deleted image:', image.public_id);
          }
        } catch (cloudinaryError) {
          console.error('Error deleting image from Cloudinary:', cloudinaryError);
          // Continue with prompt deletion even if image deletion fails
        }
      }
    } else {
      console.log('No images to delete from Cloudinary');
    }

    // Delete the prompt
    await Prompt.findByIdAndDelete(req.params.id);
    console.log('Prompt deleted successfully from database');
    
    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    });
  } catch (error) {
    console.error('Delete prompt error:', error);
    console.error('Error stack:', error.stack);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
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
    const { id } = req.params;
    const { rating, userId } = req.body;

    // Validate required fields
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        error: 'Invalid rating. Please provide a rating between 1 and 5.' 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        error: 'User ID is required.' 
      });
    }

    // Find the prompt
    const prompt = await Prompt.findById(id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    // Initialize ratings array if it doesn't exist
    if (!prompt.rating.ratings) {
      prompt.rating.ratings = [];
    }

    // Check if user has already rated this prompt
    const existingRatingIndex = prompt.rating.ratings.findIndex(
      r => r.user.toString() === userId
    );

    let message = '';
    let previousRating = null;

    if (existingRatingIndex !== -1) {
      // User has already rated - update existing rating
      previousRating = prompt.rating.ratings[existingRatingIndex].value;
      prompt.rating.ratings[existingRatingIndex].value = rating;
      prompt.rating.ratings[existingRatingIndex].createdAt = new Date();
      message = 'Rating updated successfully';
    } else {
      // User hasn't rated before - add new rating
      prompt.rating.ratings.push({
        user: userId,
        value: rating,
        createdAt: new Date()
      });
      message = 'Prompt rated successfully';
    }

    // Calculate new average rating
    const totalRatings = prompt.rating.ratings.length;
    const sumRatings = prompt.rating.ratings.reduce((sum, r) => sum + r.value, 0);
    const newAverage = totalRatings > 0 ? sumRatings / totalRatings : 0;

    // Update rating summary
    prompt.rating.average = Math.round(newAverage * 10) / 10; // Round to 1 decimal
    prompt.rating.count = totalRatings;

    await prompt.save();

    // Prepare response data
    const responseData = {
      averageRating: prompt.rating.average,
      totalRatings: prompt.rating.count,
      userRating: rating,
      hasRated: true
    };

    // Add previous rating info if it was an update
    if (previousRating !== null) {
      responseData.previousRating = previousRating;
    }

    res.json({
      success: true,
      message,
      data: responseData
    });

  } catch (error) {
    console.error('Error rating prompt:', error);
    
    // Handle specific errors
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        error: 'Invalid prompt ID or user ID' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to rate prompt',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



export const getUserRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const prompt = await Prompt.findById(id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const userRating = prompt.rating.ratings.find(
      r => r.user.toString() === userId
    );

    res.json({
      success: true,
      data: {
        hasRated: !!userRating,
        userRating: userRating ? userRating.value : null,
        averageRating: prompt.rating.average,
        totalRatings: prompt.rating.count
      }
    });

  } catch (error) {
    console.error('Error getting user rating:', error);
    res.status(500).json({ error: 'Failed to get user rating' });
  }
};



export const getRatingStats = async (req, res) => {
  try {
    const { id } = req.params;

    const prompt = await Prompt.findById(id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    prompt.rating.ratings.forEach(rating => {
      distribution[rating.value]++;
    });

    res.json({
      success: true,
      data: {
        average: prompt.rating.average,
        count: prompt.rating.count,
        distribution,
        recentRatings: prompt.rating.ratings
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10) // Last 10 ratings
      }
    });

  } catch (error) {
    console.error('Error getting rating stats:', error);
    res.status(500).json({ error: 'Failed to get rating statistics' });
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
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const prompt = await Prompt.findById(id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    // Check if user already upvoted
    const hasUpvoted = prompt.upvotedBy.includes(userId);
    if (hasUpvoted) {
      return res.status(400).json({ 
        error: 'You have already upvoted this prompt' 
      });
    }

    // Check if user previously downvoted
    const hasDownvoted = prompt.downvotedBy.includes(userId);
    
    if (hasDownvoted) {
      prompt.downvotedBy = prompt.downvotedBy.filter(
        user => user.toString() !== userId
      );
      prompt.downvotes = Math.max(0, prompt.downvotes - 1);
    }

    // Add upvote
    prompt.upvotedBy.push(userId);
    prompt.upvotes += 1;

    await prompt.save();

    res.json({
      success: true,
      message: hasDownvoted ? 'Vote changed to upvote' : 'Prompt upvoted successfully',
      data: {
        upvotes: prompt.upvotes,
        userVote: 'upvote'
      }
    });
  } catch (error) {
    console.error('Error upvoting prompt:', error);
    res.status(500).json({ 
      error: 'Failed to upvote prompt',
      details: error.message 
    });
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
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const prompt = await Prompt.findById(id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    // Check if user already downvoted
    const hasDownvoted = prompt.downvotedBy.includes(userId);
    if (hasDownvoted) {
      return res.status(400).json({ 
        error: 'You have already downvoted this prompt' 
      });
    }

    // Check if user previously upvoted
    const hasUpvoted = prompt.upvotedBy.includes(userId);
    
    if (hasUpvoted) {
      // Remove from upvotes and add to downvotes (switch vote)
      prompt.upvotedBy = prompt.upvotedBy.filter(
        user => user.toString() !== userId
      );
      prompt.upvotes = Math.max(0, prompt.upvotes - 1);
    }

    // Add downvote
    prompt.downvotedBy.push(userId);
    prompt.upvotes -= 1;

    await prompt.save();

    res.json({
      success: true,
      message: hasUpvoted ? 'Vote changed to downvote' : 'Prompt downvoted successfully',
      data: {
        upvotes: prompt.upvotes,
        userVote: 'downvote'
      }
    });
  } catch (error) {
    console.error('Error downvoting prompt:', error);
    res.status(500).json({ 
      error: 'Failed to downvote prompt',
      details: error.message 
    });
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
