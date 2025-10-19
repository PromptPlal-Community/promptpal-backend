// services/CloudinaryService.js
import cloudinary from './cloudinary.js';
import streamifier from 'streamifier';

class CloudinaryService {
  // Upload buffer to Cloudinary
  async uploadBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream( 
        {
          folder: options.folder || 'prompt_images',
          transformation: [
            {
              width: options.width || 1200,
              height: options.height || 800,
              crop: 'limit',
              quality: 'auto',
              format: 'auto'
            }
          ],
          ...options
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  // Upload file to Cloudinary
  async uploadFile(filePath, options = {}) {
    try {
      const result = await cloudinary.uploader.upload(filePath, { // Remove .v2
        folder: options.folder || 'prompt_images',
        transformation: [
          {
            width: options.width || 1200,
            height: options.height || 800,
            crop: 'limit',
            quality: 'auto',
            format: 'auto'
          }
        ],
        ...options
      });

      return result;
    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  // Upload multiple files
  async uploadMultiple(files, options = {}) {
    const uploadPromises = files.map(file => this.uploadBuffer(file.buffer, options));
    return Promise.all(uploadPromises);
  }

  // Delete image from Cloudinary
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      throw new Error(`Cloudinary deletion failed: ${error.message}`);
    }
  }

  // Delete multiple images
  async deleteMultiple(publicIds) {
    try {
      const result = await cloudinary.api.delete_resources(publicIds); // Remove .v2
      return result;
    } catch (error) {
      throw new Error(`Cloudinary multiple deletion failed: ${error.message}`);
    }
  }

  // Generate thumbnail URL
  generateThumbnailUrl(publicId, width = 300, height = 200) {
    return cloudinary.url(publicId, { // Remove .v2
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    });
  }

  // Generate optimized URL
  generateOptimizedUrl(publicId, width = 1200, height = 800) {
    return cloudinary.url(publicId, { // Remove .v2
      width,
      height,
      crop: 'limit',
      quality: 'auto',
      format: 'auto'
    });
  }

  // Generate responsive image URLs
  generateResponsiveUrls(publicId, sizes = [300, 600, 900, 1200]) {
    return sizes.map(size => ({
      width: size,
      url: cloudinary.url(publicId, { // Remove .v2
        width: size,
        crop: 'scale',
        quality: 'auto',
        format: 'auto'
      })
    }));
  }

  // Apply advanced transformations
  applyTransformations(publicId, transformations = []) {
    return cloudinary.url(publicId, { // Remove .v2
      transformation: transformations
    });
  }
}

export default new CloudinaryService();