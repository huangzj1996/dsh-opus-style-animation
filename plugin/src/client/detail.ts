/**
 * 卡片详情：名称、许可三档署名、风格原文全文（只读）、可选「主题」、应用按钮。
 *
 * 只负责画与收集输入；应用动作由 panel 统一走适配器，错误文本与草稿冲突确认也从外面传进来。
 */
import * as React from "react";
import { styleLabel } from "../catalog/groups";
import type { StyleAsset } from "../catalog/types";
import { styleAttribution } from "./attribution";
import { hasStill } from "../shared/stills";
import { StillImage } from "./still";

export interface StyleDetailProps {
  readonly style: StyleAsset;
  readonly theme: string;
  readonly error: string | null;
  /** 应用请求在途：按钮禁用、文案改成「应用中…」。 */
  readonly applying: boolean;
  /** 空白会话已有草稿：显示一次轻确认，确认后覆盖。 */
  readonly confirmDraft: boolean;
  readonly onThemeChange: (value: string) => void;
  readonly onApply: () => void;
  readonly onConfirmApply: () => void;
  readonly onCancelApply: () => void;
  readonly onBack: () => void;
}

/** 空白会话已有草稿时的确认条：默认焦点在「取消」上，避免误覆盖。 */
function DraftConflictConfirm(props: {
  readonly applying: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): React.ReactElement {
  return React.createElement(
    "div",
    { className: "dsc-draft-confirm", "data-role": "draft-confirm", role: "alertdialog", "aria-label": "覆盖草稿" },
    React.createElement(
      "p",
      { className: "dsc-draft-confirm-text" },
      "当前工作区的空白会话里有一份未发送的草稿。应用会打开这个会话，并用草稿覆盖它。",
    ),
    React.createElement(
      "div",
      { className: "dsc-draft-confirm-actions" },
      React.createElement(
        "button",
        {
          type: "button",
          className: "dsc-confirm-cancel",
          "data-role": "draft-confirm-cancel",
          autoFocus: true,
          disabled: props.applying,
          onClick: props.onCancel,
        },
        "取消",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: "dsc-confirm-overwrite",
          "data-role": "draft-confirm-ok",
          disabled: props.applying,
          onClick: props.onConfirm,
        },
        props.applying ? "应用中…" : "覆盖并应用",
      ),
    ),
  );
}

export function StyleDetail(props: StyleDetailProps): React.ReactElement {
  const { style, theme, error, applying, confirmDraft, onThemeChange, onApply, onConfirmApply, onCancelApply, onBack } =
    props;
  const attribution = styleAttribution(style);
  return React.createElement(
    "div",
    { className: "dsc-detail", "data-card-id": style.id, "data-series": style.series },
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
    !hasStill(style)
      ? null
      : React.createElement(
          "div",
          { className: "dsc-detail-still", "data-role": "detail-still" },
          React.createElement(StillImage, { style, className: "dsc-detail-still-frame", fallback: "id" }),
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
    confirmDraft
      ? React.createElement(DraftConflictConfirm, { applying, onConfirm: onConfirmApply, onCancel: onCancelApply })
      : null,
    error === null
      ? null
      : React.createElement("p", { className: "dsc-detail-error", role: "alert" }, error),
    React.createElement(
      "div",
      { className: "dsc-detail-actions" },
      React.createElement(
        "button",
        {
          type: "button",
          className: "dsc-apply",
          disabled: applying || confirmDraft,
          onClick: onApply,
        },
        applying ? "应用中…" : "应用",
      ),
      React.createElement(
        "span",
        { className: "dsc-apply-hint" },
        "会打开一个新会话并把草稿填进输入框，不会自动发送。",
      ),
    ),
  );
}
