# SVG Animation Generator

上传 SVG → 描边逐笔画出的动画效果。支持保留原色、逐条绘制、图层控制、导出。

![demo](demo.gif)

## 快速开始

```bash
npm install
npm run dev        # 开发模式，浏览器自动打开，热更新
npm run build      # 输出 dist/index.html（单文件，双击即用）
```

直接使用：打开 `dist/index.html`，无需安装任何东西。`dist/svg/` 下有示例 SVG 可直接拖入试用。

## 功能

- **描边动画** — stroke-dasharray 逐笔绘制
- **保留原色** — 恢复 SVG 原始配色，自动处理 `fill=""`、缺省黑色等边界情况
- **逐条绘制** — 路径一根一根画，可配置间隔
- **图层控制** — 单独开关每条路径的可见性
- **导出** — HTML / SVG / PNG / JPG
- **键盘** — ← → 逐帧微调，Shift 加速，800ms 无操作自动恢复播放

## 项目结构

```
src/
├── main.ts          # 入口
├── style.css        # 样式
├── types.ts         # TypeScript 类型
├── state.ts         # 全局状态 & 常量
├── utils.ts         # 纯工具函数
├── parser.ts        # SVG 解析
├── renderer.ts      # DOM 构建
├── animator.ts      # 动画引擎（含逐条绘制）
├── exporter.ts      # 导出（HTML/SVG/PNG/JPG）
└── ui.ts            # 事件绑定 & 图层面板
```

## 技术栈

- TypeScript + Vite
- vite-plugin-singlefile（构建为单 HTML）
- SVG stroke-dasharray 动画
- 无框架依赖
