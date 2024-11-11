/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@promptmaster/shared"],
  async rewrites() {
    // In development, use localhost
    // In production (Docker), use service name
    const backendUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:4000"
        : "http://backend:4000";

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
