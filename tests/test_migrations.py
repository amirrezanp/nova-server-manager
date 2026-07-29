from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import sessionmaker

from app import migrations
from app.database import Base
from app.models import App, Deployment, UploadRecord
from app.services import deployment_state_service


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


def test_startup_reconciles_interrupted_operations(tmp_path, monkeypatch):
    test_engine = create_engine(f"sqlite:///{(tmp_path / 'state.db').as_posix()}")
    Base.metadata.create_all(test_engine)
    TestSession = sessionmaker(bind=test_engine)
    with TestSession() as db:
        app = App(
            name="interrupted-app",
            display_name="Interrupted",
            app_type="static",
            container_name="nova-interrupted-app",
            source_dir=str(tmp_path / "source"),
            host_port=12001,
            status="deploying",
        )
        db.add(app)
        db.flush()
        db.add(Deployment(app_id=app.id, status="running", stage="building_image", progress=40))
        db.add(UploadRecord(app_id=app.id, filename="source.zip", status="processing"))
        db.commit()

    monkeypatch.setattr(deployment_state_service, "SessionLocal", TestSession)
    deployment_state_service.reconcile_interrupted_deployments()

    with TestSession() as db:
        app = db.scalar(select(App))
        deployment = db.scalar(select(Deployment))
        upload = db.scalar(select(UploadRecord))
        assert app.status == "failed"
        assert deployment.status == "failed"
        assert deployment.stage == "interrupted"
        assert upload.status == "failed"
