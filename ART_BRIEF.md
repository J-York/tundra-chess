# 章节场景美术规格

2026-09-08：三张独立章节场景已通过内置 ImageGen 生成，并接入本地游戏。原图与 WebP 一并保留；资源尺寸和压缩结果见 assets/README.md。此前的生成服务连接阻塞已解除。

## 统一规格

三张独立 3:2 横幅，1536×1024。略俯视的手绘水粉奇幻场景；边缘细节丰富，中央约 70% 留作低对比度空地，供现有棋盘覆盖。与现有苔原远征角色搭配，保留自然、静谧、精致的气质。无人物、文字、UI、格线、水印。生成后分别保存为 assets/chapter-forest.webp、assets/chapter-ruin.webp、assets/chapter-moon.webp。

## 最终提示词

Shared specification: Premium hand-painted gouache storybook fantasy game environment, landscape 3:2, 1536x1024. Slightly elevated view, rich atmospheric depth. The central 70 percent is a broad quiet low-contrast empty clearing for an overlaid tactical board; detailed environmental storytelling stays around the edges. Elegant muted colors, soft painterly texture, no people, no UI, no grid, no text, no watermark.

- Forest: Ancient mossy woodland at dawn, enormous tree trunks framing the edges, ferns, small cream mushrooms, golden fireflies and warm honey sunlight over the clearing. Sage green and deep teal palette.
- Ruin: Abandoned astral observatory clearing, weathered pale stone arches at the edges, moss-covered star carvings, amber lanterns and a tranquil teal spring. Dusky green, pale stone and warm ivory palette.
- Moon: Midnight sacred grove, silver-blue foliage framing the edges, distant luminous ancient tree and a crescent moon, delicate lavender mist and cyan reflections around a wide empty clearing. Navy, silver cyan and muted lavender palette.

## 接入与验收

生成结果先目视检查，再通过 cwebp 压缩（保留原分辨率，原图留作源码资源）；场景只在本地加载，不在游玩时请求生成服务。style.css 按 theme-forest / theme-ruin / theme-moon 引用对应资源，终局可复用第三章背景。更新 release-files.json；三章场景分别做桌面与手机截图，检查棋盘对比度、角色可读性和背景加载。最后发布到 BOH 并核对每个公开资源的 SHA-256，保留上一版。

## 角色与棋盘融合 · 2026-09-09

角色保留独立 SVG 轮廓，使用左上受光、右下暗面的材质渐变。守卫护甲、游侠斗篷与法师长袍增加曲线，各伙伴补充与装备位置对应的高光刻线；大色块承担小尺寸识别，细节用于图鉴和详情。配色仍来自现有角色定义，渐变模板只在初始化时计算一次，每个实例使用独立 SVG ID。

棋盘角色使用单层接触阴影与薄队伍环，移除厚圆盘及重复投影。己方实线、敌方虚线结合色彩区分；选中及键盘聚焦统一使用暖色亮环，二/三星标记保持可见。三章分别提供暖金、灰绿和银蓝细节反光。角色已有受击、施法、移动动画继续作用于原有图层。

验收覆盖完整角色图册、三章桌面与手机棋盘，以及 SVG 解析、渐变引用、实例 ID 唯一性。复现命令见 QA.md。

## 战斗反馈与界面统一 · 2026-09-09

命中采用短斩痕（物理）、菱形（法术）、十字冲击（真实伤害）；治疗使用绿色十字，护盾使用蓝色盾形，破盾使用断裂盾形。飘字保留数值与正负号，部分吸收同时显示扣血和护盾损耗，避免仅靠颜色传达含义。同一格最多三条飘字，整层最多 32 条飘字与 64 个 SVG 特效。暂停时新建特效也保持暂停，减动画设置清除并抑制瞬态效果。

界面统一使用深绿面板、浅色边框、暖金聚焦轮廓和一致的卡片圆角。酒馆、图鉴、开局选项、装备行囊沿用这一材质层级。地图、音效、设置、信息、生命、攻击、护甲和金币使用同一套线性 SVG；角色与物品的主题符号保留。图标隐藏于辅助技术，按钮沿用文字或 aria-label。

## 章节氛围延伸 · 2026-09-09

三章场景延伸到旅途、路线图及地图/精制弹窗，复用已有 WebP，不新增图片或动画。苔林使用苔绿与暖火，回廊使用灰青与碎星，长夜使用银蓝与月霜。各章拥有独立的营地、游商、宝箱标题及短叙事，事件原文与实际规则说明保留。首领侦察加入章节引子，并与战术说明分层展示。

地图预览根据正在查看的章节取景，独立于当前远征章节；未知事件仍不提前展示名称。手机保留旅途纵向滚动与地图横向滚动，装饰符号不进入辅助技术朗读。
