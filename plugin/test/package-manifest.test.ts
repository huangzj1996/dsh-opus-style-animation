import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 清单与随包资源：宿主在激活插件之前就读它们（bundle patch / client 半 / 展示元数据），
// 缺一项的表现都是「插件管理器里看不到它」或「装上了但没有界面」，所以逐项钉住。
const pkgDir = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));

describe("插件包清单", () => {
  it("声明 bundle patch，且 patch 里真有插入本插件的 Loader 行", () => {
    expect(pkg.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
    const patchPath = path.join(pkgDir, "cordis.patch.yml");
    expect(existsSync(patchPath)).toBe(true);
    const patch = readFileSync(patchPath, "utf8");
    expect(patch).toContain("insert:");
    expect(patch).toMatch(/- id: dsh-style-cards\b/);
    expect(patch).toMatch(/name: '?dsh-style-cards'?/);
  });

  it("声明浏览器半边：web 平台、随行加载、导出 client 产物", () => {
    expect(pkg.dsh?.client).toMatchObject({ platform: "web", immediately: true });
    expect(pkg.exports?.["./client"]).toBeDefined();
    expect(existsSync(path.join(pkgDir, pkg.exports["./client"]))).toBe(true);
  });

  it("带展示元数据（标题与描述）和图标", () => {
    for (const locale of ["zh", "en"]) {
      const meta = JSON.parse(readFileSync(path.join(pkgDir, "locale", locale + ".json"), "utf8")).meta;
      expect(meta.title).toBeTruthy();
      expect(meta.description).toBeTruthy();
    }
    expect(existsSync(path.join(pkgDir, "icon.svg"))).toBe(true);
  });
});