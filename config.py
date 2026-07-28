import os

from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(basedir, "site.db"),
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # 上传目录（位于 static/uploads，可通过 /static/uploads/xxx 访问）
    UPLOAD_FOLDER = os.path.join(basedir, "static", "uploads")

    ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"}
    # 视频白名单（包含浏览器可播放 + 常见录制/下载格式）
    # 注：浏览器原生 <video> 仅支持 mp4/webm/ogg/mov/m4v；
    #     其他格式会上传成功但需要用户用浏览器兼容的播放器
    ALLOWED_VIDEO_EXT = {
        "mp4", "webm", "ogg", "mov", "m4v",  # 浏览器可播放
        "avi", "mkv", "flv", "wmv", "3gp",    # 常见录制/下载格式
        "ts", "qt", "mpeg", "mpg", "asf", "rm", "rmvb",
    }
    ALLOWED_RESUME_EXT = {"pdf", "doc", "docx", "ppt", "pptx"}

    # 最大上传体积：200 MB（视频可能较大）
    MAX_CONTENT_LENGTH = 200 * 1024 * 1024

    # 简历智能解析（可选）：配置 LLM_API_KEY 后启用大模型精准解析，
    # 未配置则自动回退到本地启发式规则解析。
    # 接口兼容 OpenAI，可指向 Qwen / DeepSeek / GPT 等。
    LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
    LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
    LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")

    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
