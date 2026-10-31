/**
 * Opus 片场的宿主半边：注册缩略图 prefix 路由（ADR-0002）。
 *
 * - 路由 /style-cards 只服务资产目录 assets/stills/（v1 link 安装 = 仓库根）里的扁平 <id>.jpg；
 * - 资产在仓库根 assets/（v1 用 link 安装，lib/../.. 即仓库根）；将来打包分发时要把
 *   assets/stills 拷进包内——见 ADR-0002 的「源包保留策略」与 #26。
 * - 服务缺席（如 Electron file:// 模式）时宿主半边不激活；客户端自动退化为系列色块占位。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStillsRoute, type StillsRoute } from "./stills-route";

/** lib/index.js → plugin/ → 仓库根/assets/stills。 */
const STILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "stills");

interface WebServerLike {
  register(route: StillsRoute): () => void;
}

interface HostPluginContext {
  webServer: WebServerLike;
  effect(setup: () => () => void, label?: string): void;
}

export default {
  name: "dsh-style-cards",
  inject: ["webServer"],
  apply(ctx: HostPluginContext): void {
    const route = createStillsRoute({ stillsDir: STILLS_DIR });
    ctx.effect(() => ctx.webServer.register(route), "dsh-style-cards: stills route");
  },
};