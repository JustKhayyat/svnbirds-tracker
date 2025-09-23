/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.scdn.co",
      },
      {
        protocol: "https",
        hostname: "**.spotifycdn.com",
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
