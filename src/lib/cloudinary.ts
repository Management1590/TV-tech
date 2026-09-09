import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'zcquougv',
  api_key: process.env.CLOUDINARY_API_KEY || '918732292732855',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'm1wDvL1NC5LNvGNeg6eFyOyanMI',
  secure: true,
});

export { cloudinary };
