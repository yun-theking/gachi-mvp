import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large audio file uploads
  api: {
    bodyParser: false,
  },
};

export default nextConfig;
