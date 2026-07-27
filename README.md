# AI Lab — 个人全栈展示平台

一个面向 AI 岗位的**全栈个人展示网站**，用于展示技术成长轨迹、AI 研究成果与项目实践。  
包含 6 大内容板块、完整后台管理、AI 简历解析、自定义交互组件。  
**无前端框架依赖**，全部原生 JavaScript + CSS。

## 内容板块

| 板块 | 英文标识 | 说明 |
|---|---|---|
| **关于** | Identity | 头像、头衔、简介、社交链接、简历下载 |
| **兴趣爱好** | Beyond Code | 图片/视频佐证，支持多媒体库画廊 |
| **技术进化** | Evolution | 时间线+玻璃卡片，技术成长 vs 行政经历 |
| **AI 能力圈** | AI Stack | 椭圆轨道布局，拖拽旋转，点击查看详情 |
| **项目展示** | Experiments | 卡片式布局，内嵌 iframe 直接体验 |
| **研究笔记** | Research Notes | 时间线+知识图谱，Markdown 笔记，Media Gallery |

## 功能特性

### 交互体验
- **AI 能力图谱** — 椭圆轨道布点，鼠标拖拽旋转 + 惯性滑行 + 自动慢转
- **自定义视频播放器** — 替换原生 controls，30px 暗色控制条，hover 自动隐藏
- **玻璃拟态卡片** — `backdrop-filter: blur(20px)`，hover 时 gradient 边框光效 + `↗` 图标
- **弹跳入场动画** — 卡片/图片 PPT 弹跳效果（`bounceIn` 关键帧）
- **丝滑页面滚动** — 1000ms `easeInOutQuart` 缓动曲线
- **粒子背景** — 节点缓慢游走 + 呼吸连线，AI 数据传输感
- **画廊模态** — 多图/视频支持，左右浮层箭头 + 键盘 ←→ 翻页
- **导航高亮** — 滚动时自动激活当前板块

### 后台管理
- 6 大板块内容**增删改**，支持 Markdown 编辑
- **多媒体库** — 每个条目支持上传多张图片/视频混合，前端自动网格展示
- 个人资料编辑：头像、简历 PDF 上传、社交媒体链接
- **AI 简历智能解析** — 对接 OpenAI 兼容 API（Qwen / DeepSeek / GPT）自动提取简历结构化数据
- 一键生成示例数据

### 技术亮点
- 纯 CSS 暗色科技风主题，CSS 变量体系，全局可定制
- 响应式布局（桌面 3 列 / 平板 2 列 / 手机 1 列）
- 数据库：一对多关系（Item ↔ Media），级联删除
- 文件上传：图片/视频格式校验 + MIME 检测，200MB 上限
- 前端零框架依赖，全站～3000 行原生代码

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 准备环境变量
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux

# 3. 启动
python app.py
```

打开 http://127.0.0.1:5000 。

- 前台首页：`/`
- 后台登录：`/admin/login`（默认 `admin` / `admin123`，请修改）
- 后台点「生成示例数据」再逐步替换为自己的内容

## 使用说明

1. **AI Profile** — 填写姓名、头衔、简介，上传头像与简历 PDF
2. **各板块编辑** — 后台首页点板块进入 → 新增/编辑条目
3. **多媒体库** — 编辑条目时拖到底部「多媒体库」，可一次上传多张图片/视频
4. **智能解析** — 上传简历 PDF 后点「AI 解析」自动拆分为内容板块
5. **LLM 配置**（可选）— 在 `.env` 中填入 API Key：

```
LLM_API_KEY=sk-xxxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

未配置 LLM 时，简历解析自动回落至本地规则模式。

## 项目结构

```
.
├── app.py              # 应用入口
├── config.py           # 配置（数据库/上传/管理员/LLM）
├── models.py           # Profile / Item / Media 模型
├── routes.py           # 全部路由
├── resume_parser.py    # 简历解析器（LLM + 本地规则）
├── requirements.txt
├── .env.example
├── static/
│   ├── css/style.css   # ~900 行 CSS，全站主题
│   ├── js/main.js      # ~550 行 JS，全部交互
│   └── uploads/        # 上传文件存储
├── templates/
│   ├── base.html       # 导航 + 底部
│   ├── home.html       # 前台单页展示
│   └── admin/          # 后台管理模板
└── site.db             # SQLite 数据库
```

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3 + Flask + SQLAlchemy |
| 前端 | 原生 JavaScript + CSS3（零框架） |
| 数据库 | SQLite（开发）/ PostgreSQL / MySQL |
| AI | OpenAI 兼容 API（Qwen / DeepSeek / GPT） |
| 动画 | CSS `@keyframes` + requestAnimationFrame |
| 部署 | Flask 开发服务器 / gunicorn + nginx |

## 部署生产

```bash
# 1. 安装生产依赖
pip install gunicorn

# 2. 关闭 debug，设置 SECRET_KEY
# 修改 .env：
#   FLASK_ENV=production
#   SECRET_KEY=<随机字符串>
#   ADMIN_PASSWORD=<强密码>

# 3. 启动
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

## 安全提示

- 修改 `.env` 中的 `SECRET_KEY` 与 `ADMIN_PASSWORD`
- 公开仓库前**确认 `.env` 被 `.gitignore` 排除**，勿提交 API Key
- `static/uploads` 对外可访问，敏感文件建议做访问控制
- iframe 嵌入仅限可信地址，防范 XSS / 点击劫持
