/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Skip ESLint during production builds for now.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Skip type-checking during production builds for now.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
