# SVG Animation Generator

上传 SVG → 描边逐笔画出的动画。双栏 UI：顶部配置、底部播放。

![demo](demo.gif)

## 快速开始

```bash
npm install
npm run dev        # 开发模式，热更新
npm run build      # 输出 dist/index.html，双击即用
```

在线试用：打开 [dist/index.html](dist/index.html)，拖入 `dist/svg/` 下的示例 SVG。

## 功能

| 分类 | 功能 |
|------|------|
| 动画 | 描边逐笔绘制、逐条绘制（可配间隔）、速度控制、保留/消退描边 |
| 颜色 | 描边色/填色独立调节、颜色同步、保留原色（自动处理 `fill=""` 等边界情况） |
| 导出 | HTML（完整动画）、SVG（当前画面快照）、PNG / JPG |
| 交互 | 时间轴拖拽、← → 逐帧微调（Shift 加速）、800ms 无操作自动恢复播放 |
| 工具 | 粘贴 SVG 代码、拖放上传、图层独立开关、图层面板拖动（支持触摸） |

## 项目结构

```
src/
├── core/
│   ├── parser.ts         # SVG 解析
│   ├── renderer.ts       # DOM 构建
│   └── animator.ts       # 动画引擎
├── ui/
│   └── controls.ts       # 事件绑定 & 图层面板
├── export/
│   └── exporter.ts       # 导出（HTML/SVG/PNG/JPG）
├── state/
│   ├── store.ts          # 全局状态 & 常量
│   └── types.ts          # TypeScript 类型
├── utils/
│   └── helpers.ts        # 纯工具函数
├── main.ts               # 入口
└── style.css             # 样式
```

## 技术栈

- TypeScript（strict）+ Vite
- vite-plugin-singlefile → 构建为单 HTML
- SVG stroke-dasharray 动画
- 无框架依赖
