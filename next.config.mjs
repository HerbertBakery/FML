/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Don't fail the build if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail the build if there are TS errors in starter
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
