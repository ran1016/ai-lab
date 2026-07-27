import json
import os
import re
import uuid
from functools import wraps

import markdown
from flask import (
    Blueprint,
    abort,
    flash,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.utils import secure_filename

from config import Config
from models import CATEGORIES, Item, Media, Profile, db
import resume_parser as rparser

main_bp = Blueprint("main", __name__)


# ------------------------- 工具函数 -------------------------
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("main.login"))
        return f(*args, **kwargs)

    return decorated


def build_roadmap(items):
    """将经历数据转换为技术成长路线图结构。
    
    按年份分组，区分为「技术成长」(tags 含"技术成长") 和「行政经历」。
    """
    buckets = {}
    for item in items:
        sub = (item.subtitle or "").strip()
        year = sub[:4] if sub[:4].isdigit() else ""
        tags = (item.tags or "").strip()
        is_tech = "技术成长" in tags or "tech" in tags
        entry = {
            "id": item.id,
            "title": item.title,
            "subtitle": item.subtitle,
            "description": item.description,
            "tags": item.tag_list,
            "media_display": item.media_display,
            "media_type": item.media_type,
            "is_tech": is_tech,
        }
        if year not in buckets:
            buckets[year] = {"tech": [], "admin": []}
        buckets[year]["tech" if is_tech else "admin"].append(entry)

    roadmap = []
    for year in sorted(buckets, key=lambda y: (y != "" and y or "Z"), reverse=True):
        if year == "":
            continue  # 无年份的放在最后
        tech, admin = buckets[year]["tech"], buckets[year]["admin"]
        if tech or admin:
            roadmap.append({"year": year, "tech": tech, "admin": admin})
    # 无年份兜底
    if "" in buckets and (buckets[""]["tech"] or buckets[""]["admin"]):
        roadmap.append(
            {"year": "", "tech": buckets[""]["tech"], "admin": buckets[""]["admin"]}
        )
    return roadmap


def save_uploaded_file(file, kind):
    if not file or not file.filename:
        return None
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    mime = (file.mimetype or "").lower()
    if kind == "image":
        if ext not in Config.ALLOWED_IMAGE_EXT and not mime.startswith("image/"):
            return None
    elif kind == "video":
        if ext not in Config.ALLOWED_VIDEO_EXT and not mime.startswith("video/"):
            return None
    elif kind == "resume":
        if ext not in Config.ALLOWED_RESUME_EXT:
            return None
    safe = secure_filename(file.filename) or f"file.{ext}"
    filename = f"{kind}_{uuid.uuid4().hex}_{safe}"
    path = os.path.join(Config.UPLOAD_FOLDER, filename)
    file.save(path)
    return "uploads/" + filename


def remove_media(path):
    if path:
        try:
            os.remove(os.path.join(Config.UPLOAD_FOLDER, os.path.basename(path)))
        except OSError:
            pass


def parse_social(text):
    links = []
    for line in (text or "").splitlines():
        line = line.strip()
        if not line:
            continue
        if "|" in line:
            name, url = line.split("|", 1)
            links.append({"name": name.strip(), "url": url.strip()})
        else:
            links.append({"name": line, "url": line})
    return links


# ------------------------- 前台 -------------------------
@main_bp.route("/")
def home():
    profile = Profile.query.first()
    items = {}
    for cat in CATEGORIES:
        items[cat] = (
            Item.query.filter_by(category=cat)
            .order_by(Item.sort_order, Item.created_at)
            .all()
        )
    # 预计算多媒体库 JSON
    for item in items.get("experience", []) + items.get("note", []):
        gal = []
        for m in item.all_media:
            gal.append({"src": m.media_display, "type": m.media_type})
        item._gallery_json = json.dumps(gal)
    roadmap = build_roadmap(items.get("experience", []))
    return render_template(
        "home.html", profile=profile, items=items, roadmap=roadmap
    )


# ------------------------- 后台：登录 -------------------------
@main_bp.route("/admin/login", methods=["GET", "POST"])
def login():
    if session.get("admin_logged_in"):
        return redirect(url_for("main.dashboard"))
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        from config import Config as Cfg

        if username == Cfg.ADMIN_USERNAME and password == Cfg.ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            return redirect(url_for("main.dashboard"))
        flash("用户名或密码错误", "danger")
    return render_template("admin/login.html")


@main_bp.route("/admin/logout")
def logout():
    session.pop("admin_logged_in", None)
    flash("已退出登录", "info")
    return redirect(url_for("main.home"))


@main_bp.route("/admin")
@login_required
def dashboard():
    counts = {cat: Item.query.filter_by(category=cat).count() for cat in CATEGORIES}
    profile = Profile.query.first()
    return render_template(
        "admin/dashboard.html", counts=counts, profile=profile, categories=CATEGORIES
    )


# ------------------------- 后台：个人资料 / 简历 -------------------------
@main_bp.route("/admin/profile", methods=["GET", "POST"])
@login_required
def edit_profile():
    profile = Profile.query.first()
    if profile is None:
        profile = Profile()
        db.session.add(profile)
        db.session.commit()

    if request.method == "POST":
        profile.name = request.form.get("name", "").strip()
        profile.headline = request.form.get("headline", "").strip()
        profile.bio = request.form.get("bio", "")
        profile.email = request.form.get("email", "").strip()
        profile.phone = request.form.get("phone", "").strip()
        profile.location = request.form.get("location", "").strip()

        avatar = request.files.get("avatar")
        if avatar and avatar.filename:
            fn = save_uploaded_file(avatar, "image")
            if fn:
                remove_media(profile.avatar)
                profile.avatar = fn
            else:
                flash("头像文件类型不支持", "danger")

        resume = request.files.get("resume")
        if resume and resume.filename:
            fn = save_uploaded_file(resume, "resume")
            if fn:
                remove_media(profile.resume)
                profile.resume = fn
            else:
                flash("简历仅支持 PDF / Word 格式", "danger")

        if request.form.get("remove_avatar"):
            remove_media(profile.avatar)
            profile.avatar = ""
        if request.form.get("remove_resume"):
            remove_media(profile.resume)
            profile.resume = ""

        profile.social = json.dumps(parse_social(request.form.get("social_text", "")))
        db.session.commit()
        flash("AI Profile 已保存", "success")
        return redirect(url_for("main.edit_profile"))

    social_text = "\n".join(
        f"{s.get('name', '')}|{s.get('url', '')}" for s in profile.social_list
    )
    return render_template("admin/profile.html", profile=profile, social_text=social_text)


# ------------------------- 后台：简历智能解析 -------------------------
_PARSED_TMP = os.path.join(Config.UPLOAD_FOLDER, ".resume_parse_tmp.json")


@main_bp.route("/admin/parse-resume", methods=["POST"])
@login_required
def parse_resume():
    profile = Profile.query.first()
    if not profile or not profile.resume:
        flash("请先在上方上传简历并点击「保存」", "danger")
        return redirect(url_for("main.edit_profile"))
    path = os.path.join(Config.UPLOAD_FOLDER, os.path.basename(profile.resume))
    if not os.path.exists(path):
        flash("简历文件不存在，请重新上传", "danger")
        return redirect(url_for("main.edit_profile"))

    try:
        text = rparser.extract_text(path)
    except Exception as exc:  # noqa: BLE001
        flash(f"读取简历失败：{exc}", "danger")
        return redirect(url_for("main.edit_profile"))

    data = None
    if Config.LLM_API_KEY:
        try:
            data = rparser.parse_resume(
                text, Config.LLM_API_KEY, Config.LLM_BASE_URL, Config.LLM_MODEL
            )
        except Exception as exc:  # noqa: BLE001
            flash(f"LLM 解析失败，已改用本地规则：{exc}", "warning")

    if not data:
        data = rparser.parse_resume(text)

    with open(_PARSED_TMP, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    return render_template(
        "admin/parse_resume.html", data=data, has_llm=bool(Config.LLM_API_KEY)
    )


@main_bp.route("/admin/parse-resume/apply", methods=["POST"])
@login_required
def apply_parsed_resume():
    if not os.path.exists(_PARSED_TMP):
        flash("解析结果已过期，请重新解析", "danger")
        return redirect(url_for("main.edit_profile"))
    with open(_PARSED_TMP, "r", encoding="utf-8") as f:
        data = json.load(f)
    os.remove(_PARSED_TMP)

    selected = request.form.getlist("sections")
    profile = Profile.query.first()

    if "profile" in selected:
        for key in ("name", "headline", "bio", "email", "phone", "location"):
            val = (data.get("profile") or {}).get(key)
            if val:
                setattr(profile, key, val)
        db.session.commit()

    for cat in ("experience", "skill", "project"):
        if cat not in selected:
            continue
        Item.query.filter_by(category=cat).delete()
        for it in (data.get("sections") or {}).get(cat, []):
            item = Item(category=cat, title=it.get("title", ""))
            item.subtitle = it.get("subtitle", "")
            item.description = it.get("description", "")
            item.tags = it.get("tags", "")
            if cat == "project":
                item.external_url = it.get("external_url", "")
            item.sort_order = 0
            db.session.add(item)
    db.session.commit()

    flash("已根据简历自动填充所选板块", "success")
    return redirect(url_for("main.edit_profile"))


# ------------------------- 后台：内容项管理 -------------------------
@main_bp.route("/admin/items/<category>")
@login_required
def list_items(category):
    if category not in CATEGORIES:
        abort(404)
    items = (
        Item.query.filter_by(category=category)
        .order_by(Item.sort_order, Item.created_at)
        .all()
    )
    return render_template(
        "admin/items.html",
        category=category,
        cat_name=CATEGORIES[category],
        items=items,
    )


@main_bp.route("/admin/item/new/<category>", methods=["GET", "POST"])
@login_required
def new_item(category):
    if category not in CATEGORIES:
        abort(404)
    if request.method == "POST":
        return save_item(None, category)
    return render_template(
        "admin/item_editor.html",
        item=None,
        category=category,
        cat_name=CATEGORIES[category],
    )


@main_bp.route("/admin/item/edit/<int:item_id>", methods=["GET", "POST"])
@login_required
def edit_item(item_id):
    item = Item.query.get_or_404(item_id)
    if request.method == "POST":
        return save_item(item, item.category)
    return render_template(
        "admin/item_editor.html",
        item=item,
        category=item.category,
        cat_name=CATEGORIES[item.category],
    )


@main_bp.route("/admin/item/delete/<int:item_id>", methods=["POST"])
@login_required
def delete_item(item_id):
    item = Item.query.get_or_404(item_id)
    category = item.category
    remove_media(item.media_path)
    db.session.delete(item)
    db.session.commit()
    flash("已删除", "success")
    return redirect(url_for("main.list_items", category=category))


def save_item(item, category):
    title = request.form.get("title", "").strip()
    subtitle = request.form.get("subtitle", "").strip()
    description = request.form.get("description", "")
    media_type = request.form.get("media_type", "none")
    media_url = request.form.get("media_url", "").strip()
    external_url = request.form.get("external_url", "").strip()
    iframe_url = request.form.get("iframe_url", "").strip()
    tags = request.form.get("tags", "").strip()
    try:
        sort_order = int(request.form.get("sort_order", 0) or 0)
    except ValueError:
        sort_order = 0

    if not title:
        flash("标题不能为空", "danger")
        return render_template(
            "admin/item_editor.html",
            item=item,
            category=category,
            cat_name=CATEGORIES.get(category, category),
        )

    if item is None:
        item = Item(category=category)
        db.session.add(item)

    item.title = title
    item.subtitle = subtitle
    item.description = description
    item.media_type = media_type
    item.media_url = media_url
    item.external_url = external_url
    item.iframe_url = iframe_url
    item.tags = tags
    item.sort_order = sort_order
    # 新条目先 flush 拿到 item.id，供后续 Media 外键使用
    db.session.flush()

    if request.form.get("remove_media"):
        remove_media(item.media_path)
        item.media_path = ""

    if media_type in ("image", "video"):
        f = request.files.get("media_file")
        if f and f.filename:
            fn = save_uploaded_file(f, "image" if media_type == "image" else "video")
            if fn:
                remove_media(item.media_path)
                item.media_path = fn
            else:
                ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
                if media_type == "video":
                    flash(
                        f"视频类型 .{ext} 不在白名单中。请使用 MP4 / WebM / MOV 格式（浏览器可原生播放）",
                        "danger",
                    )
                else:
                    flash(f"图片类型 .{ext} 不支持。请使用 PNG / JPG / WebP / GIF", "danger")

    # ---- 多媒体库（gallery）处理 ----
    # 1. 删除勾选的已有媒体
    delete_ids = request.form.getlist("delete_media_ids")
    for mid in delete_ids:
        try:
            m = Media.query.get(int(mid))
            if m and m.item_id == item.id:
                remove_media(m.media_path)
                db.session.delete(m)
        except (ValueError, TypeError):
            pass

    # 2. 上传新文件
    new_files = request.files.getlist("new_media")
    for f in new_files:
        if f and f.filename:
            ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
            kind = "video" if ext in Config.ALLOWED_VIDEO_EXT else "image"
            fn = save_uploaded_file(f, kind)
            if fn:
                mtype = "video" if ext in Config.ALLOWED_VIDEO_EXT else "image"
                m = Media(item_id=item.id, media_type=mtype, media_path=fn)
                db.session.add(m)

    db.session.commit()
    flash("已保存", "success")
    return redirect(url_for("main.list_items", category=category))


# ------------------------- 后台：示例数据 -------------------------
@main_bp.route("/admin/seed")
@login_required
def seed():
    if Profile.query.first() is None:
        db.session.add(
            Profile(
                name="你的名字",
                headline="创造者 / 全栈开发者 / 终身学习者",
                bio="在这里写一段自我介绍，介绍你的热情、价值观与方向。\n\n- 喜欢把想法变成产品\n- 相信持续学习\n- 乐于分享与协作",
                email="you@example.com",
                location="中国",
                social=json.dumps(
                    [
                        {"name": "GitHub", "url": "https://github.com/"},
                        {"name": "微博", "url": "https://weibo.com/"},
                    ]
                ),
            )
        )

    if Item.query.count() == 0:
        samples = [
            ("hobby", "摄影", "用镜头记录生活", "周末喜欢扫街与风光摄影。", "📷", "", ""),
            ("hobby", "健身", "保持身体与精力", "每周三次力量训练。", "🏋️", "", ""),
            # ---- 技术成长线（主路线） ----
            ("experience", "进入重庆邮电大学", "2023", "开启大学生涯，接触计算机与编程。", "", "", "技术成长,计算机基础"),
            ("experience", "Python 基础与工程实践", "2024", "系统掌握 Python 语法、面向对象编程、标准库，完成命令行工具与自动化脚本项目。", "", "", "技术成长,Python"),
            ("experience", "数据分析与数据库", "2024", "学习 NumPy / Pandas / Matplotlib 进行数据处理与可视化；掌握 MySQL 与 SQLite。", "", "", "技术成长,数据分析,数据库"),
            ("experience", "LLM 应用探索", "2025", "深入研究 Prompt Engineering、RAG、LangChain，独立搭建知识库问答助手。", "", "", "技术成长,LLM,RAG,AI"),
            ("experience", "AI Agent 系统开发", "2026", "基于大模型构建可自主决策的多 Agent 系统，集成工具调用与记忆机制。", "", "", "技术成长,AI Agent,系统开发"),
            # ---- 行政/工作经历（副线） ----
            ("experience", "某科技公司 · 后端实习", "2024 - 2025", "参与核心服务开发与性能优化。", "💼", "", ""),
            # ---- 能力 ----
            ("skill", "Python 开发", "熟练", "Web 后端、数据处理、自动化脚本。", "🐍", "", ""),
            ("skill", "AI/LLM", "熟练", "RAG 搭建 / Agent 开发 / Prompt Engineering。", "🤖", "", ""),
            ("skill", "数据工程", "进阶", "SQL / ETL / 数据可视化。", "📊", "", ""),
            # ---- 项目 ----
            ("project", "AI 知识库助手", "RAG + LLM", "基于 LangChain + Qwen 搭建的企业内部知识问答系统，支持多轮会话。", "🌐", "https://github.com/", "RAG,Agent,Python"),
            ("project", "多 Agent 协作平台", "AutoGen + FastAPI", "可配置的多 Agent 协作系统，支持动态任务分配与工具调用。", "🌐", "https://github.com/", "Agent,LLM,Python"),
            # ---- 研究笔记 ----
            ("note", "RAG 技术原理与最佳实践", "2026-03", "**Retrieval-Augmented Generation (RAG)** 是目前将 LLM 与企业私有知识结合的主流方案。\n\n核心流程：\n1. **文档分块（Chunking）** — 按段落/语义切分\n2. **向量嵌入（Embedding）** — 转为向量存库\n3. **检索（Retrieval）** — 语义相似度 Top-K\n4. **增强生成（Augmented Generation）** — 将检索结果作为 prompt 上下文\n\n> 关键：chunk 大小与重叠度的选择直接影响检索质量。", "", "", "RAG,LLM,GenAI"),
            ("note", "LangChain 核心抽象笔记", "2026-02", "LangChain 的核心概念：\n\n- **Model I/O**：LLM 调用接口统一化\n- **Retrieval**：文档加载 → 分割 → 向量存储 → 检索\n- **Chains**：将多个组件串联为流水线\n- **Agents**：LLM 自主决定调用哪些工具\n- **Memory**：对话历史管理\n\n`LCEL（LangChain Expression Language）` 提供声明式链构建，用 `|` 运算符串联组件，类似 Unix 管道。", "", "", "LangChain,Python,LLM"),
            ("note", "AI Agent 设计模式总结", "2026-01", "当前主流的 Agent 设计模式：\n\n1. **ReAct**（Reasoning + Acting）— 思考→行动→观察循环\n2. **Plan-and-Execute** — 先规划步骤，再逐一执行\n3. **Multi-Agent** — 多个 Agent 协作，如 AutoGen、CrewAI\n4. **Tool-Use** — LLM 通过 Function Calling 调用外部 API\n\n每个模式适用于不同场景，实践中常**组合使用**。\n\n```python\n# ReAct 伪代码\nwhile not done:\n    thought = llm.think(state)\n    action = llm.decide(thought)\n    result = execute(action)\n    state.update(result)\n```", "", "", "Agent,LLM,Python"),
        ]
        for cat, title, subtitle, desc, icon, url, tags in samples:
            db.session.add(
                Item(
                    category=cat,
                    title=title,
                    subtitle=subtitle,
                    description=desc,
                    media_type="none",
                    external_url=url,
                    tags=tags,
                    sort_order=0,
                )
            )
        # 给最早的体验项目补 iframe
        proj = Item.query.filter_by(category="project").first()
        if proj:
            proj.iframe_url = ""

    db.session.commit()
    flash("已生成示例数据（可在后台替换为你自己的内容）", "success")
    return redirect(url_for("main.dashboard"))
