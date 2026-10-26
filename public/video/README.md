# 首页视频背景

当前使用的文件：`public/video/hero.mp4`

## 换视频的做法

把新视频命名为 `hero.mp4` 覆盖到这里即可自动生效，**不需要改任何代码**：

```
public/video/hero.mp4
```

如果你会压缩视频，建议用 ffmpeg 压成「无音轨 + H.264 + 24fps」再放进来的，
格式参考下面「当前这条视频的实测参数」。

## 建议规格

| 项目 | 建议值 | 说明 |
| --- | --- | --- |
| 分辨率 | 1920×1080 | 全屏铺满，再高收益很小、体积翻倍 |
| 时长 | 8 – 60 秒 | 循环播放 |
| 大小 | 建议 < 15 MB | 超过 15 MB 首屏会有明显等待 |
| 编码 | H.264 (mp4) | 兼容性最好；再补一份 VP9 (webm) 更省流量 |
| 声音 | 无 | 页面里已静音播放，带音轨只是白占体积 |

## 当前这条视频的实测参数

| 项目 | 值 |
| --- | --- |
| 来源 | 剧院设计原始渲染（无水印） |
| 分辨率 | 1280 × 720 |
| 帧率 | 24 fps |
| 时长 | 51.27 秒 |
| 编码 | H.264（无音轨） |
| 大小 | 8.56 MB |

处理方式：从原始 38 MB 的 1080p 渲染里，用 ffmpeg 的 NVENC 编码器
去音轨、压到 720p / 约 1.4 Mbps（命令见下方「相关脚本」）。

> 为什么用 720p 而不是原片 1080p：GitHub Pages 的 CDN 拉大文件很慢，
> 实测 13 MB 的 1080p 首屏视频要缓冲约 40 秒才开始播；压到 8.5 MB 后
> 能明显加快起播。若换成更快的托管（如自己的 CDN / OSS），可再升回 1080p。

## 已知问题

已解决。之前那条素材从社交平台下载，四角烧着小红书水印；
现在换成了无水印的原始渲染，`src/components/Hero.jsx` 里的
`.hero__edgeMask`（压水印用的过渡带）和 `LOOP_END`（跳过收尾卡）都已删除。

## 相关脚本

```bash
# 读取视频的时长 / 分辨率 / 编码（不依赖 ffmpeg）
python scripts/probe-video.py public/video/hero.mp4

# 在真实浏览器里验证视频是否真的在播放（而不是悄悄回退到静态图）
node scripts/verify-video.mjs --url http://127.0.0.1:5273/ --out shots

# 检查画面帧里还有没有平台水印的红色 Logo 像素
python scripts/check-watermark.py shots

# 压缩原片的参考命令（本机 ffmpeg 在 D:\小飞宝宝\ACLOS\Cross\recorder-release\ffmpeg.exe）
# 720p、约 1.4 Mbps：
# ffmpeg -y -i 原片.mp4 -vf scale=1280:720 -r 24 -c:v h264_nvenc -b:v 1300k \
#        -maxrate 1800k -bufsize 3600k -pix_fmt yuv420p -movflags +faststart -an hero.mp4
```

## 没有视频时的行为

自动显示 `assets/hero/poster-*` 高清渲染图并带缓慢推移动效，**不会出现破图或黑屏**。
视频加载成功后才淡入覆盖图片；加载失败自动回退。

想直接换静态背景图（不用视频）：改 `scripts/process-images.py` 里 `PLAN["hero"]["poster"]` 的源文件名，然后运行：

```bash
pnpm assets poster
```
