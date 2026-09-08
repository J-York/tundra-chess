# BOH 部署 · 三章手绘场景

2026-09-08：公开入口 https://chess.jyork.de/ 。本次更新独立游戏站点静态文件。

- 当前版本：`/personal/tundra-chess/releases/20260908-222839-chapter-art`，current 已原子切换。
- 保留回退版本：`/personal/tundra-chess/releases/20260908-073703-drift-free-rules`。
- 已发布美术提交：`7d7c84d`；包含此前已验收的界面模块拆分，完整文件清单见 release-files.json。
- 发布脚本的 76 项规则检查、语法检查、ESLint 和 Prettier 检查通过。完整浏览器回归及三章六张截图见 QA.md。
- 源站返回 200，全部 16 项文件哈希与本地一致。
- 终端直连公网请求被企业网络过滤页重定向，deploy.py 在公网检查阶段退出，未自动写发布记录；没有重复发布或改动网络安全设置。
- 随后通过 Ego Lite 正常浏览器访问逐项验证：16 个公开资源均 HTTPS 200，SHA-256 与本地逐字节一致（本次首页无需归一化）；发布记录据此补齐。
- 公网首页引用 chapter-forest.webp，三张背景均解码为 1536×1024，界面模块正常加载，验收视口无横向溢出。
- 本轮未改动 Nginx、隧道或进程配置，未重启 BOH 容器。只发布 release-files.json 中的静态文件，PNG 源图与测试文件留在仓库。
- 使用现有 v3 存档，公网检查没有操作远征进度。

历史版本与回退链见 RELEASES.md。
