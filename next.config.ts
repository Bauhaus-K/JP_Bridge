import type { NextConfig } from "next";

// Cache Components / partialPrefetching 은 사용하지 않는다.
// 대부분의 화면이 사용자별 동적 데이터라 이득보다 복잡도가 크다. (docs/DECISIONS.md D13)
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
