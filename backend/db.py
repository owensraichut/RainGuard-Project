import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "rainguard.db"
connection = sqlite3.connect(DB_PATH, check_same_thread=False)
connection.row_factory = sqlite3.Row

STATIONS = [
    {"id": "48363", "name": "บึงกาฬ (48363)", "latitude": 18.4136, "longitude": 103.5167},
    {"id": "48357", "name": "นครพนม (48357)", "latitude": 17.4167, "longitude": 104.7833},
    {"id": "48358", "name": "นครพนม สกษ. (48358)", "latitude": 17.2764, "longitude": 104.7737},
    {"id": "48356", "name": "สกลนคร (48356)", "latitude": 17.1549, "longitude": 104.1370},
    {"id": "48355", "name": "สกลนคร สกษ. (48355)", "latitude": 17.1250, "longitude": 104.0610},
    {"id": "48383", "name": "มุกดาหาร (48383)", "latitude": 16.5416, "longitude": 104.7291},
]


def init_db() -> None:
    with connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS stations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                latitude REAL,
                longitude REAL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS rainfall_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station_id TEXT NOT NULL,
                date TEXT NOT NULL,
                rainfall_mm REAL NOT NULL,
                UNIQUE(station_id, date),
                FOREIGN KEY(station_id) REFERENCES stations(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS gev_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station_id TEXT NOT NULL UNIQUE,
                generated_at TEXT NOT NULL,
                return_2 REAL,
                return_5 REAL,
                return_10 REAL,
                return_20 REAL,
                return_50 REAL,
                return_100 REAL,
                mu_location REAL,
                sigma_scale REAL,
                xi_shape REAL,
                max_rain REAL,
                mean_rain REAL,
                std_rain REAL,
                risk_level TEXT,
                risk_description TEXT,
                FOREIGN KEY(station_id) REFERENCES stations(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station_id TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                message TEXT NOT NULL,
                return_100 REAL,
                FOREIGN KEY(station_id) REFERENCES stations(id)
            )
            """
        )
    seed_stations()


def seed_stations() -> None:
    with connection:
        for station in STATIONS:
            connection.execute(
                "INSERT OR REPLACE INTO stations (id, name, latitude, longitude) VALUES (?, ?, ?, ?)",
                (station["id"], station["name"], station["latitude"], station["longitude"]),
            )


def get_all_stations() -> list[dict]:
    rows = connection.execute("SELECT id, name, latitude, longitude FROM stations ORDER BY id").fetchall()
    return [dict(row) for row in rows]


def get_station(station_id: str) -> dict | None:
    row = connection.execute(
        "SELECT id, name, latitude, longitude FROM stations WHERE id = ?",
        (station_id,),
    ).fetchone()
    return dict(row) if row else None


def get_recent_rainfall(station_id: str, limit: int = 42) -> list[float]:
    rows = connection.execute(
        "SELECT rainfall_mm FROM rainfall_data WHERE station_id = ? ORDER BY date DESC LIMIT ?",
        (station_id, limit),
    ).fetchall()
    return [float(row["rainfall_mm"]) for row in reversed(rows)]


def save_rainfall(station_id: str, date: str, rainfall_mm: float) -> None:
    with connection:
        connection.execute(
            "INSERT OR REPLACE INTO rainfall_data (station_id, date, rainfall_mm) VALUES (?, ?, ?)",
            (station_id, date, rainfall_mm),
        )


def get_prediction(station_id: str) -> dict | None:
    row = connection.execute(
        "SELECT * FROM gev_predictions WHERE station_id = ?",
        (station_id,),
    ).fetchone()
    return dict(row) if row else None


def save_alert(station_id: str, generated_at: str, risk_level: str, message: str, return_100: float) -> None:
    with connection:
        connection.execute(
            "INSERT INTO alerts (station_id, generated_at, risk_level, message, return_100) VALUES (?, ?, ?, ?, ?)",
            (station_id, generated_at, risk_level, message, return_100),
        )


def get_recent_alerts(limit: int = 10, station_id: str | None = None) -> list[dict]:
    query = (
        "SELECT a.id, a.station_id, s.name AS station_name, a.generated_at, a.risk_level, a.message, a.return_100 "
        "FROM alerts a "
        "JOIN stations s ON a.station_id = s.id "
    )
    params = []
    if station_id:
        query += "WHERE a.station_id = ? "
        params.append(station_id)
    query += "ORDER BY a.generated_at DESC LIMIT ?"
    params.append(limit)

    rows = connection.execute(query, tuple(params)).fetchall()
    return [dict(row) for row in rows]


def get_latest_alert(station_id: str) -> dict | None:
    row = connection.execute(
        "SELECT * FROM alerts WHERE station_id = ? ORDER BY generated_at DESC LIMIT 1",
        (station_id,),
    ).fetchone()
    return dict(row) if row else None

def save_alert_if_needed(station_id: str, risk_level: str, message: str, return_100: float) -> None:
    last = get_latest_alert(station_id)
    should_save = False

    if last is None:
        should_save = True
    elif last["risk_level"] != risk_level:
        should_save = True
    elif return_100 > float(last.get("return_100") or 0.0):
        should_save = True

    if should_save:
        save_alert(station_id, datetime.utcnow().isoformat(), risk_level, message, return_100)


def save_prediction(station_id: str, report: dict) -> None:
    generated_at = datetime.utcnow().isoformat()
    with connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO gev_predictions (
                station_id, generated_at, return_2, return_5, return_10, return_20, return_50, return_100,
                mu_location, sigma_scale, xi_shape, max_rain, mean_rain, std_rain, risk_level, risk_description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                station_id,
                generated_at,
                report["return_levels"]["2_year"],
                report["return_levels"]["5_year"],
                report["return_levels"]["10_year"],
                report["return_levels"]["20_year"],
                report["return_levels"]["50_year"],
                report["return_levels"]["100_year"],
                report["gev_parameters"]["mu_location"],
                report["gev_parameters"]["sigma_scale"],
                report["gev_parameters"]["xi_shape"],
                report["basic_stats"]["max"],
                report["basic_stats"]["mean"],
                report["basic_stats"]["std"],
                report.get("risk_assessment", {}).get("level", "Unknown"),
                report.get("risk_assessment", {}).get("description", ""),
            ),
        )


def get_or_create_prediction(station_id: str) -> dict | None:
    prediction = get_prediction(station_id)
    if prediction:
        return prediction
    return None
