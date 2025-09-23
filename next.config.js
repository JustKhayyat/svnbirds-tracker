/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.scdn.co",
      },
      {
        protocol: "https",
        hostname: "*.spotifycdn.com",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co",
      },
      {
        protocol: "https",
        hostname: "seeded-session-images.scdn.co",
      },
      {
        protocol: "https",
        hostname: "image-cdn-ak.spotifycdn.com",
      },
      {
        protocol: "https",
        hostname: "seed-mix-image.spotifycdn.com",
      },
    ],
  },

  // For API routes, make sure fetch works server-side
  experimental: {
    serverComponentsExternalPackages: ["node-fetch"],
  },

  // Make sure Vercel knows to use .next as the build output
  output: "standalone",
};

module.exports = nextConfig;
