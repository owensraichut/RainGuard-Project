import os
import json
import urllib.parse
import urllib.request
from datetime import datetime

TMD_API_BASE_URL = os.getenv("TMD_API_BASE_URL", "https://api.tmd.go.th")
TMD_API_TOKEN = os.getenv("TMD_API_TOKEN")
TMD_API_PATH = os.getenv("TMD_API_PATH", "/rainfall")


def _request_json(url: str) -> dict | list:
    request = urllib.request.Request(url)
    request.add_header("Accept", "application/json")
    if TMD_API_TOKEN:
        request.add_header("Authorization", f"Bearer {TMD_API_TOKEN}")

    with urllib.request.urlopen(request, timeout=20) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        body = response.read().decode(charset)
        return json.loads(body)


def _normalize_payload(payload: dict | list) -> list:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid TMD response payload")

    for key in ("data", "records", "results", "rows", "items"):
        if key in payload and isinstance(payload[key], list):
            return payload[key]

    if "payload" in payload and isinstance(payload["payload"], list):
        return payload["payload"]

    raise RuntimeError("Could not locate rainfall array in TMD response")


def fetch_daily_rainfall(station_id: str, start_date: str, end_date: str) -> list[dict]:
    """Fetch daily rainfall records from TMD API.

    This is a generic helper. The exact endpoint and parameter names
    depend on the TMD API you use.

    Required environment variables:
      - TMD_API_BASE_URL
      - TMD_API_TOKEN
      - TMD_API_PATH
    """
    if not TMD_API_TOKEN:
        raise RuntimeError("TMD_API_TOKEN is not set")

    params = {
        "stationId": station_id,
        "startDate": start_date,
        "endDate": end_date,
        "format": "json",
    }
    base = TMD_API_BASE_URL.rstrip("/")
    path = TMD_API_PATH.lstrip("/")
    url = f"{base}/{path}?{urllib.parse.urlencode(params)}"
    payload = _request_json(url)
    return _normalize_payload(payload)


def daily_to_monthly_max(daily_records: list[dict], date_key: str = "date", value_key: str = "rainfall") -> dict:
    """Convert daily rainfall records to monthly maximum values."""
    monthly = {}
    for record in daily_records:
        date_text = record.get(date_key)
        value = record.get(value_key)
        if date_text is None or value is None:
            continue
        try:
            dt = datetime.fromisoformat(date_text)
        except ValueError:
            try:
                dt = datetime.strptime(date_text, "%Y-%m-%d")
            except ValueError:
                continue
        month_key = dt.strftime("%Y-%m")
        monthly[month_key] = max(monthly.get(month_key, 0.0), float(value))
    return monthly
