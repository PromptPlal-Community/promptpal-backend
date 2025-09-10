import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";



const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "properties/images",
    allowed_formats: ["jpg", "jpeg", "png"],
    resource_type: "image",
  },
});

// Storage for videos
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "properties/videos",
    allowed_formats: ["mp4", "avi", "mov", "mkv"],
    resource_type: "video",
  },
});


export const uploadImage = multer({ storage: imageStorage });
export const uploadVideo = multer({ storage: videoStorage });
