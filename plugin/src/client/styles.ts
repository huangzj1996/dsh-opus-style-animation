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
  backdrop-filter: var(--dsw-mask-blur, none);
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
`;
