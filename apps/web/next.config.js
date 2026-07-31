import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/core", "@repo/edgar", "@repo/agents"],
  turbopack: {
    root: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  },
};

export default nextConfig;
