/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // `yarn lint` is a no-op for now; type errors still fail the build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
