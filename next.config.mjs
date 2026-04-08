/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "pdfjs-dist", "pdf-lib", "canvas"],
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default nextConfig
