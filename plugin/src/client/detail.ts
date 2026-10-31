/**
 * 卡片详情：名称、许可三档署名、风格原文全文（只读）、可选「主题」、应用按钮。
 *
 * 只负责画与收集输入；应用动作由 panel 统一走适配器，错误文本也从外面传进来。
 */
import * as React from "react";
import { styleLabel } from "../catalog/groups";
import type { StyleAsset } from "../catalog/types";
import { styleAttribution } from "./attribution";
import { StillImage, stillUrl } from "./still";

export interface StyleDetailProps {
  readonly style: StyleAsset;
  readonly theme: string;
  readonly error: string | null;
  readonly onThemeChange: (value: string) => void;
  readonly onApply: () => void;
  readonly onBack: () => void;
}

export function StyleDetail(props: StyleDetailProps): React.ReactElement {
  const { style, theme, error, onThemeChange, onApply, onBack } = props;
  const attribution = styleAttribution(style);
  return React.createElement(
    "div",
    { className: "dsc-detail", "data-card-id": style.id },
    React.createElement(
      "div",
      { className: "dsc-detail-bar" },
      React.createElement(
        "button",
        {
          type: "button",
          className: "dsc-detail-back",
          "data-role": "detail-back",
          autoFocus: true,
          onClick: onBack,
        },
        "← 返回卡片墙",
      ),
      React.createElement(
        "span",
        { className: "dsc-detail-badge" },
        style.id + " · " + style.category + (style.subcategory === "" ? "" : " · " + style.subcategory),
      ),
    ),
    React.createElement("h3", { className: "dsc-detail-title" }, styleLabel(style)),
    stillUrl(style.stillPath) === null
      ? null
      : React.createElement(
          "div",
          { className: "dsc-detail-still", "data-role": "detail-still" },
          React.createElement(StillImage, { style, className: "dsc-detail-still-frame", fallback: null }),
        ),
    React.createElement(
      "div",
      { className: "dsc-license", "data-license": attribution.badge },
      React.createElement("span", { className: "dsc-license-badge" }, attribution.badge),
      React.createElement("span", { className: "dsc-license-copyright" }, attribution.copyright),
      React.createElement("span", { className: "dsc-license-note" }, attribution.note),
      React.createElement("span", { className: "dsc-license-source" }, "来源：" + attribution.source),
    ),
    React.createElement("div", { className: "dsc-detail-label" }, "风格原文（只读，逐字）"),
    React.createElement(
      "pre",
      { className: "dsc-detail-prompt", "data-role": "detail-prompt", tabIndex: 0 },
      style.prompt,
    ),
    React.createElement(
      "label",
      { className: "dsc-theme" },
      React.createElement("span", { className: "dsc-theme-label" }, "主题（可选）"),
      React.createElement("input", {
        type: "text",
        className: "dsc-theme-input",
        value: theme,
        placeholder: "这一条想让动画讲什么？会给任务说明加一行主题",
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onThemeChange(event.target.value),
      }),
    ),
    error === null
      ? null
      : React.createElement("p", { className: "dsc-detail-error", role: "alert" }, error),
    React.createElement(
      "div",
      { className: "dsc-detail-actions" },
      React.createElement(
        "button",
        { type: "button", className: "dsc-apply", onClick: onApply },
        "应用",
      ),
      React.createElement(
        "span",
        { className: "dsc-apply-hint" },
        "会打开一个新会话并把草稿填进输入框，不会自动发送。",
      ),
    ),
  );
}