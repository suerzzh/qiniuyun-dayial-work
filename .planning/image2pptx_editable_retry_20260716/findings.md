# Findings: 可编辑 PPT 重做

## Requirements
- 必须是真正可编辑版本，不能仅把原图铺满一页。
- 交付目录：`/Users/mac/Documents/七牛云/7.16`。
- 所有普通文字为真实文本框；结构图、图标和装饰可独立移动。

## Root Cause Evidence
- 旧流程 B3 三次把时间轴和卡片整体上移。
- 新流程即使用 `referenced_image_paths` 直接传入本地源图，imagegen 仍重排结构；“直传路径可锁定坐标”的假设被证伪。
- 这类精确版式的可编辑重建更适合原生形状，而不是依赖生成式图片分层。

## Native Rebuild
- 画布：1672×941。
- 时间轴中心线：y=512。
- 主卡片：y=548..828。
- 右侧三卡片容器：x=1394..1622、y=451..711。
- 生成了约 150 个可编辑对象，覆盖标题、时间线、矩阵、原型、Realtime、React 架构、运维卡片和收尾说明。

## Export Findings
- Artifact 预览字号像 CSS 像素，PPTX 存储为点；不换算会造成真实 PowerPoint 渲染裁切。
- 负宽或负高的线段无法导出为 PPTX，需要用正尺寸边界的自定义路径表达。
- 最终以 PowerPoint 渲染结果为准完成三轮回校，而不是只看生成器预览。

## Resources
- RUN_ROOT: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-progress-editable-retry-13MtZR`
- Source: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-progress-editable-retry-13MtZR/editable/01/slide-01.png`
- Final candidate: `/Users/mac/Documents/七牛云/7.16/两周内_Web_Realtime_进度路线图_可编辑版.pptx`
- Final render: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-progress-editable-retry-13MtZR/verification/rendered-round3/slide-1.png`

