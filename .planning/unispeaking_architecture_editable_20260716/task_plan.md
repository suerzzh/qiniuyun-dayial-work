# Task Plan: UniSpeaking 系统架构图可编辑 PPT

## Goal
将用户提供的 1672×941 架构图还原为单页可编辑 PowerPoint，并交付到 `/Users/mac/Documents/七牛云/7.16`。

## Current Phase
Complete

## Phases

### Phase 1: 设计确认
- [x] 读取相关技能约束
- [x] 检查源图结构与信息密度
- [x] 向用户确认可编辑拆分边界
- **Status:** completed

### Phase 2: 隔离与源图分析
- [x] 创建唯一 RUN_ROOT
- [x] 复制源图并记录画布、配色、层级和锚点
- [x] 完整提取所有可见文字
- **Status:** completed

### Phase 3: 可编辑重建
- [x] 重建 6 个架构层横向容器与左侧层级标签
- [x] 重建客户端、接入、业务、AI、模型、基础设施节点
- [x] 重建所有方向箭头、虚线调用链和底部图例
- [x] 所有文字写入独立文本框
- **Status:** completed

### Phase 4: 导出与校准
- [x] 导出 PPTX
- [x] 真实 PowerPoint 渲染
- [x] 至少一轮视觉对照回校
- **Status:** completed

### Phase 5: 验证与交付
- [x] 溢出检查
- [x] PPTX 结构检查
- [x] 对象、图片和文字统计
- [x] 复制到 7.16 并提供链接
- **Status:** completed

## Decisions
| Decision | Rationale |
|---|---|
| 当前仅以用户本次图片为源图 | 遵守直接转换与任务隔离原则 |
| 延续上一页“真正可编辑”标准 | 同一任务上下文中用户曾明确反对整页贴图 |
| 设计确认后再实施 | brainstorming 技能硬门禁 |

## Errors
| Error | Attempt | Resolution |
|---|---:|---|
| none | 0 | — |
