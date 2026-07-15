/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@evalengine/types', '@evalengine/config'],
  // NestJS (@evalengine/api) はバンドルせず実行時に require する。
  // decorators/動的 require を含むため webpack バンドルと相性が悪い。
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        '@evalengine/api/vercel-server': 'commonjs @evalengine/api/vercel-server',
      });
    }
    return config;
  },
};

export default nextConfig;
