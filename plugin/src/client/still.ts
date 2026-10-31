/**
 * 静帧缩略图/大图：同源相对 URL 取自索引里的 stillPath（stills/<id>.jpg）。
 *
 * 没有静帧或加载失败时只退化为这张卡自己的占位（系列色块 + ID），不影响其它卡；
 * 图片走 loading="lazy" / decoding="async"，不进首屏阻塞路径。
 */
import * as React from "react";
import type { StyleAsset } from "../catalog/types";
import { ASSET_INDEX_SHA256 } from "../data/asset-index.generated";
import { stillUrl } from "../shared/stills";

export interface StillImageProps {
  readonly style: Pick<StyleAsset, "id" | "stillPath">;
  /** 外层容器类名（卡片缩略图 / 详情大图共用同一来源，只是尺寸不同）。 */
  readonly className: string;
  /** 缺图或失败时显示什么：系列色块上的 ID，或不显示（详情大图）。 */
  readonly fallback?: "id" | null;
}

export function StillImage(props: StillImageProps): React.ReactElement {
  const [failed, setFailed] = React.useState(false);
  const url = stillUrl(props.style.stillPath, ASSET_INDEX_SHA256);
  const showImage = url !== null && !failed;
  const fallback = props.fallback === undefined ? "id" : props.fallback;
  return React.createElement(
    "span",
    { className: props.className, "data-still": showImage ? "image" : "fallback" },
    showImage
      ? React.createElement("img", {
          className: "dsc-still-img",
          src: url,
          alt: "",
          loading: "lazy",
          decoding: "async",
          onError: () => setFailed(true),
        })
      : fallback === null
        ? null
        : React.createElement("span", { className: "dsc-still-fallback", "aria-hidden": "true" }, props.style.id),
  );
}