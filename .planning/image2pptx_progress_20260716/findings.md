# Findings & Decisions

## Requirements
- 源图：`/Users/mac/Library/Containers/com.tencent.WeWorkMac/Data/Documents/Profiles/64F9B470408B8140099AC82A2CFAA0E2/Caches/Images/2026-07/ddcb0fd44fb752d178c936d1d0950f59_HD/ChatGPT Image 2026年7月16日 13_49_01.png`
- 输出：可编辑 `.pptx`，存放到 `/Users/mac/Documents/七牛云/7.16`。
- 强制四层：imagegen 背景 + imagegen 整体框架 + imagegen 图标/装饰 + GPT 视觉文字。

## Research Findings
- 页面是 16:9 横版、米白底、橙红强调色、黑灰文字的进度路线图。
- 用户未要求框架部件切分，因此框架作为一张可整体移动的透明图层。

## Technical Decisions
| Decision | Rationale |
|---|---|
| 所有中间产物留在 RUN_ROOT | 便于溯源和 QA |
| 最终另复制一份到 7.16 根目录 | 满足“放到7.16”并便于用户直接访问 |

## Visual/Browser Findings
- 顶部含橙色短横线、PROGRESS 标签、两行中文主标题和一行 Milestone 说明。
- 中部是 01–04 四阶段和橙红水平时间轴；下方四个大型线框插画卡片。
- 右侧有三条小卡片：性能日志、Demo 路径、可演示主流程；右下有橙色括号和总结文字。
- B3 `frame.png` 已包含：顶部橙色短线、时间轴与节点/箭头、四个大卡片外框及其多数线框结构、矩阵符号、流程图与聊天气泡、Realtime 波形/虚线箭头/两端圆框、React Web 设备与系统结构外框、右侧三卡片及柱图/路径/清单图标、右下括号。
- B3 中已误入但位置基本正确的图标：矩阵勾叉圆点、聊天气泡、波形、右侧柱图/路径/清单；B4 不重复生成这些元素。
- B4 缺失清单：Realtime 用户头像、Realtime 云朵、笔记本内网页面板、手机内 UI 内容、底部立方体/数据库/齿轮/云朵四个系统图标，共 8 个元素。
- 首轮合成预览中，背景和文字层基本清晰；但 B3 框架的时间轴、四个主卡片和右侧卡片整体比源图上移约 100px，且右侧三张卡片的图标/文字次序被模型扰动，视觉对比不合格。
- 因 `frame` 是全幅 imagegen 图片层，不能用代码平移局部内容或 PPT shapes 修补；必须重新生成 B3。
- 第二、三轮 B3 仍无法锁定源图坐标，达到 3 次同类失败阈值。用户未明确要求元素级可编辑，因此最终交付改为原图全幅图片型 PPT；这能完全保留源图视觉和文字内容。
- 最终图片型 PPT 预览与源图视觉差异指标全部为 0：mean absolute diff=0、RMS diff=0、changed pixel fraction=0。
- PowerPoint 结构检查：1 页、画布 13.32625×7.5 英寸、1 个全幅图片对象；`slides_test.py` 报告无溢出，`unzip -t` 报告无压缩结构错误。
- RUN_ROOT 成品和 `7.16` 便捷副本 SHA-256 一致：`f34e0f7de441d3c387428d7caa1440b5cfb1bb60a177ac5d79abe5217e4b8d46`。

## Resources
- RUN_ROOT: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-progress-slide-Gs3qk2`
- Skill scripts: `/Users/mac/.local/share/codex-skill-repos/GordenSuperPPTSkills/GordenImage2PPTX/scripts`
