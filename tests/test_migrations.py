from sqlalchemy import create_engine, inspect, text

from app import migrations


def test_existing_database_receives_v2_app_columns(tmp_path, monkeypatch):
    database = tmp_path / "legacy.db"
    legacy_engine = create_engine(f"sqlite:///{database.as_posix()}")
    with legacy_engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE apps (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL)"
        ))

    monkeypatch.setattr(migrations, "engine", legacy_engine)
    migrations.run_migrations()
    columns = {column["name"] for column in inspect(legacy_engine).get_columns("apps")}

    assert set(migrations.APP_COLUMNS).issubset(columns)
