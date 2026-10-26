"""本机素材路径配置 —— 示例。

使用方法：
  1. 复制本文件为同目录下的 local_config.py（注意是下划线）
  2. 把下面的路径改成你机器上的实际路径
  3. local_config.py 已被 .gitignore 忽略，不会进入公开仓库

三个路径分别指向存放作品集原始渲染图的文件夹：
  SRC          普通项目图、总平面、立面等
  SRC_PORTRAIT 形象照
  SRC_CASE     案例临摹的图纸（最早从作品集 PDF 里单独抽出归档）

也可以不建这个文件，改用环境变量：
  PORTFOLIO_SRC / PORTFOLIO_SRC_PORTRAIT / PORTFOLIO_SRC_CASE
"""

SRC = r""
SRC_PORTRAIT = r""
SRC_CASE = r""
