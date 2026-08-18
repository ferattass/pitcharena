import { describe, expect, it } from "vitest";
import { disagreementIndex, disagreementLabel, weightedOverall } from "@/lib/scoring";

describe("weightedOverall", () => {
  const full = [
    { dimension: "Pazar Fırsatı", value: 80 },
    { dimension: "Rekabet Avantajı", value: 60 },
    { dimension: "Teknik Yapılabilirlik", value: 70 },
    { dimension: "İş Modeli", value: 50 },
    { dimension: "Risk Profili", value: 40 },
  ];

  it("ağırlıkları plandaki oranlarla uygular", () => {
    // 80*.25 + 60*.20 + 70*.20 + 50*.20 + 40*.15 = 62
    expect(weightedOverall(full)).toBe(62);
  });

  it("aynı girdide her zaman aynı sonucu verir", () => {
    expect(weightedOverall(full)).toBe(weightedOverall([...full].reverse()));
  });

  it("eksik boyutları ağırlıktan düşürür, sıfır saymaz", () => {
    // Sadece Pazar Fırsatı gelirse sonuç o boyutun kendisi olmalı.
    expect(weightedOverall([{ dimension: "Pazar Fırsatı", value: 80 }])).toBe(80);
  });

  it("boyut yoksa çökmez", () => {
    expect(weightedOverall([])).toBe(0);
  });

  it("tanınmayan boyutu yok sayar", () => {
    expect(weightedOverall([{ dimension: "Uydurma Boyut", value: 100 }])).toBe(0);
  });
});

describe("disagreementIndex", () => {
  it("üçü aynı karar verdiğinde sıfırdır", () => {
    expect(disagreementIndex(["INVEST", "INVEST", "INVEST"])).toBe(0);
    expect(disagreementIndex(["PASS", "PASS", "PASS"])).toBe(0);
  });

  it("en uçta ayrışmada 100'e ulaşır", () => {
    expect(disagreementIndex(["INVEST", "PASS", "PASS"])).toBe(100);
  });

  it("kısmi ayrışmayı aradaki bir değerle gösterir", () => {
    const index = disagreementIndex(["INVEST", "FOLLOW_UP", "PASS"]);
    expect(index).toBeGreaterThan(0);
    expect(index).toBeLessThan(100);
  });

  it("tek karar için tanımsızdır, sıfır döner", () => {
    expect(disagreementIndex(["INVEST"])).toBe(0);
  });
});

describe("disagreementLabel", () => {
  it("eşikleri doğru etiketler", () => {
    expect(disagreementLabel(0).tone).toBe("consensus");
    expect(disagreementLabel(50).tone).toBe("split");
    expect(disagreementLabel(90).tone).toBe("contested");
  });
});
