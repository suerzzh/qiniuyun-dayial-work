# Task Plan: 可编辑进度路线图 PPT 重做

## Goal
把用户源图重建为原生可编辑 PPTX：文字、线条、卡片、矩阵、流程图、终端、图标均为可单独移动和修改的 PowerPoint 对象，并放入 `/Users/mac/Documents/七牛云/7.16`。

## Current Phase
Complete

## Phases

### Phase 1: 根因验证
- [x] 建立新的唯一 RUN_ROOT
- [x] 复制源图并探色
- [x] 验证 `referenced_image_paths` 仍无法锁定 imagegen 框架坐标
- **Status:** completed

### Phase 2: 架构调整
- [x] 放弃不稳定的 imagegen 框架提取
- [x] 选择原生 PowerPoint 对象重建
- [x] 明确所有文字必须为真实文本框
- **Status:** completed

### Phase 3: 原生可编辑重建
- [x] 1672×941 画布与米白背景
- [x] 标题、阶段、说明文字真实文本框
- [x] 时间线、节点、箭头、卡片、矩阵与流程图独立形状
- [x] WebRTC、React 架构、运维卡片与图标独立形状
- **Status:** completed

### Phase 4: 导出与回校
- [x] 修复负尺寸线段导致的 PPTX 导出错误
- [x] 第一轮真实 PPT 渲染发现文字裁切
- [x] 第二轮像素/点换算修正
- [x] 第三轮字号和文本框尺寸视觉校准
- **Status:** completed

### Phase 5: 验证与交付
- [x] PPTX 成功导出并复制到 7.16 根目录
- [x] PowerPoint 渲染图目视检查
- [x] slides_test 无溢出
- [x] ZIP/PPTX 结构完整
- [x] 最终对象数量、零图片层、文本内容与 visual QA 复验
- **Status:** completed

## Decisions
| Decision | Rationale |
|---|---|
| RUN_ROOT `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-progress-editable-retry-13MtZR` | 不复用上次失败产物 |
| 原生 PowerPoint 对象重建 | imagegen 即使用本地文件直传也会重排框架，无法保证源图坐标 |
| 保留旧图片型文件，新增“可编辑版”文件 | 避免覆盖用户已有产物并清楚区分 |
| 字号按 PPTX 真实渲染校准 | artifact 画布预览与 PPTX 字号单位不同，必须以真实导出渲染为准 |

## Errors
| Error | Attempt | Resolution |
|---|---:|---|
| imagegen B3 框架整体上移 | 1 | 本地路径直传仍失败，改用原生对象重建 |
| `PPTX shape extents must be non-negative` | 1 | 向左/向上的线段改为正边界自定义路径 |
| 首轮 PPT 渲染大部分文字被裁切 | 1 | 修正像素到点的字号换算并扩大文本框 |
