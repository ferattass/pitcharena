import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure App Service'e yalnızca gerçekten kullanılan bağımlılıklar gider:
  // .next/standalone kendi minimal node_modules'ünü taşır, deploy paketi
  // node_modules'ün tamamını yüklemekten çok daha küçük ve hızlı olur.
  output: "standalone",
};

export default nextConfig;
