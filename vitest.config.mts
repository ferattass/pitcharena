import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Testler saf birimlere bakar: şema sözleşmeleri, skorlama ve olay
    // indirgeyicisi. DB veya ağ gerektiren yollar scripts/smoke.ts ile
    // uçtan uca doğrulanır.
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Simülasyon sağlayıcısının yapay gecikmesi testte gereksiz.
    env: { SIMULATION_NO_DELAY: "1" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
