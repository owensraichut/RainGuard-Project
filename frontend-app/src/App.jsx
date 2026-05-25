import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';
import { 
  CloudRain, Map as MapIcon, Database, Leaf, Bell, Download, Info, 
  Calendar, MapPin, Activity, AlertTriangle, CheckCircle, Home, Loader2, ChevronRight, DownloadCloud, FileText,
  Navigation, Menu, X
} from 'lucide-react';

const returnPeriods = [2, 5, 10, 20, 50, 100];

// 🌐 ตั้งค่า API_URL โดยดึงจาก env (หรือเบนไปที่ localhost:8000 สำหรับการพัฒนาแบบ local)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const MOCK_STATIONS = [
  { id: "48363", name: "บึงกาฬ (48363)", latitude: 18.4136, longitude: 103.5167 },
  { id: "48357", name: "นครพนม (48357)", latitude: 17.4167, longitude: 104.7833 },
  { id: "48358", name: "นครพนม สกษ. (48358)", latitude: 17.2764, longitude: 104.7737 },
  { id: "48356", name: "สกลนคร (48356)", latitude: 17.1549, longitude: 104.1370 },
  { id: "48355", name: "สกลนคร สกษ. (48355)", latitude: 17.1250, longitude: 104.0610 },
  { id: "48383", name: "มุกดาหาร (48383)", latitude: 16.5416, longitude: 104.7291 },
];

const generateMockData = (stationId) => {
  const station = MOCK_STATIONS.find(s => s.id === stationId) || MOCK_STATIONS[0];
  const baseMap = {
    "48363": [103.72, 139.00, 162.20, 184.00, 212.80, 234.00],
    "48357": [123.31, 164.54, 191.54, 214.28, 250.15, 274.59],
    "48358": [137.46, 180.18, 206.73, 230.50, 260.68, 281.75],
    "48356": [90.96, 113.56, 130.30, 148.50, 172.83, 193.49],
    "48355": [101.82, 132.38, 152.30, 170.10, 195.30, 213.14],
    "48383": [100.55, 128.74, 147.12, 165.20, 186.75, 203.17],
  };
  const r = baseMap[stationId] || baseMap["48358"];
  const maxForecast = r[5];
  
  return {
    station_id: stationId,
    station_name: station.name,
    basic_stats: { years_count: 42, max: +(maxForecast * 1.05).toFixed(2), mean: +(r[0] * 0.9).toFixed(2), std: 65.5 },
    gev_parameters: { mu_location: +(r[0] * 0.8).toFixed(2), sigma_scale: 35.5, xi_shape: -0.05 },
    return_levels: {
      "2_year": r[0], "5_year": r[1], "10_year": r[2], 
      "20_year": r[3], "50_year": r[4], "100_year": r[5]
    },
    risk_assessment: {
      level: maxForecast > 200 ? "High" : (maxForecast > 120 ? "Medium" : "Low"),
      description: maxForecast > 200 ? "ฝนสุดขีดอยู่ในเกณฑ์อันตราย โปรดหลีกเลี่ยงการเพาะปลูก" : "สภาวะปกติ"
    }
  };
};

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const [stations, setStations] = useState(MOCK_STATIONS);
  const [selectedStation, setSelectedStation] = useState("48358"); 
  const [selectedPeriod, setSelectedPeriod] = useState(100);
  const [predictionData, setPredictionData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState("connecting");
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const menuItems = [
    { id: 'home', label: 'หน้าหลัก', icon: Home },
    { id: 'stations', label: 'ข้อมูลสถานีและตาราง GEV', icon: Database },
    { id: 'map', label: 'แผนที่ความเสี่ยง', icon: MapIcon },
    { id: 'advisory', label: 'คำแนะนำการเกษตร', icon: Leaf },
    { id: 'alerts', label: 'การแจ้งเตือน', icon: Bell },
    { id: 'download', label: 'ดาวน์โหลดรายงาน', icon: Download },
  ];

  const pageTitles = {
    home: 'สรุปภาพรวมความเสี่ยง',
    stations: 'ข้อมูลสถานีและตารางสถิติ',
    map: 'แผนที่ความเสี่ยงอุทกวิทยา',
    advisory: 'คำแนะนำการเพาะปลูก',
    alerts: 'การแจ้งเตือนอุทกภัย',
    download: 'ส่งออกรายงานข้อมูล (CSV)',
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stRes, alRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/stations`), // 🟢 ใช้ API_BASE_URL
          fetch(`${API_BASE_URL}/api/alerts`)    // 🟢 ใช้ API_BASE_URL
        ]);
        if (stRes.ok) {
          const stData = await stRes.json();
          const stWithLocation = stData.stations.map(s => {
              const mock = MOCK_STATIONS.find(m => m.id === s.id);
              return { ...s, latitude: s.latitude || mock?.latitude, longitude: s.longitude || mock?.longitude };
          });
          setStations(stWithLocation.length > 0 ? stWithLocation : MOCK_STATIONS);
        }
        if (alRes.ok) {
          const alData = await alRes.json();
          setAlerts(alData.alerts || []);
        }
        setApiStatus("online");
      } catch (err) {
        setApiStatus("offline");
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedStation) return;
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/prediction/${selectedStation}`) // 🟢 ใช้ API_BASE_URL
      .then(res => {
        if (!res.ok) throw new Error('API Fail');
        return res.json();
      })
      .then(data => {
        setPredictionData(data);
        setIsLoading(false);
      })
      .catch(() => {
        setPredictionData(generateMockData(selectedStation));
        setApiStatus("offline");
        setIsLoading(false);
      });
  }, [selectedStation]);

  const getRiskLevel = (rainfall) => {
    if (rainfall > 200) return { level: 'สูง (High)', color: 'bg-red-500', text: 'text-red-600', bgLight: 'bg-red-50', border: 'border-red-200' };
    if (rainfall >= 120) return { level: 'ปานกลาง (Medium)', color: 'bg-yellow-500', text: 'text-yellow-600', bgLight: 'bg-yellow-50', border: 'border-yellow-200' };
    return { level: 'ต่ำ (Low)', color: 'bg-green-500', text: 'text-green-600', bgLight: 'bg-green-50', border: 'border-green-200' };
  };

  const changePage = (pageId) => {
    setActivePage(pageId);
    setIsMobileMenuOpen(false); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleFindNearestStation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ของคุณไม่รองรับระบบ GPS');
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        
        let nearestStation = stations[0];
        let minDistance = Infinity;

        stations.forEach(station => {
          const R = 6371; 
          const dLat = (station.latitude - userLat) * Math.PI / 180;
          const dLon = (station.longitude - userLon) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(userLat * Math.PI / 180) * Math.cos(station.latitude * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          if (distance < minDistance) {
            minDistance = distance;
            nearestStation = station;
          }
        });

        setSelectedStation(nearestStation.id);
        setIsLocating(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        setIsLocating(false);
      }
    );
  };

  const handleDownloadCSV = () => {
    if (!predictionData) return;

    const csvRows = [
      ["หมวดหมู่", "รายการ", "ค่า (Value)", "หน่วย (Unit)"],
      ["ข้อมูลสถานี", "ชื่อสถานี", predictionData.station_name, "-"],
      ["ข้อมูลสถานี", "รหัสสถานี", predictionData.station_id, "-"],
      ["สถิติพื้นฐาน", "จำนวนข้อมูล (ปี)", predictionData.basic_stats?.years_count ?? 42, "ปี"],
      ["สถิติพื้นฐาน", "ค่าสูงสุด (Max)", predictionData.basic_stats?.max ?? 0, "มม."],
      ["สถิติพื้นฐาน", "ค่าเฉลี่ย (Mean)", predictionData.basic_stats?.mean ?? 0, "มม."],
      ["สถิติพื้นฐาน", "ส่วนเบี่ยงเบนมาตรฐาน (S.D.)", predictionData.basic_stats?.std ?? 0, "มม."],
      ["พารามิเตอร์ GEV", "Location (μ)", predictionData.gev_parameters?.mu_location ?? 0, "-"],
      ["พารามิเตอร์ GEV", "Scale (σ)", predictionData.gev_parameters?.sigma_scale ?? 0, "-"],
      ["พารามิเตอร์ GEV", "Shape (ξ)", predictionData.gev_parameters?.xi_shape ?? 0, "-"],
      ["ระดับการเกิดซ้ำ", "รอบ 2 ปี", predictionData.return_levels?.["2_year"] ?? 0, "มม."],
      ["ระดับการเกิดซ้ำ", "รอบ 5 ปี", predictionData.return_levels?.["5_year"] ?? 0, "มม."],
      ["ระดับการเกิดซ้ำ", "รอบ 10 ปี", predictionData.return_levels?.["10_year"] ?? 0, "มม."],
      ["ระดับการเกิดซ้ำ", "รอบ 20 ปี", predictionData.return_levels?.["20_year"] ?? 0, "มม."],
      ["ระดับการเกิดซ้ำ", "รอบ 50 ปี", predictionData.return_levels?.["50_year"] ?? 0, "มม."],
      ["ระดับการเกิดซ้ำ", "รอบ 100 ปี", predictionData.return_levels?.["100_year"] ?? 0, "มม."],
      ["การประเมิน", "ระดับความเสี่ยง (100 ปี)", predictionData.risk_assessment?.level ?? "Unknown", "-"],
      ["การประเมิน", "คำแนะนำ", predictionData.risk_assessment?.description ?? "", "-"]
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + csvRows.map(row => row.map(item => `"${item}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RainGuard_Report_${predictionData.station_id}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthlyRisks = [
    { month: 'ม.ค.', risk: 'ต่ำ', color: 'text-green-600', bg: 'bg-green-50' },
    { month: 'ก.พ.', risk: 'ต่ำ', color: 'text-green-600', bg: 'bg-green-50' },
    { month: 'มี.ค.', risk: 'ปานกลาง', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { month: 'เม.ย.', risk: 'ปานกลาง', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { month: 'พ.ค.', risk: 'สูง', color: 'text-red-600', bg: 'bg-red-50' },
    { month: 'มิ.ย.', risk: 'สูง', color: 'text-red-600', bg: 'bg-red-50' },
    { month: 'ก.ค.', risk: 'สูง', color: 'text-red-600', bg: 'bg-red-50' },
    { month: 'ส.ค.', risk: 'ปานกลาง', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { month: 'ก.ย.', risk: 'ต่ำ', color: 'text-green-600', bg: 'bg-green-50' },
    { month: 'ต.ค.', risk: 'ต่ำ', color: 'text-green-600', bg: 'bg-green-50' },
    { month: 'พ.ย.', risk: 'ต่ำ', color: 'text-green-600', bg: 'bg-green-50' },
    { month: 'ธ.ค.', risk: 'ต่ำ', color: 'text-green-600', bg: 'bg-green-50' },
  ];

  if (isLoading || !predictionData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">กำลังประมวลผลข้อมูล...</h2>
        <p className="text-slate-500 text-sm mt-2">โปรดรอสักครู่ ระบบกำลังดึงข้อมูลอัจฉริยะ</p>
      </div>
    );
  }

  const forecastedValue = predictionData?.return_levels?.[`${selectedPeriod}_year`] ?? 0;
  const meanRainfall = predictionData?.basic_stats?.mean ?? 1;
  const riskInfo = getRiskLevel(forecastedValue);
  const chartData = returnPeriods.map(p => ({ 
    name: `${p} ปี`, 
    rainfall: predictionData?.return_levels?.[`${p}_year`] ?? 0 
  }));

  // ==========================================
  // PAGE RENDERERS
  // ==========================================

  const renderHome = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-1 md:col-span-2 bg-blue-600 text-white rounded-2xl p-6 shadow-lg shadow-blue-200">
          <p className="text-blue-100 text-sm mb-1">ฝนคาดการณ์ ({selectedPeriod} ปี)</p>
          <h3 className="text-4xl font-bold">{forecastedValue.toFixed(2)} <span className="text-lg font-normal">มม.</span></h3>
          <p className="mt-4 text-xs text-blue-200 flex items-center gap-1"><Activity className="w-3 h-3"/> {apiStatus === 'online' ? 'ข้อมูลจริงจาก TMD' : 'โหมดจำลอง (Offline)'}</p>
        </div>
        <div className={`col-span-1 ${riskInfo.bgLight} ${riskInfo.border} border rounded-2xl p-6 shadow-sm`}>
          <p className={`${riskInfo.text} text-sm mb-1`}>ระดับความเสี่ยง</p>
          <h3 className={`text-3xl font-bold ${riskInfo.text} flex items-center gap-2`}>
             <span className={`w-4 h-4 rounded-full ${riskInfo.color} animate-pulse`}></span>
             {riskInfo.level.split(' ')[0]}
          </h3>
          <p className={`text-xs mt-2 font-medium ${riskInfo.text}`}>{riskInfo.level}</p>
        </div>
        <div className="col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <p className="text-slate-500 text-sm mb-1">เทียบค่าเฉลี่ย</p>
          <div className="flex flex-col justify-center">
              <span className="text-3xl font-bold text-emerald-600">
                  ↗ +{(((forecastedValue - meanRainfall) / meanRainfall) * 100).toFixed(1)}%
              </span>
              <p className="text-[10px] text-slate-400 mt-2">จากสถิติย้อนหลัง</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-bold text-slate-800 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500"/> กราฟระดับการเกิดซ้ำ (Return Level Plot)</h4>
             <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">{predictionData?.station_name}</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12}/>
                <YAxis stroke="#94a3b8" fontSize={12}/>
                <Tooltip />
                <Area type="monotone" dataKey="rainfall" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRain)" strokeWidth={3} />
                <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'วิกฤต', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-slate-500"/> คาดการณ์ระดับความเสี่ยงรายเดือน</h4>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-72">
             {monthlyRisks.map((m, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                   <span className="text-sm font-medium text-slate-600">{m.month}</span>
                   <span className={`text-xs px-4 py-1 rounded-full font-bold ${m.bg} ${m.color}`}>{m.risk}</span>
                </div>
             ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
             <button onClick={() => changePage('advisory')} className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">ดูคำแนะนำการเกษตร</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStations = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 text-sm">สถิติข้อมูลฝนจากฐานข้อมูล ({predictionData?.station_name})</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <div className="text-xs text-slate-500">จำนวนข้อมูล</div>
              <div className="text-2xl font-bold text-blue-900">{predictionData?.basic_stats?.years_count ?? 42} ปี</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <div className="text-xs text-slate-500">ค่าสูงสุด (มม.)</div>
              <div className="text-2xl font-bold text-blue-900">{predictionData?.basic_stats?.max?.toFixed(2) ?? '0.00'}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <div className="text-xs text-slate-500">ค่าเฉลี่ย (มม.)</div>
              <div className="text-2xl font-bold text-blue-900">{predictionData?.basic_stats?.mean?.toFixed(2) ?? '0.00'}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <div className="text-xs text-slate-500">S.D.</div>
              <div className="text-2xl font-bold text-blue-900">{predictionData?.basic_stats?.std?.toFixed(2) ?? '0.00'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 text-sm">พารามิเตอร์แบบจำลอง GEV (MLE Method)</h3>
          <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div className="text-sm font-medium text-slate-700">Location Parameter (μ)</div>
                  <div className="font-bold text-blue-600 text-lg">{predictionData?.gev_parameters?.mu_location?.toFixed(2) ?? '0.00'}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div className="text-sm font-medium text-slate-700">Scale Parameter (σ)</div>
                  <div className="font-bold text-blue-600 text-lg">{predictionData?.gev_parameters?.sigma_scale?.toFixed(2) ?? '0.00'}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div className="text-sm font-medium text-slate-700">Shape Parameter (ξ)</div>
                  <div className="font-bold text-blue-600 text-lg">{predictionData?.gev_parameters?.xi_shape?.toFixed(4) ?? '0.0000'}</div>
              </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 text-sm">ข้อมูลระดับการเกิดซ้ำ (Return Level)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-medium rounded-tl-lg">คาบ (ปี)</th>
                {returnPeriods.map(p => <th key={p} className="py-3 px-4 font-medium text-center">{p}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-4 px-4 text-slate-500 font-medium">ปริมาณฝน (มม.)</td>
                {returnPeriods.map(p => (
                  <td key={p} className="py-4 px-4 text-center font-bold text-blue-600">
                    {predictionData?.return_levels?.[`${p}_year`]?.toFixed(2) ?? '0.00'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-4 px-4 text-slate-500 font-medium">ระดับความเสี่ยง</td>
                {returnPeriods.map(p => {
                  const val = predictionData?.return_levels?.[`${p}_year`] ?? 0;
                  const r = getRiskLevel(val);
                  return (
                    <td key={p} className="py-4 px-2 text-center">
                      <span className={`text-[10px] px-3 py-1.5 rounded-full font-medium ${r.bgLight} ${r.text}`}>{r.level.split(' ')[0]}</span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderMap = () => {
    const currentStationObj = stations.find(s => s.id === selectedStation) || stations[0];
    const lat = currentStationObj.latitude || 17.3571;
    const lon = currentStationObj.longitude || 104.8086;
    
    const offset = 0.5;
    const bbox = `${lon - offset},${lat - offset},${lon + offset},${lat + offset}`;
    const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden h-[600px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><MapIcon className="w-6 h-6 text-blue-500"/> แผนที่ความเสี่ยงอุทกวิทยา (Risk Map)</h3>
            <div className="flex gap-4 items-center">
              <span className="text-sm text-slate-500">แผนที่แบบ Interactive แสดงจุดพิกัดสถานี</span>
            </div>
          </div>
          
          <div className="w-full flex-1 rounded-xl border border-slate-200 overflow-hidden relative z-0">
             <iframe 
               width="100%" 
               height="100%" 
               frameBorder="0" 
               scrolling="no" 
               marginHeight="0" 
               marginWidth="0" 
               src={mapSrc}
               style={{ border: 'none' }}
               title="Interactive Risk Map"
             ></iframe>
          </div>
          
          <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
             <div>
               <p className="font-bold text-slate-800 text-sm">{currentStationObj.name}</p>
               <p className="text-xs text-slate-500 mt-1">ละติจูด: {lat} | ลองจิจูด: {lon}</p>
             </div>
             <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">ระดับความเสี่ยงปัจจุบัน (รอบ {selectedPeriod} ปี)</p>
                <div className={`text-xs font-bold px-3 py-1.5 rounded-full inline-block ${riskInfo.bgLight} ${riskInfo.text}`}>{riskInfo.level}</div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdvisory = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
        <div className="bg-green-600 rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2">คำแนะนำการวางแผนเพาะปลูก</h3>
                <p className="text-green-100 text-sm">อ้างอิงตามระดับความเสี่ยง {predictionData?.station_name}</p>
            </div>
            <Leaf className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-green-500 opacity-20" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
                { title: 'ข้าวนาปี', icon: '🌾', risk: 'สูง', advice: 'ควรเลี่ยงช่วงเดือนที่มีโอกาสฝนสุดขีดเกิน 200 มม. และเน้นพันธุ์ข้าวทนน้ำท่วมฉับพลัน' },
                { title: 'อ้อย', icon: '🎋', risk: 'ปานกลาง', advice: 'เน้นการทำทางระบายน้ำรอบแปลง และไม่ควรปลูกในพื้นที่ลุ่มต่ำที่มีประวัติน้ำท่วมขัง' },
                { title: 'มันสำปะหลัง', icon: '🥔', risk: 'สูง', advice: 'เป็นพืชไม่ทนน้ำขัง หากคาดการณ์ฝนสูงควรเลื่อนการปลูกหรือย้ายไปพื้นที่ดอน' },
            ].map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-green-300 transition-colors">
                    <span className="text-4xl mb-4 block">{item.icon}</span>
                    <h5 className="font-bold text-slate-800 text-lg mb-2">{item.title}</h5>
                    <div className="mb-4 inline-block px-2 py-1 bg-red-100 text-red-600 text-[10px] rounded font-bold">ความเสี่ยง: {item.risk}</div>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.advice}</p>
                </div>
            ))}
        </div>
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
        <h3 className="text-xl font-bold text-slate-800">ประวัติการแจ้งเตือนทั้งหมด</h3>
        <div className="space-y-3">
            {!alerts || alerts.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                ไม่มีประวัติการแจ้งเตือน
              </div>
            ) : (
              alerts.map(alert => (
                  <div key={alert.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className={`p-3 rounded-full ${alert.risk_level === 'High' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                              <h5 className="font-bold text-slate-800">{alert.station_name}</h5>
                              <span className="text-[10px] text-slate-400">{new Date(alert.generated_at).toLocaleString('th-TH')}</span>
                          </div>
                          <p className="text-sm text-slate-600">{alert.message}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 self-center" />
                  </div>
              ))
            )}
        </div>
    </div>
  );

  const renderDownload = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-2xl mx-auto mt-10">
        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <DownloadCloud className="w-10 h-10" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">ดาวน์โหลดข้อมูลการประเมิน</h3>
        <p className="text-slate-500 mb-8 leading-relaxed">
          ส่งออกผลการประเมินความเสี่ยงอุทกวิทยา พารามิเตอร์แบบจำลอง GEV และข้อมูลสถิติของสถานี<br/> 
          <b className="text-slate-700">{predictionData?.station_name}</b> เป็นไฟล์ตาราง (CSV) เพื่อนำไปใช้งานหรือวิเคราะห์ต่อ
        </p>
        
        <div className="flex justify-center">
          <button 
            onClick={handleDownloadCSV}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-200"
          >
            <FileText className="w-5 h-5" />
            ดาวน์โหลดไฟล์ CSV
          </button>
        </div>
        
        <div className="mt-8 bg-slate-50 p-6 rounded-xl text-left border border-slate-100">
          <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500"/> ข้อมูลที่จะถูกส่งออก:
          </h4>
          <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside ml-2">
            <li>ข้อมูลประจำสถานี (รหัสสถานี, ชื่อสถานี)</li>
            <li>สถิติพื้นฐานรายเดือน (ค่าสูงสุด, ค่าเฉลี่ย, ส่วนเบี่ยงเบนมาตรฐาน)</li>
            <li>พารามิเตอร์ของแบบจำลอง GEV (Location, Scale, Shape)</li>
            <li>ค่าคาดการณ์ปริมาณฝนสุดขีดในรอบ 2, 5, 10, 20, 50 และ 100 ปี</li>
            <li>ระดับความเสี่ยงและคำแนะนำสำหรับนำไปใช้จัดการแปลงเกษตร</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activePage) {
      case 'home': return renderHome();
      case 'stations': return renderStations();
      case 'map': return renderMap();
      case 'advisory': return renderAdvisory();
      case 'alerts': return renderAlerts();
      case 'download': return renderDownload();
      default: return renderHome();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      <div className={`w-64 bg-slate-900 text-white flex flex-col fixed h-full z-30 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
             <CloudRain className="w-8 h-8 text-blue-400" />
             <h1 className="font-black text-xl tracking-tight">RainGuard<span className="text-blue-400">AI</span></h1>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => changePage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activePage === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 bg-slate-950/50 m-4 rounded-2xl border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Developer</p>
            <p className="text-xs font-bold text-slate-300">โรงเรียนอุเทนพัฒนา</p>
        </div>
      </div>

      <div className="flex-1 md:ml-64 min-h-screen flex flex-col w-full">
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 p-4 flex flex-wrap gap-4 justify-between items-center sticky top-0 z-10 lg:px-8">
          
          <div className="flex items-center gap-3 w-full md:w-auto">
             <button className="md:hidden p-2 bg-slate-100 rounded-lg text-slate-600" onClick={() => setIsMobileMenuOpen(true)}>
               <Menu className="w-5 h-5" />
             </button>
             
             <div className="flex-1 md:flex-none flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <div className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100">
                   <MapPin className="w-4 h-4 text-slate-600" />
                </div>
                <select 
                    value={selectedStation} 
                    onChange={e => setSelectedStation(e.target.value)}
                    className="bg-transparent font-bold text-sm text-slate-800 focus:outline-none cursor-pointer flex-1 py-1"
                >
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                
                <button 
                   onClick={handleFindNearestStation}
                   disabled={isLocating}
                   title="ค้นหาสถานีใกล้ฉัน (GPS)"
                   className={`p-1.5 ml-1 rounded-lg transition-colors ${isLocating ? 'bg-blue-100 text-blue-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                   {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                </button>
             </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
             <div className={`flex items-center gap-2 py-1.5 px-3 rounded-full border text-[10px] sm:text-xs font-bold transition-all ${apiStatus === 'online' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                <span className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                {apiStatus === 'online' ? 'API ONLINE' : 'OFFLINE'}
             </div>
             <button className="bg-slate-50 p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
             </button>
             <div className="hidden sm:flex items-center gap-2 bg-slate-50 py-1.5 px-3 rounded-full border border-slate-200 cursor-pointer hover:bg-slate-100">
                <div className="w-6 h-6 bg-blue-600 rounded-full text-white flex items-center justify-center text-xs font-bold">U</div>
                <span className="text-xs font-bold text-slate-700">ผู้ใช้งาน</span>
             </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 md:p-8 flex-1">
            <div className="mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1 tracking-tight">
                    {pageTitles[activePage] || 'RainGuard-AI'}
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm">อ้างอิงตามแบบจำลอง GEV อัปเดตล่าสุด: {new Date().toLocaleDateString('th-TH')}</p>
            </div>

            {renderContent()}
            
        </main>
      </div>
    </div>
  );
}