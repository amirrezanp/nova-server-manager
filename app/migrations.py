from sqlalchemy import inspect, text

from app.database import engine


APP_COLUMNS: dict[str, str] = {
    "last_upload_name": "VARCHAR(255) NOT NULL DEFAULT ''",
    "last_upload_size": "INTEGER NOT NULL DEFAULT 0",
    "last_upload_at": "DATETIME",
    "source_size": "INTEGER NOT NULL DEFAULT 0",
    "source_files": "INTEGER NOT NULL DEFAULT 0",
    "last_deployed_at": "DATETIME",
}


def run_migrations() -> None:
    """Apply additive SQLite migrations without losing existing installations."""
    inspector = inspect(engine)
    if "apps" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("apps")}
    with engine.begin() as connection:
        for name, definition in APP_COLUMNS.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE apps ADD COLUMN {name} {definition}"))
