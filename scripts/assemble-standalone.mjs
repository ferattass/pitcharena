/**
 * `next build` standalone çıktısında sunucuyu ve minimal node_modules'ü üretir
 * ama statik varlıkları kopyalamaz. Bu adım olmadan sayfa CSS'siz açılır.
 *
 * postbuild olarak çalışır; böylece yerelde, CI'da ve deploy'da tek bir yol var.
 */
import { cpSync, existsSync } from "node:fs";

const OUT = ".next/standalone";

if (!existsSync(OUT)) {
  console.log("standalone çıktısı yok — atlanıyor (output: 'standalone' kapalı mı?)");
  process.exit(0);
}

cpSync(".next/static", `${OUT}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${OUT}/public`, { recursive: true });

console.log("✓ standalone paketi tamamlandı: statik varlıklar kopyalandı");
