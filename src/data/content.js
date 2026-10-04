/**
 * 站点内容数据 —— 全部来自本人的简历与作品集文件，未做任何虚构。
 * 后续要改文案 / 换图，只改这个文件即可。
 *
 * 注：本文件曾在一次误操作中被覆盖，后从生产构建产物中完整恢复。
 * 内容与覆盖前一致；图片归属的历次修正见 README 的「各项目当前使用的图」。
 */


export const profile = {
  name: '王云康',
  nameLatin: 'WANG YUNKANG',
  role: '建筑设计 / 建筑学本科',
  school: '暨南大学',
  schoolLatin: 'JINAN UNIVERSITY',
  degree: '建筑学 · 本科',
  period: '2022 — 2027',
  grade: '2022 级 · 2027 届',
  tagline: ['以理性为骨，', '以感性为衣。'],
  taglineSub: 'Architecture is where rational structure meets sensory art.',
  intro: ['暨南大学建筑学本科在读，五年制。主修建筑设计及原理、中外建筑历史、建筑结构与建筑力学、建筑物理、建筑美术水彩等课程，在设计中持续训练从概念生成、空间组织到图纸表达的完整链路。', '对建筑的理解：建筑学是理性美与感性艺术的集大成。如雕塑般静谧的材质，却呈现出进退的动态感；层叠而有规律的结构，令我着迷。'],
  selfEval: '兴趣广泛，乐于挑战，喜欢尝试新鲜事物，定下目标便会全力以赴。日常生活中热爱运动，作息规律，时间管理能力强；思维活跃，擅长沟通，愿意虚心学习。',
  hobbies: ['羽毛球', '登山', '绘画', '电影', 'AI 工具'],
  contacts: [
    {
      label: '电话',
      value: '166 3561 3420',
      href: 'tel:16635613420',
      mono: true,
    },
    {
      label: '微信',
      value: 'Ykk_Dec31',
      href: null,
      mono: true,
      copyable: true,
    },
    {
      label: '邮箱',
      value: '884597845@qq.com',
      href: 'mailto:884597845@qq.com',
      mono: true,
    },
    {
      label: '学校',
      value: '暨南大学 · 建筑学',
      href: null,
      mono: false,
    },
  ],
}

export const metrics = [
  {
    value: '4',
    unit: '年',
    label: '建筑学专业训练',
    note: '2022 — 2027 五年制本科',
  },
  {
    value: '12',
    unit: '项',
    label: '课程设计项目',
    note: '小住宅 · 幼儿园 · 客运站 · 剧场 · 人工岛 等',
  },
  {
    value: '12',
    unit: '类',
    label: '覆盖项目类型',
    note: '公共建筑 · 城市更新 · 乡村产业 · 游戏化设计',
  },
  {
    value: '8',
    unit: '款',
    label: '专业软件',
    note: 'SU · Rhino · V-Ray · CAD · PS · AI · ID · SD',
  },
]

export const focusAreas = ['公共建筑设计', '城市更新与改造', '乡村产业空间', '数字化设计表达']

export const campus = [
  {
    role: '班长',
    detail: '2022 级建筑学班长，累计组织 20 余次班会课、团建活动与校外调研，沟通力与执行力强。',
  },
  {
    role: '同心并立班成员',
    detail: '暨南大学学院粤港澳人才培养「同心并立班」成员。',
  },
]

export const featuredProjects = [
  {
    id: 'theater',
    index: '01',
    title: '剧场设计',
    titleLatin: 'THEATER DESIGN',
    year: '2025',
    category: '公共建筑 / 观演空间',
    location: '课程设计 · 城市文化片区',
    brief: '以流线型曲面屋面向城市打开，把观演厅、报告厅与市民公共动线编织在同一片连续结构之下。屋顶化为可上人的城市平台，建筑的「第五立面」成为新的公共空间。',
    tags: ['曲面结构', '观演空间', '屋面公共化', '城市界面'],
    role: '独立完成：概念生成 · 空间组织 · 结构配合 · 全部图纸与渲染',
    cover: 'hero/poster',
    images: [
      {
        src: 'projects/theater-roof',
        caption: '黄昏整体鸟瞰 · 曲面屋面与城市关系',
      },
      {
        src: 'projects/theater-siteplan',
        caption: '总平面图 · 建筑与街区肌理、景观水系的关系',
      },
      {
        src: 'projects/theater-elevation',
        caption: '线稿立面 · 曲面屋面与玻璃幕墙的连续起伏',
      },
      {
        src: 'projects/theater-hall',
        caption: '报告厅室内 · 木格栅连续天花',
      },
      {
        src: 'projects/theater-rain',
        caption: '雨夜城市界面 · 结构与玻璃幕墙交接',
      },
      {
        src: 'projects/theater-explode',
        caption: '功能爆炸分析图',
      },
    ],
  },
  {
    id: 'sport',
    index: '02',
    title: '运动健康社区改造',
    titleLatin: 'SPORTS & HEALTH COMMUNITY RENEWAL',
    year: '2024',
    category: '城市更新 / 社区公共空间',
    location: '课程设计 · 既有社区',
    brief: '在既有社区肌理中置入一条垂直的公共动线：屋面运动场、二层平台与首层架空被重新串联，把零散的活动场地整合为立体的社区运动系统，让老社区获得新的公共客厅。',
    tags: ['垂直公共动线', '屋面运动场', '社区更新', '立体绿化'],
    role: '独立完成：场地调研 · 改造策略 · 参数化分析 · 图纸与渲染',
    cover: 'projects/sport-center',
    images: [
      {
        src: 'projects/sport-center',
        caption: '社区中心 · 屋面绿化与架空平台',
      },
      {
        src: 'projects/sport-aerial',
        caption: '整片社区屋面系统鸟瞰 · 连续红色步行道',
      },
      {
        src: 'projects/sport-roofgarden',
        caption: '屋顶花园 · 运动场与共享绿化',
      },
      {
        src: 'projects/sport-street',
        caption: '街道视角 · 红色廊架与首层灰空间',
      },
      {
        src: 'projects/sport-entrance',
        caption: '主入口 · 红色拱架与花格墙',
      },
      {
        src: 'projects/sport-plaza',
        caption: '社区市集广场 · 红色步行道与遮阳伞群',
      },
      {
        src: 'projects/sport-plaza2',
        caption: '市集广场鸟瞰 · 圆形水院与共享平台',
      },
      {
        src: 'projects/sport-diagram',
        caption: '垂直交通体系分析',
      },
    ],
  },
  {
    id: 'commercial',
    index: '03',
    title: '商业建筑改造',
    titleLatin: 'COMMERCIAL BUILDING RENEWAL',
    year: '2024',
    category: '城市更新 / 街区活力',
    location: '课程设计 · 老旧商业街区',
    brief: '不做推倒重建，而是以「轻介入」的方式重写街区界面：加建体量、打通首层灰空间、引入市集与共享平台，让原本封闭的商业体量重新与街道发生关系，恢复街区的人气与连续性。',
    tags: ['轻介入改造', '街区界面', '市集空间', '灰空间'],
    role: '独立完成：改造策略 · 界面设计 · 图纸与效果图',
    cover: 'projects/commercial-elevation1',
    images: [
      {
        src: 'projects/commercial-elevation1',
        caption: '1-1 立面图 · 木格栅与玻璃幕墙',
      },
      {
        src: 'projects/commercial-elevation2',
        caption: '2-2 立面图 · 曲线中庭与城市界面',
      },
      {
        src: 'projects/commercial-aerial',
        caption: '总平面与流线组织',
      },
      {
        src: 'projects/sport-diagram',
        caption: '垂直交通体系分析 · 1F–5F 商业区客流与后勤流线',
      },
    ],
  },
]

export const moreProjects = [
  {
    title: '客运站设计',
    titleLatin: 'PASSENGER STATION',
    year: '2023',
    category: '交通建筑',
    blurb: '以候车大厅为核心组织到发流线，屋面折叠形态同时承担结构找形与遮阳。',
    cover: 'projects/station-aerial',
    coverPos: 'center 52%',
    images: [
      {
        src: 'projects/station-aerial',
        caption: '整体鸟瞰 · 站前广场与到发车位',
      },
      {
        src: 'projects/station-section',
        caption: '剖面 · 候车大厅折叠屋面与采光',
      },
    ],
  },
  {
    title: '人工岛服务站设计',
    titleLatin: 'ARTIFICIAL ISLAND SERVICE STATION',
    year: '2023',
    category: '深中通道 · 服务设施',
    blurb: '以一条环形匝道把车流、加油与停车收进紧凑的三角地块，把人流引向滨海的观景广场；同时划出小型无人机试控区与货运无人机起降区域，为跨海通道的服务节点预留低空物流的可能。',
    cover: 'projects/island-plan',
    // 总平同时是封面和灯箱里的大图，用全档位（默认的小卡片档位在灯箱里会糊）
    coverWidths: [800, 1600, 2000],
    coverPos: 'center 50%',
    images: [
      {
        src: 'projects/island-plan',
        caption: '总平面图 · 环形匝道组织车流与加油停车',
      },
      {
        src: 'projects/island-board',
        widths: [900, 1800],
        coverWidths: [900, 1800],
        caption: '设计展板 · 总平面／平面／爆炸分析／物理环境模拟／物理模型',
      },
    ],
  },
  {
    title: '南瓜王国',
    titleLatin: 'PUMPKIN KINGDOM',
    year: '2024',
    category: '乡村产业 · 文旅改造',
    blurb: '依托梯田与河道，把农业种植、亲子体验与文创消费编织成一条可漫游的乡村动线。',
    cover: 'projects/pumpkin-aerial',
    coverPos: 'center 45%',
    images: ['projects/pumpkin-aerial', 'projects/pumpkin-field'],
  },
  {
    title: '修行客栈',
    titleLatin: 'CULTIVATION INN',
    year: '2022',
    category: '小住宅 · 民宿',
    blurb: '以院落组织客房与公共空间，用剖面控制视线与光线，营造安静的居住节奏。',
    cover: 'projects/inn-plan',
    coverPos: 'center 66%',
    images: ['projects/inn-plan', 'projects/inn-courtyard'],
  },
  {
    title: '游戏设计开发',
    titleLatin: 'GAME DESIGN & DEVELOPMENT',
    year: '2024',
    category: '数字化表达 · 交互',
    blurb: '迎暨南大学 118 周年校庆，以 1906—1923 真如时期校史为据，5 人团队开发第一人称可互动 3D 探索游戏，还原历史建筑之美，已适配 PC 端与手机端。',
    cover: 'misc/game',
    coverPos: 'center 40%',
    images: ['misc/game'],
  },
  {
    title: '案例临摹与研究',
    titleLatin: 'CASE STUDY',
    year: '2023 — 2024',
    category: '建筑案例研究',
    blurb: '谷物之屋、扭转住宅、螺旋别墅、格雷斯农场 —— 通过平立剖与模型重绘，拆解大师的几何策略与空间语法。',
    cover: 'misc/case-model',
    // 源图只有 644px 宽，再往上生成就是拉伸，所以只出 600 这一档
    coverWidths: [600],
    coverPos: 'center 42%',
    images: [
      {
        src: 'misc/case-model',
        widths: [600],
        caption: '形体研究小样 · 扭转、起翘、层叠的几何原型推敲',
      },
      {
        src: 'misc/case-grain-plan',
        caption: '谷物之屋 · 总平面（临摹重绘）',
      },
      {
        src: 'misc/case-grain-elev',
        caption: '谷物之屋 · 立面（临摹重绘）',
      },
    ],
  },
]

export const strengths = [
  {
    tag: 'A-01',
    title: '设计全链路',
    subtitle: 'Concept → Drawing',
    body: '从场地调研、概念生成、体量推敲到平立剖与详图，独立走完一个设计项目的完整流程，交付成套可用图纸。',
    points: ['场地调研与案例研究', '概念生成与体量推敲', '成套图纸表达'],
  },
  {
    tag: 'A-02',
    title: '数字化建模',
    subtitle: 'Modeling & Parametric',
    body: '以 SketchUp、Rhino 建立方案模型，用参数化手段处理复杂形态与数据图表，让形体逻辑可被推演和验证。',
    points: ['SketchUp / Rhino', '参数化与数据可视化', '复杂曲面找形'],
  },
  {
    tag: 'A-03',
    title: '效果图表达',
    subtitle: 'Rendering & Post',
    body: 'V-Ray 渲染配合 Photoshop 后期，擅长控制材质、光影与氛围，把手绘般的感性表达落在真实的物理光环境里。',
    points: ['V-Ray 光影渲染', 'Photoshop 后期调色', '日景 / 夜景 / 剖透视'],
  },
  {
    tag: 'A-04',
    title: 'AI 辅助工作流',
    subtitle: 'AI-Assisted Workflow',
    body: '把 Stable Diffusion 纳入方案推敲与表现环节，在概念发散、风格探索和出图效率之间建立可复用的工作流。',
    points: ['概念发散与风格探索', 'AI 优化出图', '跨软件协同'],
  },
  {
    tag: 'A-05',
    title: '图面与编排',
    subtitle: 'Layout & Graphic',
    body: '用 InDesign 完成作品集与展板的整体编排，控制字体、网格与留白的秩序，让信息本身成为设计的一部分。',
    points: ['InDesign 版式编排', '展板与作品集', '信息层级梳理'],
  },
  {
    tag: 'A-06',
    title: '沟通与执行',
    subtitle: 'Leadership',
    body: '担任班级班长，组织 20 余次班会课、团建与校外调研；在团队设计中承担协调与推进，能把想法落到交付物上。',
    points: ['团队协调与推进', '方案汇报表达', '时间管理与交付'],
  },
]

export const skills = [
  {
    name: 'SketchUp',
    level: 92,
    group: '建模',
  },
  {
    name: 'Rhino',
    level: 84,
    group: '建模',
  },
  {
    name: 'AutoCAD / 天正',
    level: 88,
    group: '制图',
  },
  {
    name: 'V-Ray',
    level: 82,
    group: '渲染',
  },
  {
    name: 'Photoshop',
    level: 90,
    group: '后期',
  },
  {
    name: 'Illustrator',
    level: 80,
    group: '图形',
  },
  {
    name: 'InDesign',
    level: 85,
    group: '编排',
  },
  {
    name: 'Stable Diffusion',
    level: 78,
    group: 'AI',
  },
]

export const sections = [
  {
    id: 'home',
    nav: '首页',
    en: 'HOME',
    num: '00',
  },
  {
    id: 'about',
    nav: '个人经历',
    en: 'PROFILE',
    num: '01',
  },
  {
    id: 'works',
    nav: '精选项目',
    en: 'SELECTED WORKS',
    num: '02',
  },
  {
    id: 'strengths',
    nav: '个人优势',
    en: 'CAPABILITIES',
    num: '03',
  },
  {
    id: 'contact',
    nav: '联系',
    en: 'CONTACT',
    num: '04',
  },
]
