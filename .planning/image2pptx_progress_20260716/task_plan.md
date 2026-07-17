# Task Plan: 单页图片逆向还原为可编辑 PPTX

## Goal
将用户提供的 16:9 单页进度路线图图片做成 PPTX，并把视觉 1:1 的最终文件放入 `/Users/mac/Documents/七牛云/7.16`；元素级可编辑逆向仅在通过四层视觉门禁时交付。

## Current Phase
Phase 5 — complete

## Phases

### Phase 1: 隔离目录与输入准备
- [x] 确认用户目标、源图和交付目录
- [x] 创建唯一 RUN_ROOT
- [ ] 复制源图、读取完整技能引用并探色
- [x] 复制源图、读取完整技能引用并探色
- **Status:** complete

### Phase 2: imagegen 四层素材生成
- [x] B2 生成无内容背景图
- [x] B3 生成纯色底整体框架图（首轮未通过视觉 QA，正在重出）
- [x] B4 生成纯色底图标/装饰表
- [x] 写 imagegen-assets-manifest.json
- **Status:** complete

### Phase 3: 图层后处理与布局
- [x] 框架/图标抠图与图标切分自检
- [x] 视觉提取普通文本与源图 bbox
- [x] 写 layout.json 并通过 layout_guard / source boxes
- **Status:** complete

### Phase 4: 合成与视觉 QA
- [x] 合成首轮 PPTX 和预览
- [x] 运行首轮 placement QA 与 visual compare QA
- [ ] 至少完成一轮布局回校并重新生成
- [x] 完成三轮 B3 回校；因均未通过，切换并验证图片型最终版
- **Status:** complete

### Phase 5: 交付
- [x] 检查最终 PPTX 可打开、无画布溢出、ZIP 结构无错误
- [x] 复制便捷副本到 7.16 根目录
- [x] 准备向用户提供可点击路径
- **Status:** complete

## Key Questions
1. 源图实际像素尺寸和安全抠图底色是什么？
2. imagegen 是否能稳定保持原页 1:1 结构与图标内容？
3. 最终文本、图标和框架是否与源图对位且无重影？

## Decisions Made
| Decision | Rationale |
|---|---|
| 使用唯一 RUN_ROOT `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-progress-slide-Gs3qk2` | 满足任务隔离，避免污染历史输出 |
| 默认保留整张透明 `frame.png` | 用户未要求把框架切成部件，符合技能默认边界 |
| 三个图片层全部使用内置 imagegen | 满足生成证据硬门禁 |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| 首轮 B3 框架未保持 1:1，时间轴/卡片整体上移约 100px | 1 | 重新以源图为唯一 edit target 调用 imagegen，禁止代码平移或重画 |
| 第二轮 B3 重出仍整体上移约 100px | 2 | 第三轮改用源图百分比锚点回校，锁定时间轴和卡片坐标 |
| 第三轮锚点回校仍未保持 1:1 | 3 | 按用户原始“做成 PPT”范围切换为全幅图片型 PPT，确保视觉精确；不交付不合格的可编辑逆向稿 |
| `plutil -lint` 未接受 JSON 输入 | 1 | 改用 Python `json.tool` 完成 JSON 语法校验 |
