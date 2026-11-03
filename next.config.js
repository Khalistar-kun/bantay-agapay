/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Display the same client-facing UI at the public homepage and /visit.
  // Keep existing /visit/status, /visit/returning and staff pages unchanged.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/client-demo/index.html' },
        { source: '/visit', destination: '/client-demo/index.html' },
      ],
    }
  },
}

module.exports = nextConfig
