/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['archive.org', 'ia800107.us.archive.org'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.archive.org' },
      { protocol: 'https', hostname: 'archive.org' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
