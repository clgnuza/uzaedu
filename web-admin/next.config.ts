import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Tree-shake: yalnızca kullanılan ikonlar bundle’a girer */
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  /** Firebase Google popup: window.closed için COOP gevşetilir */
  async headers() {
    return [
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
    ];
  },
};

export default nextConfig;
