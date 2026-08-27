import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'szufatjy',
  api_key: process.env.CLOUDINARY_API_KEY || '652321529961524',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'parD8o4tYbzFEKvi1yeEeJJ9BRU',
  secure: true,
});

export { cloudinary };
