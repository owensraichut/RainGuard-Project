import numpy as np
import pandas as pd
from scipy.stats import genextreme
import json

class RainGuardGEV:
    """
    คลาสสำหรับประมวลผลข้อมูลปริมาณน้ำฝนสุดขีด
    โดยใช้แบบจำลอง Generalized Extreme Value (GEV) 
    และประมาณค่าพารามิเตอร์ด้วยวิธี Maximum Likelihood Estimation (MLE)
    """
    def __init__(self, station_id, station_name, rainfall_data):
        """
        รับข้อมูลเบื้องต้นของสถานี
        :param station_id: รหัสสถานี (เช่น '48358')
        :param station_name: ชื่อสถานี (เช่น 'นครพนม สกษ.')
        :param rainfall_data: List หรือ Pandas Series ของข้อมูลฝนสูงสุดรายเดือน (มม.)
        """
        self.station_id = station_id
        self.station_name = station_name
        # ลบค่าที่ว่าง (NaN) ออกก่อนประมวลผล
        self.data = np.array(pd.Series(rainfall_data).dropna())
        self.params = {}
        
    def fit_model(self):
        """
        ประมาณค่าพารามิเตอร์ Location, Scale, Shape ด้วยวิธี MLE
        """
        # ฟังก์ชัน genextreme.fit ใน scipy จะใช้วิธี MLE โดยค่าเริ่มต้น (Default)
        # ส่งคืนค่า: shape (c), location (loc), scale (scale)
        shape_c, loc, scale = genextreme.fit(self.data)
        
        # หมายเหตุสำคัญ: 
        # ค่า Shape Parameter ของ scipy (c) จะมีเครื่องหมายตรงข้ามกับค่า xi (ξ) ในสมการงานวิจัย
        # ในงานวิจัย: ξ < 0 คือ Weibull
        # ใน scipy: c < 0 คือ Weibull (แต่ในบางเวอร์ชัน c คือ -ξ) 
        # เราจะเก็บทั้งสองค่าเพื่อความไม่งง
        
        self.params = {
            'shape_scipy': shape_c,
            'xi_research': -shape_c, # แปลงกลับให้ตรงกับ Paper (บวก/ลบ)
            'loc': loc,
            'scale': scale
        }
        return self.params
        
    def calculate_return_level(self, return_period):
        """
        คำนวณระดับการเกิดซ้ำ (Return Level) ตามคาบอุบัติซ้ำที่ต้องการ
        :param return_period: จำนวนปี (T) เช่น 2, 5, 10, 50, 100
        """
        if not self.params:
            self.fit_model()
            
        # คำนวณความน่าจะเป็นที่ไม่เกิน (Non-exceedance probability) P = 1 - (1/T)
        p = 1 - (1 / return_period)
        
        # หาค่า Return Level ด้วยฟังก์ชัน Percent Point Function (ppf) หรือ Inverse CDF
        level = genextreme.ppf(p, self.params['shape_scipy'], loc=self.params['loc'], scale=self.params['scale'])
        return level
        
    def generate_report(self, return_periods=[2, 5, 10, 20, 50, 100]):
        """
        สรุปผลการวิเคราะห์ทั้งหมดให้อยู่ในรูปแบบ Dictionary (พร้อมแปลงเป็น JSON ส่งให้ API)
        """
        if not self.params:
            self.fit_model()
            
        # คำนวณค่า Return Levels
        returns = {f"{p}_year": round(float(self.calculate_return_level(p)), 2) for p in return_periods}
        
        # สถิติพื้นฐาน
        basic_stats = {
            "years_count": len(self.data),
            "max": round(float(np.max(self.data)), 2),
            "mean": round(float(np.mean(self.data)), 2),
            "std": round(float(np.std(self.data)), 2)
        }
        
        report = {
            "station_id": self.station_id,
            "station_name": self.station_name,
            "basic_stats": basic_stats,
            "gev_parameters": {
                "mu_location": round(float(self.params['loc']), 2),
                "sigma_scale": round(float(self.params['scale']), 2),
                "xi_shape": round(float(self.params['xi_research']), 4)
            },
            "return_levels": returns
        }
        return report

# ==========================================
# ส่วนทดสอบการทำงาน (Mock Testing)
# ==========================================
if __name__ == "__main__":
    print("กำลังประมวลผลแบบจำลอง GEV...")
    
    # สมมติข้อมูลฝนรายเดือนสุดขีดของสถานีนครพนม สกษ. (จำลองการแจกแจงแบบ Weibull แบบเบ้ขวา)
    # ในระบบจริง ข้อมูลนี้จะถูก Query มาจากฐานข้อมูล PostgreSQL
    np.random.seed(42)
    # จำลองข้อมูลให้มีค่าเฉลี่ยและ Max ใกล้เคียงตารางที่ 1 (Mean ~124, Max ~272)
    mock_rainfall_data = np.random.weibull(1.5, 42) * 80 + 50 
    mock_rainfall_data[np.argmax(mock_rainfall_data)] = 272.60 # ใส่ค่า Max สุดขีดไป 1 ค่า
    
    # สร้าง Object และประมวลผล
    model = RainGuardGEV(station_id="48358", station_name="นครพนม สกษ.", rainfall_data=mock_rainfall_data)
    
    # สั่งสร้างรายงานผลลัพธ์
    result = model.generate_report()
    
    # แสดงผลลัพธ์ในรูปแบบ JSON ที่จัดหน้าสวยงาม
    print(json.dumps(result, ensure_ascii=False, indent=4))