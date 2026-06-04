import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

function serwistRevision(): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
  if (r.status === 0 && r.stdout?.trim()) return r.stdout.trim();
  return crypto.randomUUID();
}

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  register: false,
  cacheOnNavigation: true,
  additionalPrecacheEntries: [
    { url: "/offline", revision: serwistRevision() },
    { url: "/icon-192.png", revision: serwistRevision() },
    { url: "/pwa/icon-maskable-512.png", revision: serwistRevision() },
    { url: "/pwa/splash-android-portrait.png", revision: serwistRevision() },
  ],
  disable: process.env.NODE_ENV === "development",
});

/** Aynı ağdaki telefon / tablet — next dev HMR ve cross-origin için (NEXT_DEV_EXTRA_ORIGINS ile genişletilebilir). */
function localLanHttpOrigins(ports: readonly string[]): string[] {
  const nets = networkInterfaces();
  const out = new Set<string>();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const net of list as NetworkInterfaceInfo[]) {
      const fam = net.family as string | number;
      const v4 = fam === "IPv4" || fam === 4;
      if (!v4 || net.internal) continue;
      for (const port of ports) {
        out.add(`http://${net.address}:${port}`);
      }
    }
  }
  return [...out];
}

const extraDevOrigins =
  process.env.NEXT_DEV_EXTRA_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  /** next dev: tarayıcı doğrudan :4000’e gitmesin (net::ERR_CONNECTION_REFUSED gürültüsü azalır). */
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const port = process.env.NEXT_PUBLIC_API_PORT?.trim() || "4000";
    return [
      {
        source: "/be-api/:path*",
        destination: `http://127.0.0.1:${port}/api/:path*`,
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },
  /** Emülatör / LAN IP’den next dev (HMR, Server Actions) — farklı origin izni */
  allowedDevOrigins: [
    "http://10.0.2.2:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...localLanHttpOrigins(["3000", "3001", "3002"]),
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
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
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
        source: "/akilli-tahta/:path*",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
        ],
      },
      {
        source: "/optik-okuma/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=()" }],
      },
      {
        source: "/optik-oturumlar/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=()" }],
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
      { source: "/ders-dagit/st%C3%BCdyo", destination: "/ders-dagit/studyo", permanent: true },
      { source: "/ders-dagit/st%C3%BCdyo/:path*", destination: "/ders-dagit/studyo/:path*", permanent: true },
    ];
  },
};

export default withSerwist(nextConfig);
