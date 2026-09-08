# BOH 部署 · 二十二伙伴与交叉羁绊

2026-09-05：公开入口 https://chess.jyork.de/ 。本次只更新独立游戏站点静态文件。

- 当前版本：`/personal/tundra-chess/releases/20260908-073703-drift-free-rules`，current 已原子切换。
- 保留回退版本：`/personal/tundra-chess/releases/20260908-064830-balance-and-tooling`。
- Nginx：`/etc/nginx/conf.d/tundra-game.conf`，仅监听 `127.0.0.1:8879`。
- 隧道：tundra-chess；Supervisor 配置 `/personal/tundra-chess/private/supervisord.conf`。本次没有修改或重启隧道，发布后 RUNNING。
- 凭据与测试文件不属于公开目录。沿用此前自动重启和 cron @reboot 设置；本次没有重启整个 BOH 容器。
- 源站规则模块 SHA-256 与本地相同，源站正常响应。
- 公开 index.html、style.css、world.js、engine.js、game.js、audio.js、art.js、assets/forest.webp 均 HTTPS 200，SHA-256 与本地测试版一致。
- 69 项规则回归与本轮浏览器验证见 QA.md。
- 本次 ego-browser 公网导航成功：首页显示新成长位说明；实际打开 23 节点章地图、关闭后查看伙伴面板，技能预览按钮存在。读取到险境倍率 1.20 与新报告分析函数。没有改变远征进度。完整战斗交互在本地隔离页面验证。
- 继续使用 v3 存档。已有地图保持不变，新远征生成平滑后的敌群；旧战斗快照继续原进度，详细战报从新战斗开始记录。新经济及交互随更新生效。
- 目录不属于 Git 仓库，本次没有 commit / push。

2026-09-05 角色扩充版：`20260905-211704-companions-22` 已发布，8 个公网资源 HTTPS 200，SHA-256 与本地一致；回退为 `20260905-174231-assets-utf8`。仅更新静态发布目录，未改动隧道配置或重启 BOH 容器。
