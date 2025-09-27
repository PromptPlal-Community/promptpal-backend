// services/CloudinaryService.js
import cloudinary from './cloudinary.js';
import streamifier from 'streamifier';

class CloudinaryService {
  // Upload buffer to Cloudinary
  async uploadBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
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
      const result = await cloudinary.v2.uploader.upload(filePath, {
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
      const result = await cloudinary.v2.uploader.destroy(publicId);
      return result;
    } catch (error) {
      throw new Error(`Cloudinary deletion failed: ${error.message}`);
    }
  }

  // Delete multiple images
  async deleteMultiple(publicIds) {
    try {
      const result = await cloudinary.v2.api.delete_resources(publicIds);
      return result;
    } catch (error) {
      throw new Error(`Cloudinary multiple deletion failed: ${error.message}`);
    }
  }

  // Generate thumbnail URL
  generateThumbnailUrl(publicId, width = 300, height = 200) {
    return cloudinary.v2.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    });
  }

  // Generate optimized URL
  generateOptimizedUrl(publicId, width = 1200, height = 800) {
    return cloudinary.v2.url(publicId, {
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
      url: cloudinary.v2.url(publicId, {
        width: size,
        crop: 'scale',
        quality: 'auto',
        format: 'auto'
      })
    }));
  }

  // Apply advanced transformations
  applyTransformations(publicId, transformations = []) {
    return cloudinary.v2.url(publicId, {
      transformation: transformations
    });
  }
}

export default new CloudinaryService();