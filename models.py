import json
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

db = SQLAlchemy()

# 内容板块的标识与中文名
CATEGORIES = {
    "hobby": "兴趣爱好",
    "experience": "过往经历",
    "skill": "个人能力",
    "project": "项目展示",
    "note": "研究笔记",
}

# AI Stack 椭圆分组
STACK_GROUPS = {
    "ai": "AI",
    "data": "DATA",
    "product": "产运",
}


class Knowledge(db.Model):
    """AI 知识库条目，用于增强助手回答的上下文。"""

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, default="")
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)



class Profile(db.Model):
    """站点主人的个人信息（单条记录）"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), default="")
    headline = db.Column(db.String(200), default="")
    bio = db.Column(db.Text, default="")
    email = db.Column(db.String(120), default="")
    phone = db.Column(db.String(40), default="")
    location = db.Column(db.String(100), default="")
    avatar = db.Column(db.String(300), default="")
    resume = db.Column(db.String(300), default="")
    social = db.Column(db.Text, default="[]")
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    @property
    def social_list(self):
        try:
            return json.loads(self.social or "[]")
        except (ValueError, TypeError):
            return []


class Media(db.Model):
    """内容项的多媒体库（支持多个图片/视频混合）"""

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey("item.id"), nullable=False)
    media_type = db.Column(db.String(10), default="image")  # image / video
    media_path = db.Column(db.String(400), default="")
    media_url = db.Column(db.String(500), default="")
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def media_display(self):
        if self.media_path:
            return "/static/" + self.media_path
        return self.media_url


class Item(db.Model):
    """通用内容项，通过 category 区分"""

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(30), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    subtitle = db.Column(db.String(200), default="")
    description = db.Column(db.Text, default="")
    # 向后兼容：单媒体字段
    media_type = db.Column(db.String(10), default="none")
    media_path = db.Column(db.String(400), default="")
    media_url = db.Column(db.String(500), default="")
    # 多媒体库（新）
    gallery = db.relationship(
        "Media",
        backref="item_ref",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by=lambda: (Media.sort_order, Media.created_at),
    )
    external_url = db.Column(db.String(500), default="")
    iframe_url = db.Column(db.String(500), default="")
    tags = db.Column(db.String(300), default="")
    # AI Stack 分组：ai / data / product / 空
    stack_group = db.Column(db.String(20), default="")
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def tag_list(self):
        return [t.strip() for t in (self.tags or "").split(",") if t.strip()]

    @property
    def media_display(self):
        if self.media_path:
            return "/static/" + self.media_path
        return self.media_url

    @property
    def all_media(self):
        """始终合并：旧单媒体 + 新多媒体库"""
        items = list(self.gallery.order_by(Media.sort_order, Media.created_at).all())
        # 旧单媒体作为第一项（只要有就包含，不管 gallery 是否为空）
        if self.media_path or self.media_url:
            class Legacy:
                pass
            legacy = Legacy()
            legacy.id = self.id * 10000
            legacy.media_display = self.media_display
            legacy.media_type = self.media_type
            legacy.media_path = self.media_path
            legacy.media_url = self.media_url
            # 插入到最前面，让旧媒体先显示
            items.insert(0, legacy)
        return items
