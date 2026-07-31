/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/core", "@repo/edgar", "@repo/agents"],
};

export default nextConfig;
