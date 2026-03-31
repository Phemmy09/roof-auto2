/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["mongoose"],
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default nextConfig
