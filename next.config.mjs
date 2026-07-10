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
    ];
  },
};

export default nextConfig;
