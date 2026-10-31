import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LicenseId } from "../src/catalog/types";

// 许可与来源也是本票的交付物（#26）。这里钉两件事：
// 1) 包清单的 license 字段不冒充 MIT，包内许可说明覆盖三档署名；
// 2) 随附的许可文件与逐条来源表，和 assets/index.json 的许可分档逐条对得上。
// 期望值来自 #12 的结论（MIT 105 / free-share-no-sell 236 / 逐条来源）与索引本身，不是重算索引。
const pkgDir = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(pkgDir, "..");
const assetsRoot = path.join(repoRoot, "assets");
const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8")) as { license?: string };
const index = JSON.parse(readFileSync(path.join(assetsRoot, "index.json"), "utf8")) as {
  source: { licenseFiles: readonly string[] };
  styles: readonly { id: string; name: string; series: string; license: LicenseId; source: string }[];
};
const readAsset = (...parts: string[]) => readFileSync(path.join(assetsRoot, ...parts), "utf8");

describe("包许可字段（#12 结论）", () => {
  it("license 不写 MIT，指向包内 LICENSE.md，且许可说明覆盖三档与署名", () => {
    expect(pkg.license).toBe("SEE LICENSE IN LICENSE.md");
    const noticePath = path.join(pkgDir, "LICENSE.md");
    expect(existsSync(noticePath)).toBe(true);
    const notice = readFileSync(noticePath, "utf8");
    expect(notice).toContain("MIT");
    expect(notice).toContain("free-share-no-sell");
    expect(notice).toContain("105");
    expect(notice).toContain("236");
    expect(notice).toContain("来源：来自俯仰观照博主的动画画风整理");
    expect(notice).toContain("非商业");
    expect(notice).toContain("assets/LICENSES/");
  });
});

describe("随附许可文件（assets/LICENSES/）", () => {
  it("索引声明的许可文件都随附：自定义许可、NOTICE、来源说明与三份第三方 MIT", () => {
    expect(index.source.licenseFiles).toEqual([
      "LICENSES/LICENSE",
      "LICENSES/NOTICE.md",
      "LICENSES/许可与来源.md",
      "LICENSES/第三方许可/",
    ]);
    for (const entry of index.source.licenseFiles) {
      expect(existsSync(path.join(assetsRoot, entry)), entry).toBe(true);
    }
    expect(readdirSync(path.join(assetsRoot, "LICENSES", "第三方许可")).sort()).toEqual([
      "Lemo-Opuscar_LICENSE.txt",
      "code-video_LICENSE.txt",
      "mg-styles-15_LICENSE.txt",
    ]);
  });

  it("素材包自定义许可原文：非商业、可免费再分发、必须保留署名", () => {
    const license = readAsset("LICENSES", "LICENSE");
    expect(license).toContain("自定义非商业许可");
    expect(license).toContain("不是 OSI");
    expect(license).toContain("免费再分发");
    expect(license).toContain("保留署名");
    expect(license).toContain("来源：来自俯仰观照博主的动画画风整理");
    expect(readAsset("LICENSES", "许可与来源.md")).toContain("禁止包装成课程");
  });

  it("NOTICE 列出 L / V / X 三个 MIT 系列、数量与版权人，且只覆盖这三个系列", () => {
    const notice = readAsset("LICENSES", "NOTICE.md");
    for (const row of ["| **L** | 59 |", "| **V** | 15 |", "| **X** | 31 |"]) {
      expect(notice).toContain(row);
    }
    for (const copyright of [
      "Copyright (c) 2026 LemoLab",
      "Copyright (c) 2026 Vincentwei1021",
      "Copyright (c) 2026 Bae-ChangHyun",
    ]) {
      expect(notice).toContain(copyright);
    }
    expect(notice).toContain("合计 **105** 种");
    expect(notice).toContain("MIT 条款只覆盖上表所列的 L / V / X 三个系列");
  });

  it("三份第三方许可是 MIT 原文，版权人逐份对得上", () => {
    const expected = {
      "Lemo-Opuscar_LICENSE.txt": "Copyright (c) 2026 LemoLab",
      "mg-styles-15_LICENSE.txt": "Copyright (c) 2026 Vincentwei1021",
      "code-video_LICENSE.txt": "Copyright (c) 2026 Bae-ChangHyun",
    };
    for (const [file, copyright] of Object.entries(expected)) {
      const text = readAsset("LICENSES", "第三方许可", file);
      expect(text).toContain("MIT License");
      expect(text).toContain(copyright);
    }
  });
});

describe("逐条来源表（assets/SOURCES.md）", () => {
  it("341 行与索引逐条一致：id / 名称 / 系列 / 许可 / 来源", () => {
    const rows = readAsset("SOURCES.md")
      .split(/\r?\n/)
      .filter((line) => line.startsWith("| "))
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      )
      .filter((cells) => {
        const first = cells[0] ?? "";
        return first !== "id" && !/^-+$/.test(first);
      });
    expect(rows).toHaveLength(341);
    expect(rows).toEqual(index.styles.map((style) => [style.id, style.name, style.series, style.license, style.source]));
    expect(rows.filter((cells) => cells[3] === "MIT")).toHaveLength(105);
    expect(rows.filter((cells) => cells[3] === "free-share-no-sell")).toHaveLength(236);
  });

  it("表头说明它是生成物（勿手改）并给出三档数量", () => {
    const text = readAsset("SOURCES.md");
    expect(text).toContain("由 `scripts/build-assets.mjs` 从素材包 `code-animation-341-styles-main/`（不入库）生成，勿手改");
    expect(text).toContain("MIT 105 / free-share-no-sell 236");
    expect(text).toContain("许可原文见 `LICENSES/`");
  });
});
