# 场景素材

## 章节场景 · 2026-09-08

使用 Codex 内置 ImageGen 分别生成三张 1536×1024 手绘场景，中央低对比度空地供棋盘覆盖，边缘保留环境细节；生成规格见 `ART_BRIEF.md`。

| 章节 | 原图 | 游戏资源 | WebP 字节数 |
| --- | --- | --- | ---: |
| 苔林边境 | chapter-forest.png | chapter-forest.webp | 243652 |
| 沉星回廊 | chapter-ruin.png | chapter-ruin.webp | 316708 |
| 长夜之心 | chapter-moon.png | chapter-moon.webp | 386814 |

WebP 使用 `cwebp -q 85 -m 6` 转码，保留原分辨率，总计 947174 字节（约 925 KiB），较三张 PNG 合计减少约 89.7%。PNG 原件保留在源码中，发布清单仅包含 WebP。场景随当前节点主题加载，终局复用月夜场景；角色继续使用 `art.js` 独立 SVG。游戏运行不请求图像生成服务。

`style.css` 的 `--scene-forest` / `--scene-ruin` / `--scene-moon` 是路径唯一声明处；`.arena` 默认使用林地，章节规则覆盖 `--scene`，未知主题回退林地。旧 `theme-heart` 兼容月夜场景。

## 旧版素材

`forest.png` / `forest.webp` 为 2026-09-05 生成的旧版森林背景，保留供源图追溯，不再进入新发布包。旧 WebP 为 1536×1024、340820 字节（质量 88、method 6）。
