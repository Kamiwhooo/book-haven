/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.archive.org' },
      { protocol: 'https', hostname: 'archive.org' },
      { protocol: 'https', hostname: 'picture.bookfrom.net' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
        ],
      },
    ]
  },
  // Increase serverless function timeout for PDF proxy
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
}

module.exports = nextConfig
