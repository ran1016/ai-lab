import markdown
import os
from datetime import datetime, timezone

from flask import Flask

from config import Config
from models import CATEGORIES, Item, db
from routes import main_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

    db.init_app(app)
    app.register_blueprint(main_bp)

    @app.template_filter("md")
    def md_filter(text):
        return markdown.markdown(
            text or "", extensions=["extra", "fenced_code", "tables"]
        )

    @app.context_processor
    def inject_globals():
        ctx = {"now": datetime.now(timezone.utc), "categories": CATEGORIES}
        try:
            ctx["project_count"] = Item.query.filter_by(category="project").count()
            last_proj = (
                Item.query.filter_by(category="project")
                .order_by(Item.created_at.desc())
                .first()
            )
            ctx["current_project"] = (last_proj.title if last_proj else "—")
        except Exception:
            ctx["project_count"] = 0
            ctx["current_project"] = "—"
        return ctx

    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
