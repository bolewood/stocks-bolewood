/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // EchoStar changed its Nasdaq ticker from SATS to ECHO on 2026-06-24;
      // the calculator moved from /sats to /echo with it.
      {
        source: "/sats",
        destination: "/echo",
        permanent: true,
      },
      // /investor-day became the standing Anthropic IPO tape after Oct 14,
      // 2026. The :path* rule keeps X's cached share-card image URLs working.
      {
        source: "/investor-day",
        destination: "/anthropic-ipo-tape",
        permanent: true,
      },
      {
        source: "/investor-day/:path*",
        destination: "/anthropic-ipo-tape/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
