/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "pdf-lib", "canvas", "sharp"],
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default nextConfig
