import type { NextConfig } from "next";

const extraDevOrigins =
  process.env.NEXT_DEV_EXTRA_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },
  /** Emülatör / LAN IP’den next dev (HMR, Server Actions) — farklı origin izni */
  allowedDevOrigins: [
    "http://10.0.2.2:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...extraDevOrigins,
  ],
  /** Tree-shake: yalnızca kullanılan ikonlar bundle’a girer */
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@tanstack/react-query",
      "recharts",
    ],
  },
  /** Firebase Google popup: window.closed için COOP gevşetilir */
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*.(css|js|mjs|map|png|jpg|jpeg|gif|svg|webp|ico|woff2|woff|ttf|otf)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000" },
        ],
      },
      {
        source: "/tv/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sunum-kumandasi",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "unsafe-none",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/work-calendar",
        destination: "/document-templates?tab=calisma-takvimi",
        permanent: false,
      },
      {
        source: "/yillik-plan-icerik",
        destination: "/document-templates?tab=yillik-plan-icerik",
        permanent: false,
      },
      { source: "/site-haritasi", destination: "/akademik-takvim", permanent: false },
      { source: "/site-map-ayarlar", destination: "/akademik-takvim-ayarlar", permanent: false },
      { source: "/site-map-template", destination: "/akademik-takvim-sablonu", permanent: false },
      { source: "/bilsem/takvim-ayarlar", destination: "/bilsem/takvim/ayarlar", permanent: false },
      { source: "/bilsem/yillik-calisma-plani", destination: "/bilsem/takvim/yillik-plan", permanent: false },
      { source: "/bilsem-sablon/takvim", destination: "/bilsem-sablon?tab=takvim", permanent: false },
      { source: "/bilsem-sablon/kazanim", destination: "/bilsem-sablon?tab=kazanim", permanent: false },
      { source: "/bilsem-sablon/planlar", destination: "/bilsem-sablon?tab=planlar", permanent: false },
      { source: "/extra-lesson-calc", destination: "/ek-ders-hesaplama", permanent: true },
      { source: "/school-reviews", destination: "/okul-degerlendirmeleri", permanent: true },
      { source: "/moderation", destination: "/school-reviews-settings", permanent: false },
    ];
  },
};

export default nextConfig;
