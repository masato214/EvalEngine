/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@evalengine/types', '@evalengine/config'],
};

export default nextConfig;
