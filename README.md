# SVG Animation Generator

上传 SVG → 描边逐笔画出的动画效果。支持保留原色、图层控制、导出 HTML/SVG/PNG/JPG。

## 快速开始

```bash
npm install
npm run dev        # 开发模式，浏览器自动打开，热更新
npm run build      # 输出 dist/index.html（单文件，双击即用）
```

直接使用：打开 `dist/index.html`，无需安装任何东西。

## 项目结构

```
src/
├── main.js          # 入口
├── style.css        # 样式
├── state.js         # 全局状态 & 常量
├── utils.js         # 纯工具函数
├── parser.js        # SVG 解析
├── renderer.js      # DOM 构建
├── animator.js      # 动画引擎
├── exporter.js      # 导出（HTML/SVG/PNG/JPG）
└── ui.js            # 事件绑定 & 图层面板
```

## 技术栈

- Vite + vanilla JS (ES modules)
- vite-plugin-singlefile（构建为单 HTML）
- SVG stroke-dasharray 动画
- 无框架依赖
