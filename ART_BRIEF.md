# 待生成的章节场景

当前阻塞：内置图像生成服务连续返回连接失败，没有生成文件。本机未配置 OPENAI_API_KEY，未启动 CLI/API 备用生成。现有角色 SVG、战斗表现及资源压缩已完成并上线，新章节背景仍待完成。

## 统一规格

三张独立 3:2 横幅，1536×1024。略俯视的手绘水粉奇幻场景；边缘细节丰富，中央约 70% 留作低对比度空地，供现有棋盘覆盖。与现有苔原远征角色搭配，保留自然、静谧、精致的气质。无人物、文字、UI、格线、水印。生成后分别保存为 assets/chapter-forest.webp、assets/chapter-ruin.webp、assets/chapter-moon.webp。

## 最终提示词

Shared specification: Premium hand-painted gouache storybook fantasy game environment, landscape 3:2, 1536x1024. Slightly elevated view, rich atmospheric depth. The central 70 percent is a broad quiet low-contrast empty clearing for an overlaid tactical board; detailed environmental storytelling stays around the edges. Elegant muted colors, soft painterly texture, no people, no UI, no grid, no text, no watermark.

- Forest: Ancient mossy woodland at dawn, enormous tree trunks framing the edges, ferns, small cream mushrooms, golden fireflies and warm honey sunlight over the clearing. Sage green and deep teal palette.
- Ruin: Abandoned astral observatory clearing, weathered pale stone arches at the edges, moss-covered star carvings, amber lanterns and a tranquil teal spring. Dusky green, pale stone and warm ivory palette.
- Moon: Midnight sacred grove, silver-blue foliage framing the edges, distant luminous ancient tree and a crescent moon, delicate lavender mist and cyan reflections around a wide empty clearing. Navy, silver cyan and muted lavender palette.

## 接入与验收

生成结果先目视检查，再通过 cwebp 压缩（保留原分辨率，原图留作源码资源）；场景只在本地加载，不在游玩时请求生成服务。style.css 按 theme-forest / theme-ruin / theme-moon 引用对应资源，终局可复用第三章背景。更新 release-files.json；三章场景分别做桌面与手机截图，检查棋盘对比度、角色可读性和背景加载。最后发布到 BOH 并核对每个公开资源的 SHA-256，保留上一版。
