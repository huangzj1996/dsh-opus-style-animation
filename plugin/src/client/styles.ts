/**
 * 浮层与入口的样式。全部走宿主的主题令牌，深浅色随宿主切换；令牌取不到时退回中性值，
 * 只影响观感、不会让界面崩掉。
 *
 * 尺寸与状态抄的是宿主自己的行/弹窗（settings 触发行、settings 全屏层的遮罩），
 * 因为第三方 bundle 不允许 import 宿主组件，只能照着长。
 */
export const STYLE_CARDS_CSS = `
.dsc-row {
  box-sizing: border-box;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 42px;
  margin: 0;
  padding: 0 10px 0 8px;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  background: 0 0;
  color: var(--dsw-alias-label-primary, #111827);
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
  overflow: hidden;
}
.dsc-row:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}
.dsc-row:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}
.dsc-row.dsc-rail {
  flex: none;
  justify-content: center;
  gap: 0;
  width: 36px;
  height: 36px;
  padding: 0;
}
.dsc-row-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dsc-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.42));
  animation: dsc-fade-in 120ms ease-out;
}
@keyframes dsc-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .dsc-overlay { animation: none; }
}
.dsc-panel {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: min(960px, calc(100vw - 64px));
  height: min(680px, calc(100vh - 96px));
  min-height: 0;
  overflow: hidden;
  border-radius: var(--dsw-radius-panel, 14px);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-primary, #111827);
  box-shadow: var(--dsw-elevation-prominent, 0 18px 48px rgba(0, 0, 0, 0.28));
}
.dsc-panel:focus {
  outline: none;
}
.dsc-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.08));
}
.dsc-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.dsc-close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  background: 0 0;
  color: inherit;
  opacity: 0.75;
  cursor: pointer;
}
.dsc-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  opacity: 1;
}
.dsc-close:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}
.dsc-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 20px;
}
.dsc-empty {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
  font-size: 13px;
  line-height: 1.7;
}

/* —— #21 卡片墙 —— */
.dsc-wall {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.dsc-wall-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  padding-bottom: 4px;
  color: var(--dsw-alias-label-tertiary, #6b7280);
  font-size: 12px;
  line-height: 18px;
}
.dsc-wall-baseline {
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.dsc-series {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dsc-series-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 6px 6px;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  background: 0 0;
  color: var(--dsw-alias-label-primary, #111827);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.dsc-series-head:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}
.dsc-series-head:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}
.dsc-series-caret {
  display: inline-block;
  flex: none;
  width: 14px;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
  transition: transform 120ms ease-out;
  transform: rotate(90deg);
}
.dsc-series-caret[data-collapsed] {
  transform: rotate(0deg);
}
@media (prefers-reduced-motion: reduce) {
  .dsc-series-caret {
    transition: none;
  }
}
.dsc-series-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dsc-series-count {
  flex: none;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.dsc-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.dsc-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.08));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.04));
}
.dsc-card-thumb {
  aspect-ratio: 16 / 10;
  width: 100%;
}
/* 系列占位色是内容色（10 个系列各一档），不是宿主主题色；集中在这里，
   卡片组件不再带内联背景样式。 */
.dsc-card[data-series="AG"] .dsc-card-thumb { background: linear-gradient(135deg, #6d7cff, #3f4dd8); }
.dsc-card[data-series="M"] .dsc-card-thumb { background: linear-gradient(135deg, #ff8a4c, #d94f2b); }
.dsc-card[data-series="K"] .dsc-card-thumb { background: linear-gradient(135deg, #ffd166, #e09f2f); }
.dsc-card[data-series="Z"] .dsc-card-thumb { background: linear-gradient(135deg, #8bc6a4, #3f7d63); }
.dsc-card[data-series="H"] .dsc-card-thumb { background: linear-gradient(135deg, #f4a7c0, #c2557f); }
.dsc-card[data-series="L"] .dsc-card-thumb { background: linear-gradient(135deg, #7fc8e8, #2f7fa8); }
.dsc-card[data-series="V"] .dsc-card-thumb { background: linear-gradient(135deg, #c6a2f5, #7a4cc4); }
.dsc-card[data-series="X"] .dsc-card-thumb { background: linear-gradient(135deg, #9ad0ec, #4f8fb5); }
.dsc-card[data-series="R"] .dsc-card-thumb { background: linear-gradient(135deg, #ff6b9d, #8e3bd1); }
.dsc-card[data-series="O"] .dsc-card-thumb { background: linear-gradient(135deg, #e0c47a, #a07b2e); }
.dsc-card-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 7px 9px 9px;
}
.dsc-card-id {
  color: var(--dsw-alias-label-tertiary, #9ca3af);
  font-size: 11px;
  line-height: 15px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.dsc-card-name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #111827);
  font-size: 12.5px;
  line-height: 1.4;
}

/* —— #22 卡片可点 / 详情 / 轻提示 —— */
.dsc-card {
  margin: 0;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.08));
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsc-card:hover {
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.35));
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
}
.dsc-card:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #111827);
  outline-offset: 1px;
}
.dsc-card-thumb {
  display: block;
}

.dsc-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.dsc-detail-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}
.dsc-detail-back {
  margin: 0;
  padding: 5px 10px 5px 6px;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  background: 0 0;
  color: inherit;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.dsc-detail-back:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}
.dsc-detail-back:focus-visible,
.dsc-apply:focus-visible,
.dsc-theme-input:focus-visible,
.dsc-detail-prompt:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}
.dsc-detail-badge {
  color: var(--dsw-alias-label-tertiary, #6b7280);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.dsc-detail-title {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
}
.dsc-license {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.08));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.04));
  font-size: 12px;
  line-height: 18px;
}
.dsc-license-badge {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.16));
  font-weight: 600;
}
.dsc-license[data-license="MIT"] .dsc-license-badge {
  background: var(--dsw-alias-state-success-tertiary, rgba(127, 127, 127, 0.16));
}
.dsc-license[data-license="free-share-no-sell"] .dsc-license-badge {
  background: var(--dsw-alias-state-warn-tertiary, rgba(127, 127, 127, 0.16));
}
.dsc-license-copyright {
  color: var(--dsw-alias-label-primary, #111827);
  font-weight: 500;
}
.dsc-license-note {
  color: var(--dsw-alias-label-tertiary, #6b7280);
}
.dsc-license-source {
  flex-basis: 100%;
  color: var(--dsw-alias-label-tertiary, #6b7280);
  overflow-wrap: anywhere;
}
.dsc-detail-label {
  color: var(--dsw-alias-label-tertiary, #6b7280);
  font-size: 12px;
  line-height: 18px;
}
.dsc-detail-prompt {
  box-sizing: border-box;
  max-height: 42vh;
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.08));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.04));
  color: var(--dsw-alias-label-primary, #111827);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 19px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
}
.dsc-theme {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dsc-theme-label {
  color: var(--dsw-alias-label-tertiary, #6b7280);
  font-size: 12px;
  line-height: 18px;
}
.dsc-theme-input {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.35));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-primary, #111827);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
}
.dsc-theme-input::placeholder {
  color: var(--dsw-alias-label-tertiary, #9ca3af);
}
.dsc-detail-error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-label-error, rgba(127, 127, 127, 0.45));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-interactive-bg-hover-danger, rgba(127, 127, 127, 0.08));
  color: var(--dsw-alias-label-error, #b42318);
  font-size: 12.5px;
  line-height: 19px;
}
.dsc-detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding-top: 2px;
}
.dsc-apply {
  flex: none;
  margin: 0;
  padding: 8px 22px;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-button-primary-fill, #2563eb);
  color: var(--dsw-alias-label-primary-foreground, #ffffff);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  cursor: pointer;
}
.dsc-apply:hover {
  background: var(--dsw-alias-button-primary-hover, #1d4ed8);
}
.dsc-apply-hint {
  color: var(--dsw-alias-label-tertiary, #6b7280);
  font-size: 12px;
  line-height: 18px;
}

.dsc-toast {
  position: fixed;
  left: 50%;
  bottom: 40px;
  z-index: 1001;
  transform: translateX(-50%);
  max-width: calc(100vw - 48px);
  padding: 9px 16px;
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-toast-bg, rgba(17, 24, 39, 0.92));
  color: var(--dsw-alias-toast-label, #ffffff);
  font-size: 13px;
  line-height: 20px;
  box-shadow: var(--dsw-elevation-prominent, 0 10px 30px rgba(0, 0, 0, 0.28));
  pointer-events: none;
  animation: dsc-toast-in 140ms ease-out;
}
@keyframes dsc-toast-in {
  from { opacity: 0; transform: translate(-50%, 6px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .dsc-toast { animation: none; }
}
`;