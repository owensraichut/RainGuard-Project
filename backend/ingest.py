import os
from dotenv import load_dotenv
load_dotenv() # Load variables from .env
from datetime import date, timedelta

import numpy as np

from db import save_rainfall, save_prediction, get_all_stations, init_db
from gev_model import RainGuardGEV
from tmd_client import daily_to_monthly_max, fetch_daily_rainfall

BASE_STATS = {
    "48363": {"shape": 1.5, "scale": 60, "loc": 60, "max": 251.30},
    "48357": {"shape": 1.4, "scale": 80, "loc": 80, "max": 304.40},
    "48358": {"shape": 1.5, "scale": 75, "loc": 80, "max": 272.60},
    "48356": {"shape": 1.6, "scale": 60, "loc": 65, "max": 228.90},
    "48355": {"shape": 1.7, "scale": 50, "loc": 65, "max": 212.60},
    "48383": {"shape": 1.5, "scale": 65, "loc": 65, "max": 269.40},
}


def generate_mock_monthly_rainfall(station_id: str, months: int = 42) -> list[tuple[str, float]]:
    stats = BASE_STATS.get(station_id)
    if not stats:
        stats = {"shape": 1.5, "scale": 70, "loc": 70, "max": 250}

    values = []
    current = date.today().replace(day=1)
    np.random.seed(int(station_id))
    for _ in range(months):
        value = np.random.weibull(stats["shape"]) * stats["scale"] + stats["loc"]
        value = float(np.clip(value, 0.0, stats["max"]))
        values.append((current.isoformat(), round(value, 2)))
        current -= timedelta(days=30)
    return list(reversed(values))


def fetch_tmd_monthly_rainfall(station_id: str, months: int = 42) -> list[tuple[str, float]]:
    today = date.today().replace(day=1)
    start = (today - timedelta(days=months * 31)).replace(day=1)
    start_date = start.isoformat()
    end_date = today.isoformat()

    daily_data = fetch_daily_rainfall(station_id, start_date, end_date)
    monthly_map = daily_to_monthly_max(daily_data, date_key="date", value_key="rainfall")

    monthly_items = sorted(monthly_map.items())[-months:]
    if len(monthly_items) < months:
        raise RuntimeError("Not enough monthly data from TMD to build last 42 months")

    return [(month + "-01", round(value, 2)) for month, value in monthly_items]


def build_monthly_data(station_id: str, months: int = 42) -> list[tuple[str, float]]:
    if os.getenv("USE_REAL_TMD_DATA", "0") == "1":
        try:
            print(f"Fetching real TMD data for station {station_id}")
            return fetch_tmd_monthly_rainfall(station_id, months=months)
        except Exception as err:
            print(f"TMD fetch failed for {station_id}, falling back to mock: {err}")

    return generate_mock_monthly_rainfall(station_id, months=months)


def ingest_data() -> None:
    init_db()
    stations = get_all_stations()
    for station in stations:
        print(f"Seeding rainfall data for station {station['id']}: {station['name']}")
        monthly_data = build_monthly_data(station["id"], months=42)
        for date_text, rainfall_mm in monthly_data:
            save_rainfall(station["id"], date_text, rainfall_mm)

        model = RainGuardGEV(
            station_id=station["id"],
            station_name=station["name"],
            rainfall_data=[value for _, value in monthly_data],
        )
        report = model.generate_report(return_periods=[2, 5, 10, 20, 50, 100])

        risk_level = "Low"
        if report["return_levels"]["100_year"] >= 120:
            risk_level = "Medium"
        if report["return_levels"]["100_year"] > 200:
            risk_level = "High"
        report["risk_assessment"] = {
            "level": risk_level,
            "description": "ฝนสุดขีดอยู่ในเกณฑ์อันตราย โปรดหลีกเลี่ยงการเพาะปลูก" if risk_level == "High" else "สภาวะปกติ",
        }
        save_prediction(station["id"], report)
        print(f"Saved prediction for {station['id']} ({risk_level})")


def run() -> None:
    ingest_data()
    print("Data ingestion finished. Database is ready.")


if __name__ == "__main__":
    run()
