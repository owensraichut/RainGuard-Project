from datetime import datetime
from dotenv import load_dotenv
load_dotenv() # Load variables from .env

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from db import get_all_stations, get_recent_rainfall, get_recent_alerts, get_station, init_db, save_alert_if_needed, save_prediction
from gev_model import RainGuardGEV
from ingest import ingest_data # 🟢 แก้ไข: เปลี่ยนชื่อให้ตรงกับในไฟล์ ingest.py

# สร้างแอปพลิเคชัน FastAPI
app = FastAPI(
    title="RainGuard-AI API",
    description="API สำหรับระบบคาดการณ์ความเสี่ยงน้ำท่วมด้วยแบบจำลอง GEV",
    version="1.0.0"
)

# 📌 ตั้งค่า CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# เรียกสร้างฐานข้อมูลและตารางเมื่อเริ่มต้น
init_db()
try:
    if not get_recent_rainfall("48363", limit=1):
        print("No rainfall data found. Seeding initial mock data...")
        ingest_data() # 🟢 แก้ไข: เรียกใช้ฟังก์ชันให้ถูกชื่อ
except Exception as err:
    print("Warning: could not seed initial data:", err)

# ==========================================
# API Endpoints (ช่องทางให้เว็บเรียกใช้งาน)
# ==========================================

@app.get("/")
def read_root():
    """เช็คสถานะการทำงานของ API"""
    return {"message": "RainGuard-AI API is running!", "status": "online"}

@app.get("/api/stations")
def get_stations():
    """ส่งคืนรายชื่อสถานีทั้งหมด"""
    stations = get_all_stations()
    return {"stations": stations}


@app.get("/api/prediction/{station_id}")
def get_prediction_route(station_id: str):
    """คำนวณและส่งคืนค่าคาดการณ์ (Return Level) ของสถานีที่ระบุ"""
    station = get_station(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลสถานีนี้")

    rainfall_data = get_recent_rainfall(station_id, limit=42)
    if not rainfall_data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลฝนสำหรับสถานีนี้")

    model = RainGuardGEV(
        station_id=station_id,
        station_name=station["name"],
        rainfall_data=rainfall_data,
    )
    report = model.generate_report(return_periods=[2, 5, 10, 20, 50, 100])

    forecasted_100_yr = report["return_levels"]["100_year"]
    risk_level = "Low"
    if forecasted_100_yr >= 120:
        risk_level = "Medium"
    if forecasted_100_yr > 200:
        risk_level = "High"

    report["risk_assessment"] = {
        "level": risk_level,
        "description": (
            "ฝนสุดขีดอยู่ในเกณฑ์อันตราย โปรดหลีกเลี่ยงการเพาะปลูก"
            if risk_level == "High"
            else "สภาวะปกติ"
        ),
    }

    save_prediction(station_id, report)

    if risk_level in ("Medium", "High"):
        alert_message = (
            f"สถานี {station['name']} คาดการณ์ฝนสุดขีด 100 ปี = {forecasted_100_yr:.1f} มม. "
            f"ระดับความเสี่ยง: {risk_level}. {report['risk_assessment']['description']}"
        )
        save_alert_if_needed(
            station_id,
            risk_level,
            alert_message,
            forecasted_100_yr,
        )

    return report

@app.get("/api/alerts")
def get_alerts(station_id: str | None = None):
    alerts = get_recent_alerts(station_id=station_id)
    return {"alerts": alerts}

# วิธีรันเซิร์ฟเวอร์: uvicorn main:app --reload
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)