import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Pre-existing lint errors belum dibersihkan — akan dikerjakan terpisah
    ignoreDuringBuilds: true,
  },
  images: {
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 800],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
      },
    ],
  },
};

export default nextConfig;
