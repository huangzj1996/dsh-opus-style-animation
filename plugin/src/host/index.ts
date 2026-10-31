/**
 * Opus 片场的宿主半边。
 *
 * v1 的插件能力全在浏览器半边（侧栏入口 + 浮层），宿主侧不需要任何服务：
 * 这一行存在的意义是让 Loader 里有一行它，客户端 bundle 才能随行装载。
 * 因此它只声明自己、什么都不做，也不 inject 任何服务——profile 里缺服务时不会把它拖崩。
 */
export default {
  name: "dsh-style-cards",
  apply(): void {
    // 无宿主副作用。
  },
};
