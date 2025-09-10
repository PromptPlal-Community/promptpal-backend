// uploadVerification.js
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";

const verificationStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "verifications",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"], // allow ID docs too
  },
});

const uploadVerification = multer({ storage: verificationStorage });

export default uploadVerification;
