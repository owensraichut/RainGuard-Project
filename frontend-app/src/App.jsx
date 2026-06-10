import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, BarChart, Bar, Legend
} from 'recharts';
import { 
  CloudRain, Map as MapIcon, Database, Leaf, Bell, Download, Info, 
  Calendar, MapPin, Activity, AlertTriangle, CheckCircle, Home, Loader2, ChevronRight, DownloadCloud, FileText,
  Navigation, Menu, X, Layers, TrendingUp, BarChart2
} from 'lucide-react';
import L from 'leaflet';

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
  const [allPredictions, setAllPredictions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState("connecting");
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [calMode, setCalMode] = useState("after");
  const [ovType, setOvType] = useState("bar");
  const [t1, setT1] = useState(90);
  const [t2, setT2] = useState(130);
  const [t3, setT3] = useState(180);
  const [simStation, setSimStation] = useState("48358");
  const [simValue, setSimValue] = useState(155);
  const [simLogs, setSimLogs] = useState([]);

  const menuItems = [
    { id: 'home', label: 'หน้าหลัก (รายสถานี)', icon: Home },
    { id: 'overview', label: 'เปรียบเทียบสถิติ 6 สถานี', icon: BarChart2 },
    { id: 'stations', label: 'ตาราง GEV รายสถานี', icon: Database },
    { id: 'map', label: 'แผนที่ความเสี่ยง', icon: MapIcon },
    { id: 'landuse', label: 'การใช้ที่ดินริมโขง', icon: Layers },
    { id: 'calendar', label: 'ปฏิทินเพาะปลูก', icon: Calendar },
    { id: 'advisory', label: 'คำแนะนำการเกษตร', icon: Leaf },
    { id: 'impact', label: 'ผลกระทบเชิงระบบ', icon: TrendingUp },
    { id: 'alerts', label: 'เกณฑ์และการแจ้งเตือน', icon: Bell },
    { id: 'download', label: 'ดาวน์โหลดรายงาน', icon: Download },
  ];

  const pageTitles = {
    home: 'สรุปภาพรวมความเสี่ยงรายสถานี',
    overview: 'เปรียบเทียบสถิติน้ำฝนสุดขีด 6 สถานี',
    stations: 'ตารางสถิติและแบบจำลอง GEV',
    map: 'แผนที่ความเสี่ยงอุทกวิทยา (IDW)',
    landuse: 'สถิติการเปลี่ยนแปลงการใช้ที่ดิน อ.ธาตุพนม',
    calendar: 'ปฏิทินการเพาะปลูกพืชริมแม่น้ำโขง',
    advisory: 'คู่มือและคำแนะนำการเพาะปลูกพืช',
    impact: 'ความเชื่อมโยง: น้ำฝนสุดขีดและการใช้ที่ดิน',
    alerts: 'ระบบตั้งเกณฑ์ภัยพิบัติและจำลองแจ้งเตือน',
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

  // 3. ดึงข้อมูลพยากรณ์สำหรับทุกสถานีมาเก็บไว้คำนวณ IDW
  useEffect(() => {
    if (!stations || stations.length === 0) return;
    
    const fetchAllPredictions = async () => {
      const promises = stations.map(async (s) => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/prediction/${s.id}`);
          if (!res.ok) throw new Error("API Fail");
          const data = await res.json();
          return { id: s.id, data };
        } catch (e) {
          return { id: s.id, data: generateMockData(s.id) };
        }
      });
      const results = await Promise.all(promises);
      const predMap = {};
      results.forEach(item => {
        predMap[item.id] = item.data;
      });
      setAllPredictions(predMap);
    };

    fetchAllPredictions();
  }, [stations]);

  // 4. วาดแผนที่ Leaflet และทำ IDW Interpolation
  useEffect(() => {
    if (activePage !== 'map' || !allPredictions || Object.keys(allPredictions).length === 0) return;

    const mapContainer = document.getElementById('leaflet-map');
    if (!mapContainer) return;

    const map = L.map('leaflet-map').setView([17.35, 104.2], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const minLat = 16.0;
    const maxLat = 18.8;
    const minLon = 103.0;
    const maxLon = 105.2;

    const latStep = 0.05;
    const lonStep = 0.05;

    // สเกลสีแบบคงที่ตามข้อกำหนดของผู้ใช้ (Absolute Scale: 104 - 312 มม.) เพื่อแสดงความต่างในทุกคาบปี
    const minVal = 104;
    const maxVal = 312;

    const calculateIDW = (lat, lon) => {
      let sumWeights = 0;
      let sumWeightedValues = 0;

      for (let i = 0; i < stations.length; i++) {
        const s = stations[i];
        const pred = allPredictions[s.id];
        const val = pred?.return_levels?.[`${selectedPeriod}_year`] ?? 0;
        
        const d = Math.sqrt(Math.pow(lat - s.latitude, 2) + Math.pow(lon - s.longitude, 2));
        
        if (d < 0.001) return val;
        
        const w = 1.0 / Math.pow(d, 2);
        sumWeights += w;
        sumWeightedValues += w * val;
      }

      return sumWeightedValues / sumWeights;
    };

    const getColorForValue = (val) => {
      const t = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
      const hue = 240 - t * 240;
      return `hsla(${hue}, 90%, 50%, 0.45)`;
    };

    const gridGroup = L.layerGroup();
    for (let lat = minLat; lat < maxLat; lat += latStep) {
      for (let lon = minLon; lon < maxLon; lon += lonStep) {
        const centerLat = lat + latStep / 2;
        const centerLon = lon + lonStep / 2;
        const val = calculateIDW(centerLat, centerLon);
        const color = getColorForValue(val);

        L.rectangle(
          [[lat, lon], [lat + latStep, lon + lonStep]],
          {
            color: 'transparent',
            fillColor: color,
            fillOpacity: 0.45,
            interactive: false
          }
        ).addTo(gridGroup);
      }
    }
    gridGroup.addTo(map);

    const markersGroup = L.layerGroup();
    stations.forEach(s => {
      const pred = allPredictions[s.id];
      const val = pred?.return_levels?.[`${selectedPeriod}_year`] ?? 0;
      
      const marker = L.circleMarker([s.latitude, s.longitude], {
        radius: 8,
        fillColor: '#ef4444',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1
      });

      const popupContent = `
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
          <h4 style="margin: 0 0 5px 0; font-weight: bold; color: #1e293b;">${s.name}</h4>
          <p style="margin: 0; color: #64748b;"><b>ฝนสุดขีด (${selectedPeriod} ปี):</b> <span style="color: #3b82f6; font-weight: bold;">${val.toFixed(2)} มม.</span></p>
          <p style="margin: 3px 0 0 0; color: #64748b;"><b>ความเสี่ยง:</b> <span style="font-weight: bold;">${val > 200 ? 'สูง (High)' : (val >= 120 ? 'ปานกลาง (Medium)' : 'ต่ำ (Low)')}</span></p>
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.addTo(markersGroup);
    });
    markersGroup.addTo(map);

    const LegendControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.border = '1px solid #e2e8f0';
        div.style.borderRadius = '12px';
        div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        div.style.fontFamily = 'sans-serif';
        div.style.fontSize = '11px';
        div.style.lineHeight = '18px';
        div.style.color = '#334155';

        let html = `<h5 style="margin: 0 0 6px 0; font-weight: bold; font-size: 11px;">ปริมาณฝนสุดขีด (มม.)</h5>`;
        html += `<div style="background: linear-gradient(to right, hsla(240, 90%, 50%, 0.8), hsla(180, 90%, 50%, 0.8), hsla(120, 90%, 50%, 0.8), hsla(60, 90%, 50%, 0.8), hsla(0, 90%, 50%, 0.8)); height: 12px; width: 120px; border-radius: 4px; margin-bottom: 5px;"></div>`;
        html += `<div style="display: flex; justify-content: space-between; font-weight: bold; width: 120px;">
          <span>${minVal.toFixed(0)}</span>
          <span>${((minVal + maxVal)/2).toFixed(0)}</span>
          <span>${maxVal.toFixed(0)}</span>
        </div>`;

        div.innerHTML = html;
        return div;
      }
    });
    new LegendControl().addTo(map);

    return () => {
      map.remove();
    };
  }, [activePage, allPredictions, selectedPeriod, stations]);

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

  // ข้อมูลงานวิจัย (จากบทความ: การเปลี่ยนแปลงการใช้ที่ดิน อ.ธาตุพนม จ.นครพนม)
  const researchData = {
    title: "การเปลี่ยนแปลงการใช้ที่ดินริมโขง อ.ธาตุพนม จ.นครพนม",
    source: "วารสารวิทยาศาสตร์และเทคโนโลยี ม.อุบลราชธานี ปี 2562",
    landUseChanges: [
      { period: "2538–2547", agri: -32.50, forest: -17.50, water: +19.54, misc: +20.79, label: "ก่อนพัฒนาลุ่มโขง" },
      { period: "2547–2560", agri: -6.24, forest: -11.42, water: -32.34, misc: +43.51, label: "หลังพัฒนาลุ่มโขง" },
    ],
    accuracy: [{ year: "2538", pct: 85.31 }, { year: "2547", pct: 88.81 }, { year: "2560", pct: 92.30 }],
    insight: "ตลิ่งถูกกัดเซาะส่งผลให้พื้นที่เกษตรริมโขงลดลงต่อเนื่อง เกษตรกรเปลี่ยนจากผลิตเพื่อยังชีพ มาเป็นเชิงพาณิชย์ ใช้ทุนและเทคโนโลยีสูงขึ้น"
  };

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

      {/* === Research Context Panel === */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5 flex items-center gap-3">
          <div className="bg-white/20 rounded-xl p-2">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">บริบทงานวิจัย: {researchData.title}</h4>
            <p className="text-indigo-200 text-xs mt-0.5">{researchData.source}</p>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {/* Land use change stats */}
            {researchData.landUseChanges.map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-600">{item.period}</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium border border-indigo-100">{item.label}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">🌾 เกษตรกรรม</span>
                    <span className={`font-bold ${item.agri < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{item.agri > 0 ? '+' : ''}{item.agri}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">🌳 ป่าไม้</span>
                    <span className={`font-bold ${item.forest < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{item.forest > 0 ? '+' : ''}{item.forest}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">💧 แหล่งน้ำ</span>
                    <span className={`font-bold ${item.water < 0 ? 'text-red-500' : 'text-blue-500'}`}>{item.water > 0 ? '+' : ''}{item.water}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">🏗️ เบ็ดเตล็ด</span>
                    <span className={`font-bold ${item.misc > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>{item.misc > 0 ? '+' : ''}{item.misc}%</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Accuracy panel */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-xs font-bold text-slate-600 mb-3">ความถูกต้องแผนที่ดาวเทียม</div>
              <div className="space-y-2">
                {researchData.accuracy.map((a, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">ปี {a.year}</span>
                      <span className="font-bold text-indigo-600">{a.pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${a.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-slate-400">Landsat 5 (2538, 2547) + Sentinel-2 (2560) | OBIA method</div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed"><b>ข้อค้นพบสำคัญ:</b> {researchData.insight}</p>
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

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden h-[600px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <MapIcon className="w-6 h-6 text-blue-500" /> แผนที่ความเสี่ยงอุทกวิทยา (IDW Risk Map)
            </h3>
            <div className="flex gap-4 items-center">
              <label className="text-xs font-bold text-slate-500">คาบปีฝนสุดขีด (Return Period):</label>
              <select
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {returnPeriods.map(p => <option key={p} value={p}>{p} ปี</option>)}
              </select>
            </div>
          </div>
          
          <div className="w-full flex-1 rounded-xl border border-slate-200 overflow-hidden relative z-0">
             <div id="leaflet-map" className="w-full h-full" style={{ minHeight: '380px' }}></div>
          </div>
          
          <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
             <div>
               <p className="font-bold text-slate-800 text-sm">การประมวลผลเชิงพื้นที่ (Spatial Interpolation)</p>
               <p className="text-xs text-slate-500 mt-1">แสดงผลเกรเดียนความเสี่ยงตามแบบจำลองคณิตศาสตร์ IDW (กำลัง 2) ของพื้นที่ 4 จังหวัดอีสานเหนือ</p>
             </div>
             <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">คาบความเสี่ยงที่แสดง</p>
                <div className="text-xs font-bold px-3 py-1.5 rounded-full inline-block bg-blue-50 text-blue-600 border border-blue-100">
                  รอบ {selectedPeriod} ปี
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdvisory = () => {
    const fieldCrops = [
      { title: 'ข้าวนาปี', icon: '🌾', vulnerability: 'ปานกลาง', advice: 'ควรเลือกใช้พันธุ์ข้าวที่ทนน้ำท่วมฉับพลัน (เช่น พันธุ์ข้าวทนน้ำท่วม หรือข้าวมะลิ กข6) หลีกเลี่ยงการหว่านข้าวในช่วงพฤษภาคม-สิงหาคมที่มีโอกาสเกิดฝนสุดขีดสูง', color: 'border-amber-200 text-amber-600 bg-amber-50' },
      { title: 'อ้อย', icon: '🎋', vulnerability: 'ต่ำ', advice: 'ทนต่อสภาวะน้ำขังได้ดีกว่าพืชไร่อื่นๆ แต่ควรทำระบบร่องระบายน้ำรอบแปลง และระวังดินสไลด์พังทลายหากปลูกในพื้นที่ลาดชันช่วงฝนชุก', color: 'border-emerald-200 text-emerald-600 bg-emerald-50' },
      { title: 'มันสำปะหลัง', icon: '🥔', vulnerability: 'สูงมาก', advice: 'ไม่ทนต่อน้ำท่วมขังเด็ดขาด (หัวจะเน่าเสียหายภายใน 3 วัน) ควรย้ายไปปลูกในพื้นที่ดอน หรือเลื่อนการเก็บเกี่ยวและปลูกใหม่เพื่อหลบช่วงฤดูฝนสุดขีด', color: 'border-red-200 text-red-600 bg-red-50' },
      { title: 'ข้าวโพดเลี้ยงสัตว์', icon: '🌽', vulnerability: 'สูง', advice: 'อ่อนแอต่อดินแฉะและน้ำขังในระยะต้นกล้า ควรยกแปลงร่องระบายน้ำสูง 20-30 ซม. เพื่อป้องกันน้ำขังโคนต้น และหลีกเลี่ยงการเพาะปลูกในเดือนที่ฝนตกชุกที่สุด', color: 'border-orange-200 text-orange-600 bg-orange-50' },
    ];

    const vegetableCrops = [
      { title: 'พริกและกะเพรา', icon: '🌶️', vulnerability: 'สูงมาก', advice: 'รากเน่าและใบร่วงพังทลายได้ง่ายเมื่อดินชุ่มน้ำเกินไป แนะนำให้ยกร่องสูง 30-40 ซม. คลุมพลาสติกหน้าดินเพื่อลดแรงกระแทกจากน้ำฝนชุกและป้องกันการสูญเสียปุ๋ย', color: 'border-red-200 text-red-600 bg-red-50' },
      { title: 'ผักคะน้าและกะหล่ำปลี', icon: '🥬', vulnerability: 'ปานกลาง', advice: 'ทนทานฝนได้พอสมควร แต่ระวังโรคเน่าคอดินและโรคราน้ำค้าง ควรโรยปูนขาวเพื่อลดความเป็นกรดของดินแฉะ และพ่นสารชีวภัณฑ์บำรุงเป็นประจำ', color: 'border-emerald-200 text-emerald-600 bg-emerald-50' },
      { title: 'มะเขือเทศและแตงกวา', icon: '🍅', vulnerability: 'สูง', advice: 'ฝนตกกระแทกหนักจะทำให้ดอกร่วงและผลแตกเสียหายง่าย ควรสร้างค้างให้แข็งแรง ปลูกใต้โรงเรือนพลาสติกชั่วคราว หรือใช้ตาข่ายพรางแสงช่วยลดแรงกระแทกของน้ำฝน', color: 'border-orange-200 text-orange-600 bg-orange-50' },
      { title: 'หอมแดงและกระเทียม', icon: '🧅', vulnerability: 'สูงมาก', advice: 'หัวเน่าเสียหายรวดเร็วหากมีน้ำแช่ขังดิน ควรปลูกบนแปลงร่องยกสูงมากผสมดินทรายเพื่อเพิ่มการระบายน้ำ และแนะนำให้คลุมด้วยฟางแห้งเพื่อรักษาความชื้นแบบพอดี', color: 'border-red-200 text-red-600 bg-red-50' },
    ];

    return (
      <div className="space-y-8 animate-in slide-in-from-right duration-500">
        {/* Banner */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-8 text-white relative overflow-hidden shadow-md shadow-green-100">
          <div className="relative z-10 max-w-xl">
            <h3 className="text-2xl font-bold mb-2">คำแนะนำและคู่มือการเกษตรอัจฉริยะ</h3>
            <p className="text-green-100 text-sm leading-relaxed">
              วิเคราะห์ความล่อแหลมและให้คำแนะนำในการจัดการแปลงเกษตรทั้ง <b>กลุ่มพืชไร่เศรษฐกิจ</b> และ <b>กลุ่มพืชผักสวนครัว</b> ตามสถิติความเสี่ยงน้ำท่วมของสถานี {predictionData?.station_name}
            </p>
          </div>
          <Leaf className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-green-400 opacity-20 rotate-12" />
        </div>

        {/* Section 1: พืชไร่ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <span className="text-2xl">🌾</span>
            <h4 className="text-lg font-bold text-slate-800">กลุ่มพืชไร่เศรษฐกิจ (Field Crops)</h4>
            <span className="text-xs text-slate-400 font-normal ml-2">พืชอายุสั้นและพืชอุตสาหกรรมในพื้นที่กว้าง</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {fieldCrops.map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-green-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                <div>
                  <span className="text-4xl mb-4 block">{item.icon}</span>
                  <h5 className="font-bold text-slate-800 text-base mb-1">{item.title}</h5>
                  <div className={`mb-3 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${item.color}`}>
                    ความเปราะบาง: {item.vulnerability}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{item.advice}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: พืชผักสวนครัว */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <span className="text-2xl">🥬</span>
            <h4 className="text-lg font-bold text-slate-800">กลุ่มพืชผักสวนครัว (Kitchen Garden Vegetables)</h4>
            <span className="text-xs text-slate-400 font-normal ml-2">พืชผักโตไว ความเปราะบางสูงจากปริมาณฝนชุก</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {vegetableCrops.map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                <div>
                  <span className="text-4xl mb-4 block">{item.icon}</span>
                  <h5 className="font-bold text-slate-800 text-base mb-1">{item.title}</h5>
                  <div className={`mb-3 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${item.color}`}>
                    ความเปราะบาง: {item.vulnerability}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{item.advice}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: พืชริมฝั่งโขง (จากงานวิจัย) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-indigo-100">
            <span className="text-2xl">🏞️</span>
            <h4 className="text-lg font-bold text-slate-800">กลุ่มพืชสวนริมฝั่งแม่น้ำโขง (Mekong Riverside Crops)</h4>
            <span className="text-xs bg-indigo-50 text-indigo-600 font-medium ml-2 px-2 py-0.5 rounded-full border border-indigo-100">ข้อมูลจากงานวิจัย อ.ธาตุพนม จ.นครพนม</span>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-800 flex gap-3 items-start">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-500" />
            <span>พืชเหล่านี้เป็นพืชที่เกษตรกรริมฝั่งโขงนิยมปลูกในช่วงหน้าแล้ง (ม.ค.–เม.ย.) บนตลิ่งที่น้ำลด เป็นการเกษตรเชิงพาณิชย์ที่มีความเสี่ยงสูงต่อน้ำท่วมฉับพลันในฤดูฝน ควรวางแผนตามคาบอุทกภัยของสถานีใกล้เคียง</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'กะหล่ำปลี', icon: '🥦', vulnerability: 'ปานกลาง', season: 'ม.ค.–มี.ค.', advice: 'ปลูกได้ดีในช่วงหน้าแล้งบนดินตะกอนริมฝั่ง ควรเฝ้าระวังน้ำหลากในเดือนมีนาคม-เมษายน หากพยากรณ์มีฝนมาก ควรเร่งเก็บเกี่ยวก่อนกำหนด', color: 'border-emerald-200 text-emerald-600 bg-emerald-50' },
              { title: 'ผักกาดขาวและคะน้า', icon: '🥬', vulnerability: 'ปานกลาง', season: 'ม.ค.–มี.ค.', advice: 'อายุเก็บเกี่ยวสั้น 45–60 วัน เหมาะสมกับพื้นที่ริมโขงที่ถูกน้ำท่วมตามฤดูกาล ควรวางแผนให้เก็บเกี่ยวก่อนฤดูฝนน้ำหลาก', color: 'border-emerald-200 text-emerald-600 bg-emerald-50' },
              { title: 'ผักชี', icon: '🌿', vulnerability: 'สูง', season: 'ธ.ค.–ก.พ.', advice: 'ทนความชื้นสูงได้น้อย ฝนตกหนักทำให้เน่าเสียหายรวดเร็ว ควรปลูกเฉพาะช่วงหน้าหนาวแล้งจัด และไม่ควรปลูกหากพยากรณ์อุทกภัยมีความน่าจะเป็นสูง', color: 'border-orange-200 text-orange-600 bg-orange-50' },
              { title: 'แตงกวา', icon: '🥒', vulnerability: 'สูง', season: 'ม.ค.–มี.ค.', advice: 'ผลแตกง่ายเมื่อได้รับน้ำไม่สม่ำเสมอ น้ำท่วมฉับพลันทำให้รากเน่า แนะนำยกแปลงสูง 30 ซม. และติดตามพยากรณ์น้ำโขงในฤดูเปลี่ยนผ่าน', color: 'border-orange-200 text-orange-600 bg-orange-50' },
              { title: 'พืชตะกอนทั่วไป (ยังชีพ→พาณิชย์)', icon: '🌱', vulnerability: 'ตามฤดูกาล', season: 'ทั้งปี', advice: 'งานวิจัยพบว่าเกษตรกรเปลี่ยนจากผลิตเพื่อยังชีพ (ปุ๋ยธรรมชาติ ไม่ใช้สารเคมี) มาเป็นพาณิชย์ ใช้ทุนสูงขึ้น ควรวางแผนประกันความเสี่ยงและเลือกพันธุ์ทนน้ำ', color: 'border-slate-200 text-slate-600 bg-slate-50' },
              { title: 'ความเสี่ยงจากการกัดเซาะตลิ่ง', icon: '⚠️', vulnerability: 'สูงมาก', season: 'พ.ค.–ต.ค.', advice: 'งานวิจัยพบว่าพื้นที่เกษตรริมโขงลดลง 32.50% ในช่วง 2538–2547 และ 6.24% ในช่วง 2547–2560 เนื่องจากตลิ่งพัง ควรหลีกเลี่ยงปลูกพืชใกล้ตลิ่งในช่วงน้ำหลาก', color: 'border-red-200 text-red-600 bg-red-50' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-4xl">{item.icon}</span>
                    <span className="text-[10px] text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">{item.season}</span>
                  </div>
                  <h5 className="font-bold text-slate-800 text-base mb-1">{item.title}</h5>
                  <div className={`mb-3 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${item.color}`}>
                    ความเปราะบาง: {item.vulnerability}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{item.advice}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handleAlertClick = (alert) => {
    // หาสถานีที่ตรงกับการแจ้งเตือน แล้วเลือกและพาไปหน้าหลัก
    const matchedStation = stations.find(s => s.name === alert.station_name || s.id === alert.station_id);
    if (matchedStation) {
      setSelectedStation(matchedStation.id);
    }
    changePage('home');
  };

  const handleRunSimulation = () => {
    const s = stations.find(x => x.id === simStation) || stations[0];
    const val = Number(simValue);
    
    // Determine risk level based on current set thresholds t1, t2, t3
    let lv = "ปกติ";
    let cls = "bg-green-50 text-green-600 border border-green-200";
    let badgeCls = "bg-green-500 text-white";
    let msg = `${s.name} ฝน ${val} มม. — ปกติ`;

    if (val >= t3) {
      lv = "วิกฤต";
      cls = "bg-red-50 text-red-600 border border-red-200";
      badgeCls = "bg-red-500 text-white";
      msg = `${s.name} ฝน ${val} มม. — เกินวิกฤต (${t3} มม.) แจ้งหน่วยงานอพยพ+ปิดชลประทาน`;
    } else if (val >= t2) {
      lv = "เตือนภัย";
      cls = "bg-yellow-50 text-yellow-600 border border-yellow-200";
      badgeCls = "bg-yellow-500 text-white";
      msg = `${s.name} ฝน ${val} มม. — เกินเตือน (${t2} มม.) เตรียมรับมือน้ำท่วม`;
    } else if (val >= t1) {
      lv = "เฝ้าระวัง";
      cls = "bg-orange-50 text-orange-600 border border-orange-200";
      badgeCls = "bg-orange-500 text-white";
      msg = `${s.name} ฝน ${val} มม. — ถึงเกณฑ์เฝ้าระวัง (${t1} มม.) แจ้งเกษตรกร`;
    }

    const t = new Date().toLocaleTimeString('th-TH');
    const newLog = { lv, cls, badgeCls, msg, t, id: Date.now() };
    setSimLogs(prev => [newLog, ...prev.slice(0, 9)]);
  };

  const handleClearLogs = () => {
    setSimLogs([]);
  };

  const renderOverviewComparison = () => {
    const chartData = [
      { name: '2 ปี', 'สกลนคร สกษ.': 101.82, 'สกลนคร': 90.96, 'นครพนม': 123.31, 'นครพนม สกษ.': 137.46, 'บึงกาฬ': 103.72, 'มุกดาหาร': 100.55 },
      { name: '5 ปี', 'สกลนคร สกษ.': 132.38, 'สกลนคร': 113.56, 'นครพนม': 164.54, 'นครพนม สกษ.': 180.18, 'บึงกาฬ': 139.00, 'มุกดาหาร': 128.74 },
      { name: '10 ปี', 'สกลนคร สกษ.': 152.30, 'สกลนคร': 130.30, 'นครพนม': 191.54, 'นครพนม สกษ.': 206.73, 'บึงกาฬ': 162.20, 'มุกดาหาร': 147.12 },
      { name: '50 ปี', 'สกลนคร สกษ.': 195.30, 'สกลนคร': 172.83, 'นครพนม': 250.15, 'นครพนม สกษ.': 260.68, 'บึงกาฬ': 212.80, 'มุกดาหาร': 186.75 },
      { name: '100 ปี', 'สกลนคร สกษ.': 213.14, 'สกลนคร': 193.49, 'นครพนม': 274.59, 'นครพนม สกษ.': 281.75, 'บึงกาฬ': 234.00, 'มุกดาหาร': 203.17 },
    ];
    const stationsKeys = ['สกลนคร สกษ.', 'สกลนคร', 'นครพนม', 'นครพนม สกษ.', 'บึงกาฬ', 'มุกดาหาร'];
    const colors = ['#185FA5','#0F6E56','#D85A30','#993556','#BA7517','#639922'];
    const tableData = [
      { name: 'สกลนคร สกษ.', prov: 'สกลนคร', r2: 101.82, r5: 132.38, r10: 152.30, r50: 195.30, r100: 213.14, dist: 'Weibull', risk: 'mid' },
      { name: 'สกลนคร', prov: 'สกลนคร', r2: 90.96, r5: 113.56, r10: 130.30, r50: 172.83, r100: 193.49, dist: 'Fréchet', risk: 'low' },
      { name: 'นครพนม', prov: 'นครพนม', r2: 123.31, r5: 164.54, r10: 191.54, r50: 250.15, r100: 274.59, dist: 'Weibull', risk: 'high' },
      { name: 'นครพนม สกษ.', prov: 'นครพนม', r2: 137.46, r5: 180.18, r10: 206.73, r50: 260.68, r100: 281.75, dist: 'Weibull', risk: 'high' },
      { name: 'บึงกาฬ', prov: 'บึงกาฬ', r2: 103.72, r5: 139.00, r10: 162.20, r50: 212.80, r100: 234.00, dist: 'Weibull', risk: 'mid' },
      { name: 'มุกดาหาร', prov: 'มุกดาหาร', r2: 100.55, r5: 128.74, r10: 147.12, r50: 186.75, r100: 203.17, dist: 'Weibull', risk: 'mid' }
    ];

    const getRiskBadge = (risk) => {
      if (risk === 'high') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">สูง</span>;
      if (risk === 'mid') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-600 border border-yellow-200">ปานกลาง</span>;
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-600 border border-green-200">ต่ำ</span>;
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-xs mb-1">Return Level 100 ปี (สูงสุด)</p>
            <h3 className="text-2xl font-bold text-slate-800">281.75 <span className="text-sm font-normal text-slate-500">มม.</span></h3>
            <p className="text-[10px] text-slate-400 mt-1">นครพนม สกษ. (48358)</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-xs mb-1">ฝนสูงสุดบันทึกได้</p>
            <h3 className="text-2xl font-bold text-slate-800">304.40 <span className="text-sm font-normal text-slate-500">มม.</span></h3>
            <p className="text-[10px] text-slate-400 mt-1">สถานีวัดฝนนครพนม (48357)</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-xs mb-1">พื้นที่เกษตรลดลง (2538–2560)</p>
            <h3 className="text-2xl font-bold text-red-600">-934 <span className="text-sm font-normal text-slate-500">ไร่</span></h3>
            <p className="text-[10px] text-slate-400 mt-1">จาก 6,092 ไร่ → 5,158 ไร่ (อ.ธาตุพนม)</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-xs mb-1">กลุ่มตัวอย่างเกษตรกร</p>
            <h3 className="text-2xl font-bold text-indigo-600">60 <span className="text-sm font-normal text-slate-500">ราย</span></h3>
            <p className="text-[10px] text-slate-400 mt-1">สัมภาษณ์เชิงลึก อ.ธาตุพนม จ.นครพนม</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              เปรียบเทียบ Return Level 6 สถานี
            </h4>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-500">รูปแบบกราฟ:</span>
              <select
                value={ovType}
                onChange={(e) => setOvType(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
              >
                <option value="bar">กราฟแท่ง (Bar Chart)</option>
                <option value="line">กราฟเส้น (Line Chart)</option>
              </select>
            </div>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {ovType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip formatter={(value) => [`${value} มม.`, '']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {stationsKeys.map((k, i) => (
                    <Bar key={k} dataKey={k} fill={colors[i]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip formatter={(value) => [`${value} มม.`, '']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {stationsKeys.map((k, i) => (
                    <Line key={k} type="monotone" dataKey={k} stroke={colors[i]} strokeWidth={2} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-4 text-sm">ตารางค่าระดับการเกิดซ้ำ (Return Level Table) - เปรียบเทียบทุกสถานี</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold text-slate-600">สถานี</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600">จังหวัด</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">2 ปี</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">5 ปี</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">10 ปี</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">50 ปี</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">100 ปี</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600">การแจกแจง GEV</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-center">ระดับความเสี่ยง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-medium text-slate-800">{row.name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{row.prov}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.r2.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.r5.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.r10.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.r50.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600">{row.r100.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{row.dist}</td>
                    <td className="py-2.5 px-3 text-center">{getRiskBadge(row.risk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderLandUse = () => {
    const luTypes = [
      { name: 'แหล่งน้ำ', color: 'bg-blue-600', fill: '#2563EB', y38: 10169, y47: 10656, y60: 10013, diff: -1.5 },
      { name: 'เกษตรกรรม', color: 'bg-green-600', fill: '#16A34A', y38: 6092, y47: 5252, y60: 5158, diff: -15.3 },
      { name: 'อยู่อาศัย', color: 'bg-red-600', fill: '#DC2626', y38: 1992, y47: 2233, y60: 2362, diff: 18.6 },
      { name: 'ป่าไม้', color: 'bg-cyan-600', fill: '#0891B2', y38: 1550, y47: 1114, y60: 887, diff: -42.8 },
      { name: 'เบ็ดเตล็ด', color: 'bg-purple-600', fill: '#9333EA', y38: 680, y47: 1198, y60: 2063, diff: 203.4 }
    ];
    const totalArea = 20483;

    const chartData = luTypes.map(l => ({
      name: l.name,
      'พ.ศ. 2538': l.y38,
      'พ.ศ. 2547': l.y47,
      'พ.ศ. 2560': l.y60
    }));

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {luTypes.map((lu) => {
            const diffPct = ((lu.y60 - lu.y38) / lu.y38 * 100).toFixed(1);
            const isUp = lu.y60 >= lu.y38;
            return (
              <div key={lu.name} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-700 font-bold text-xs">{lu.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isUp ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                      {isUp ? '+' : ''}{diffPct}%
                    </span>
                  </div>
                  
                  <div className="space-y-2 mt-3">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>พ.ศ. 2538</span>
                        <span>{lu.y38.toLocaleString()} ไร่</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1">
                        <div className={`h-1 rounded-full ${lu.color}`} style={{ width: `${(lu.y38 / totalArea * 100) * 2}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>พ.ศ. 2547</span>
                        <span>{lu.y47.toLocaleString()} ไร่</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1">
                        <div className={`h-1 rounded-full ${lu.color} opacity-70`} style={{ width: `${(lu.y47 / totalArea * 100) * 2}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>พ.ศ. 2560</span>
                        <span>{lu.y60.toLocaleString()} ไร่</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1">
                        <div className={`h-1 rounded-full ${lu.color} opacity-40`} style={{ width: `${(lu.y60 / totalArea * 100) * 2}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 text-sm">กราฟเปรียบเทียบขนาดพื้นที่แยกตามการใช้ประโยชน์ (ไร่)</h4>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip formatter={(value) => [`${value.toLocaleString()} ไร่`, '']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="พ.ศ. 2538" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="พ.ศ. 2547" fill="#6366f1" opacity={0.7} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="พ.ศ. 2560" fill="#818cf8" opacity={0.4} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-500" /> คำอธิบายและระเบียบวิธี
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                การวิเคราะห์การเปลี่ยนแปลงการใช้ที่ดินครอบคลุมพื้นที่ริมแม่น้ำโขง <b>อำเภอธาตุพนม จังหวัดนครพนม</b> พื้นที่รวมประมาณ 345.66 ตร.กม. (ครอบคลุม 7 ตำบลที่ตั้งแปลงเกษตรริมโขง)
              </p>
              <div className="my-4 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="font-bold text-slate-700 block">เทคโนโลยีที่ใช้:</span>
                  <span className="text-slate-500">ดาวเทียม Landsat 5 (ปี 2538, 2547) และ Sentinel-2 (ปี 2560)</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block">การประมวลผลรูปภาพ:</span>
                  <span className="text-slate-500">จำแนกตามพิกัดโครงสร้างวัตถุ (OBIA) โดยมีความถูกต้องสูง</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block">เกณฑ์ความถูกต้องเฉลี่ย (Overall Accuracy):</span>
                  <ul className="list-disc list-inside text-slate-500 mt-1 pl-1 space-y-0.5">
                    <li>พ.ศ. 2538: 85.31%</li>
                    <li>พ.ศ. 2547: 88.81%</li>
                    <li>พ.ศ. 2560: 92.30%</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-800">
              💡 <b>ข้อมูลวิจัย:</b> พื้นที่เกษตรริมฝั่งโขงลดลงอย่างมีนัยสำคัญกว่า 934 ไร่ เนื่องจากการเปลี่ยนแปลงขอบเขตตลิ่งและโครงสร้างพนังกันน้ำ
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-4 text-sm">ตารางสถิติและการเปลี่ยนแปลงสัดส่วนการใช้ที่ดิน (%)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold text-slate-600">ประเภทที่ดิน</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">2538 (ไร่)</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">2547 (ไร่)</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">2560 (ไร่)</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-center">สัดส่วนปี 38</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-center">สัดส่วนปี 60</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-center">เปลี่ยน 38-47</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-center">เปลี่ยน 47-60</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {luTypes.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-medium text-slate-800">{row.name}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.y38.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.y47.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.y60.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{(row.y38/totalArea*100).toFixed(2)}%</td>
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{(row.y60/totalArea*100).toFixed(2)}%</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.name === 'เกษตรกรรม' || row.name === 'ป่าไม้' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                        {row.name === 'แหล่งน้ำ' ? '+19.54%' : row.name === 'เกษตรกรรม' ? '-32.50%' : row.name === 'อยู่อาศัย' ? '+9.67%' : row.name === 'ป่าไม้' ? '-17.50%' : '+20.79%'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.name === 'แหล่งน้ำ' || row.name === 'เกษตรกรรม' || row.name === 'ป่าไม้' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                        {row.name === 'แหล่งน้ำ' ? '-32.34%' : row.name === 'เกษตรกรรม' ? '-6.24%' : row.name === 'อยู่อาศัย' ? '+6.45%' : row.name === 'ป่าไม้' ? '-11.42%' : '+43.51%'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCropCalendar = () => {
    const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const CROPS_BEFORE = [
      { name: 'พริก/มะเขือ/ฟักทอง', color: 'bg-blue-600', fill: '#2563EB', months: [0,0,0,0,0,0,0,1,1,1,1,1] },
      { name: 'กะหล่ำ/ผักกาด/คะน้า', color: 'bg-green-600', fill: '#16A34A', months: [1,1,1,0,0,0,0,0,0,0,0,0] },
      { name: 'ข่า/ตะไคร้/มะละกอ', color: 'bg-amber-600', fill: '#D97706', months: [0,0,0,1,1,0,0,0,0,0,0,0] },
      { name: 'พักหน้าดิน', color: 'bg-slate-500', fill: '#64748B', months: [0,0,0,1,1,0,0,0,0,0,0,0] }
    ];
    const CROPS_AFTER = [
      { name: 'ผักบุ้ง/กวางตุ้ง', color: 'bg-cyan-600', fill: '#0891B2', months: [0,0,0,0,0,0,1,0,0,0,0,0] },
      { name: 'พริก/มะเขือ/ฟักทอง/หอมแบ่ง', color: 'bg-blue-600', fill: '#2563EB', months: [0,0,0,0,0,0,0,1,1,1,1,1] },
      { name: 'หอมแดง/กระเทียม/กะหล่ำ/ผักกาด', color: 'bg-green-600', fill: '#16A34A', months: [1,1,1,1,0,0,0,0,0,0,0,0] },
      { name: 'ข่า/ตะไคร้/มะเขือเปราะ/มะละกอ', color: 'bg-amber-600', fill: '#D97706', months: [0,0,0,0,1,1,0,0,0,0,0,0] },
      { name: 'ยาสูบ', color: 'bg-purple-600', fill: '#9333EA', months: [0,0,0,0,1,1,1,0,0,0,0,0] }
    ];

    const RAIN_MONTHLY = [
      { name: 'ม.ค.', 'ปริมาณฝน (มม.)': 18, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'ก.พ.', 'ปริมาณฝน (มม.)': 22, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'มี.ค.', 'ปริมาณฝน (มม.)': 50, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'เม.ย.', 'ปริมาณฝน (มม.)': 85, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'พ.ค.', 'ปริมาณฝน (มม.)': 175, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'มิ.ย.', 'ปริมาณฝน (มม.)': 210, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'ก.ค.', 'ปริมาณฝน (มม.)': 240, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'ส.ค.', 'ปริมาณฝน (มม.)': 265, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'ก.ย.', 'ปริมาณฝน (มม.)': 285, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'ต.ค.', 'ปริมาณฝน (มม.)': 220, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'พ.ย.', 'ปริมาณฝน (มม.)': 80, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 },
      { name: 'ธ.ค.', 'ปริมาณฝน (มม.)': 30, 'เกณฑ์เฝ้าระวัง': 90, 'เกณฑ์เตือนภัย': 130 }
    ];

    const currentCrops = calMode === 'before' ? CROPS_BEFORE : CROPS_AFTER;

    const calCtx = {
      before: 'ก่อนโครงการพัฒนา (พ.ศ. ก่อน 2539): เกษตรกรรมแบบยังชีพ เพาะปลูกตามฤดูกาล พักหน้าดิน เม.ย.–พ.ค. ใช้เมล็ดพันธุ์ท้องถิ่น ปุ๋ยธรรมชาติ แรงงานในครอบครัว',
      after: 'หลังโครงการพัฒนา (พ.ศ. 2547–ปัจจุบัน): เกษตรกรรมเชิงพาณิชย์ เพาะปลูกตลอดปีโดยไม่พักหน้าดิน ปลูกพืชหมุนเวียน ซื้อเมล็ดพันธุ์ ใช้ปุ๋ยเคมีและสารเคมี จ้างรถไถ+แรงงาน'
    };

    const calNote = {
      before: 'ช่วงน้ำลดริมโขง (ส.ค.–ธ.ค.) = จุดเริ่มฤดูเพาะปลูก | ช่วงฝนหนัก (ก.ค.–ก.ย.) ปริมาณฝน >200 มม./เดือน เกษตรกรไม่เพาะปลูกในพื้นที่เสี่ยง',
      after: 'เกษตรกรเริ่มปลูกเร็วขึ้น (ก.ค.) เพราะพื้นที่มีจำกัด ต้องใช้ประโยชน์ตลอดปี | ความเสี่ยงจากฝนสุดขีดเพิ่มขึ้นเพราะปลูกในช่วงที่ปริมาณฝนยังสูง'
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h4 className="font-bold text-slate-800 text-sm">ปฏิทินเพาะปลูกพืชริมฝั่งแม่น้ำโขง (Crop Calendar)</h4>
            <select
              value={calMode}
              onChange={(e) => setCalMode(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="before">ก่อนโครงการพัฒนา (เพื่อการยังชีพ)</option>
              <option value="after">หลังโครงการพัฒนา (เพื่อการค้า)</option>
            </select>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed font-normal mb-5">
            <b>ลักษณะกระบวนการผลิต:</b> {calCtx[calMode]}
          </div>

          <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 mb-4">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-600"></span>ผักผลไม้ระยะยาว (พริก มะเขือ ฟักทอง)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-600"></span>ผักใบ/อายุสั้น (กะหล่ำ ผักกาด คะน้า)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-600"></span>เครื่องเทศ/สมุนไพร (หอม กระเทียม ข่า)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-purple-600"></span>ยาสูบ</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-cyan-600"></span>ผักบุ้ง/กวางตุ้ง</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-500"></span>พักหน้าดิน</span>
          </div>

          <div className="overflow-x-auto">
            <div className="select-none text-center" style={{ display: 'grid', gridTemplateColumns: '160px repeat(12, minmax(0, 1fr))', gap: '6px', minWidth: '650px' }}>
              {/* Header row */}
              <div className="font-semibold text-slate-500 text-xs text-left self-center py-1">ประเภทพืช</div>
              {MONTHS.map(m => (
                <div key={m} className="font-semibold text-slate-500 text-[10px] self-center py-1 bg-slate-100 rounded">{m}</div>
              ))}
              
              {/* Crop rows */}
              {currentCrops.map((crop, idx) => (
                <React.Fragment key={idx}>
                  <div className="text-left text-xs font-semibold text-slate-700 flex items-center gap-1 py-2">
                    <span className={`w-2 h-2 rounded-full ${crop.color}`}></span>
                    {crop.name}
                  </div>
                  {crop.months.map((on, mIdx) => (
                    <div
                      key={mIdx}
                      className={`h-7 rounded transition-all duration-150 self-center ${on ? `${crop.color} shadow-sm border border-black/5` : 'bg-slate-50 opacity-20'}`}
                      title={`${crop.name} - ${MONTHS[mIdx]}`}
                    ></div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 text-sm">ความสัมพันธ์ปริมาณฝนรายเดือน (มม.) กับขีดความปลอดภัย</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={RAIN_MONTHLY} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip formatter={(value) => [`${value} มม.`, '']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ปริมาณฝน (มม.)" fill="#185FA5" radius={[4, 4, 0, 0]} opacity={0.6} />
                  <ReferenceLine y={90} stroke="#639922" strokeDasharray="4 3" label={{ value: 'เกณฑ์เฝ้าระวัง 90 มม.', position: 'insideTopLeft', fill: '#639922', fontSize: 9 }} />
                  <ReferenceLine y={130} stroke="#EF9F27" strokeDasharray="4 3" label={{ value: 'เกณฑ์เตือนภัย 130 มม.', position: 'insideTopLeft', fill: '#EF9F27', fontSize: 9 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-500" /> นัยสำคัญด้านอุทกภัย
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                {calNote[calMode]}
              </p>
              <div className="my-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2 text-slate-500 font-normal">
                <p>⚠️ <b>ขีดจำกัดความเสี่ยง:</b> ปริมาณฝนตกเกิน 130 มม./เดือน ในช่วงกรกฎาคมถึงกันยายนมีความชุกสูงมาก ทำให้เกิดโอกาสน้ำหลากตลิ่งท่วมแปลงเพาะปลูกฉับพลัน</p>
                <p>🌱 <b>คำแนะนำ:</b> สำหรับการปลูกพืชการค้าในปัจจุบัน ควรเพิ่มระบบประกันภัยและบ่อพักเก็บน้ำในส่วนที่เป็นขอบตะกอนดินริมโขง</p>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800">
              📌 <b>พิกัดเป้าหมาย:</b> ข้อมูลสำรวจจากพื้นที่ตลิ่งเกษตรกรรม 7 ตำบลริมโขง อ.ธาตุพนม นครพนม
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderImpactLinkage = () => {
    const chartData = [
      { name: '2 ปี', 'Return Level': 137.46, 'เกณฑ์เตือนภัย': 130, 'เกณฑ์วิกฤต': 180 },
      { name: '5 ปี', 'Return Level': 180.18, 'เกณฑ์เตือนภัย': 130, 'เกณฑ์วิกฤต': 180 },
      { name: '10 ปี', 'Return Level': 206.73, 'เกณฑ์เตือนภัย': 130, 'เกณฑ์วิกฤต': 180 },
      { name: '50 ปี', 'Return Level': 260.68, 'เกณฑ์เตือนภัย': 130, 'เกณฑ์วิกฤต': 180 },
      { name: '100 ปี', 'Return Level': 281.75, 'เกณฑ์เตือนภัย': 130, 'เกณฑ์วิกฤต': 180 }
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-6 text-sm">ความเชื่อมโยงเชิงระบบ (Hydrometeorological & Socio-Economic Linkages)</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <span className="text-3xl block mb-2">🌧️</span>
              <h5 className="font-bold text-red-700 text-xs mb-1">ฝนสุดขีด (GEV)</h5>
              <p className="text-[10px] text-red-600 font-normal leading-relaxed">
                นครพนม สกษ. 100 ปี = 281.75 มม. กระแสน้ำโขงกัดเซาะตลิ่งพังเสียหายรุนแรง
              </p>
            </div>
            
            <div className="text-center font-bold text-slate-400 hidden md:block text-lg">➔</div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <span className="text-3xl block mb-2">🗺️</span>
              <h5 className="font-bold text-amber-700 text-xs mb-1">การเปลี่ยนแปลงที่ดิน</h5>
              <p className="text-[10px] text-amber-600 font-normal leading-relaxed">
                พื้นที่เกษตรลดลง 934 ไร่ ป่าไม้ลดลง 663 ไร่ พนังกันตลิ่งปูนคอนกรีตแทนที่แปลงดินริมโขง
              </p>
            </div>
            
            <div className="text-center font-bold text-slate-400 hidden md:block text-lg">➔</div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <span className="text-3xl block mb-2">🌱</span>
              <h5 className="font-bold text-blue-700 text-xs mb-1">ผลกระทบต่อเกษตร</h5>
              <p className="text-[10px] text-blue-600 font-normal leading-relaxed">
                จากเกษตรยังชีพเปลี่ยนเป็นพาณิชย์ ใช้ต้นทุนปุ๋ยเคมีและเครื่องจักรสูง ปลูกอัดแน่นตลอดปีในพื้นที่จำกัด
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h5 className="font-bold text-emerald-600 text-sm mb-4">ก่อนโครงการพัฒนา (แบบยังชีพ)</h5>
            <div className="space-y-3 text-xs text-slate-600 font-normal leading-relaxed">
              <p>🌾 <b>ผลผลิต:</b> เน้นปลูกเพื่อบริโภคในครัวเรือน เหลือจากบริโภคจึงนำไปแลกเปลี่ยนหรือขาย</p>
              <p>💰 <b>ต้นทุน:</b> ต้นทุนต่ำ ไม่เน้นใช้สารเคมี ใช้ปุ๋ยธรรมชาติจากมูลสัตว์และเศษใบไม้</p>
              <p>👨‍👩‍👧 <b>แรงงาน:</b> พึ่งพาแรงงานในครอบครัวเป็นหลัก ไม่มีระบบจ้างงานข้ามกลุ่ม</p>
              <p>🌿 <b>เมล็ดพันธุ์:</b> เก็บเมล็ดพันธุ์เองจากรอบปีที่แล้วเพื่อสืบพันธุ์พืชดั้งเดิม</p>
              <p>📅 <b>ฤดูกาล:</b> ปลูกตามน้ำขึ้นน้ำลง พักหน้าดินอย่างชัดเจนในช่วงเมษายน–พฤษภาคม</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h5 className="font-bold text-red-600 text-sm mb-4">หลังโครงการพัฒนา (แบบพาณิชย์)</h5>
            <div className="space-y-3 text-xs text-slate-600 font-normal leading-relaxed">
              <p>🛒 <b>ผลผลิต:</b> ปลูกเพื่อป้อนตลาดเชิงพาณิชย์ขนาดใหญ่ ตอบสนองปริมาณรับซื้อของพ่อค้าคนกลาง</p>
              <p>💸 <b>ต้นทุน:</b> ต้นทุนการผลิตต่อไร่สูงมากจากการซื้อยาฆ่าแมลง ปุ๋ยเคมี และสารกำจัดศัตรูพืช</p>
              <p>🚜 <b>แรงงาน:</b> พึ่งพาเครื่องจักรกล จ้างรถไถดิน จ้างแรงงานนอกพื้นที่ในการเก็บเกี่ยว</p>
              <p>🧪 <b>เมล็ดพันธุ์:</b> ต้องซื้อเมล็ดพันธุ์ลูกผสมเชิงพาณิชย์ทุกรอบปีเพื่อคุณภาพผลผลิตที่เท่ากัน</p>
              <p>📅 <b>ฤดูกาล:</b> ปลูกหมุนเวียนต่อเนื่องกันตลอดปีโดยไม่พักดิน เนื่องจากต้องการทำกำไรสูงสุด</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-4 text-sm">Return Level นครพนม สกษ. เทียบกับขีดความเสียหายพืชริมตลิ่ง</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip formatter={(value) => [`${value} มม.`, '']} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Return Level" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.7} />
                <ReferenceLine y={130} stroke="#EF9F27" strokeDasharray="4 3" label={{ value: 'เกณฑ์เตือนภัย 130 มม.', position: 'insideTopLeft', fill: '#EF9F27', fontSize: 9 }} />
                <ReferenceLine y={180} stroke="#dc2626" strokeDasharray="4 3" label={{ value: 'เกณฑ์วิกฤต 180 มม.', position: 'insideTopLeft', fill: '#dc2626', fontSize: 9 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderAlerts = () => {
    const stationsReturnData = [
      { name: 'สกลนคร สกษ.', '10 ปี': 152.30, '50 ปี': 195.30, '100 ปี': 213.14 },
      { name: 'สกลนคร', '10 ปี': 130.30, '50 ปี': 172.83, '100 ปี': 193.49 },
      { name: 'นครพนม', '10 ปี': 191.54, '50 ปี': 250.15, '100 ปี': 274.59 },
      { name: 'นครพนม สกษ.', '10 ปี': 206.73, '50 ปี': 260.68, '100 ปี': 281.75 },
      { name: 'บึงกาฬ', '10 ปี': 162.20, '50 ปี': 212.80, '100 ปี': 234.00 },
      { name: 'มุกดาหาร', '10 ปี': 147.12, '50 ปี': 186.75, '100 ปี': 203.17 }
    ];

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-4 text-sm flex items-center gap-2">
             <Bell className="w-5 h-5 text-blue-500" /> กำหนดเกณฑ์แจ้งเตือนภัย (Threshold Setup)
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-green-700 block mb-1">🚨 ระดับที่ 1: เฝ้าระวัง (Watch)</span>
                <span className="text-[10px] text-green-600 leading-normal block font-normal">ฝนเริ่มตกหนักสะสม — ส่งสัญญาณแจ้งเตือนล่วงหน้าให้เกษตรกรเตรียมจัดยกของขึ้นสูง</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="number"
                  value={t1}
                  onChange={(e) => setT1(Number(e.target.value))}
                  className="bg-white border border-green-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none w-24"
                />
                <span className="text-[10px] text-green-600 font-bold">มม./วัน</span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-yellow-700 block mb-1">🚨 ระดับที่ 2: เตือนภัย (Warning)</span>
                <span className="text-[10px] text-yellow-600 leading-normal block font-normal">ฝนหนักต่อเนื่อง — เสี่ยงท่วมเฉียบพลันในพื้นที่ลุ่มต่ำ ประสบปัญหาไหลบ่าตลิ่ง</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="number"
                  value={t2}
                  onChange={(e) => setT2(Number(e.target.value))}
                  className="bg-white border border-yellow-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none w-24"
                />
                <span className="text-[10px] text-yellow-600 font-bold">มม./วัน</span>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-red-700 block mb-1">🚨 ระดับที่ 3: วิกฤต (Critical)</span>
                <span className="text-[10px] text-red-600 leading-normal block font-normal">ฝนระดับน้ำท่วมประวัติการณ์ — ดำเนินการอพยพ เร่งระบายน้ำ ปิดระบบควบคุมชลประทาน</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="number"
                  value={t3}
                  onChange={(e) => setT3(Number(e.target.value))}
                  className="bg-white border border-red-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none w-24"
                />
                <span className="text-[10px] text-red-600 font-bold">มม./วัน</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-4 text-sm">กราฟระดับการเกิดซ้ำ (Return Level) เทียบกับเกณฑ์ปรับแต่งส่วนบุคคล</h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stationsReturnData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip formatter={(value) => [`${value} มม.`, '']} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="10 ปี" fill="#1e3a8a" radius={[3, 3, 0, 0]} opacity={0.6} />
                <Bar dataKey="50 ปี" fill="#1d4ed8" radius={[3, 3, 0, 0]} opacity={0.8} />
                <Bar dataKey="100 ปี" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <ReferenceLine y={t1} stroke="#22c55e" strokeDasharray="4 3" label={{ value: `เฝ้าระวัง ${t1} มม.`, position: 'insideTopLeft', fill: '#22c55e', fontSize: 9 }} />
                <ReferenceLine y={t2} stroke="#eab308" strokeDasharray="4 3" label={{ value: `เตือนภัย ${t2} มม.`, position: 'insideTopLeft', fill: '#eab308', fontSize: 9 }} />
                <ReferenceLine y={t3} stroke="#ef4444" strokeDasharray="4 3" label={{ value: `วิกฤต ${t3} มม.`, position: 'insideTopLeft', fill: '#ef4444', fontSize: 9 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-800 mb-4 text-sm">เครื่องมือจำลองฝนตกสุดขีด (Rainfall Simulator)</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">เลือกสถานีเป้าหมาย:</label>
                  <select
                    value={simStation}
                    onChange={(e) => setSimStation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700"
                  >
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">ปริมาณฝนสะสมรายวัน:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={simValue}
                      onChange={(e) => setSimValue(Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none flex-1"
                    />
                    <span className="text-xs text-slate-400 font-bold">มม./วัน</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleRunSimulation}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    ▶ รันการจำลอง
                  </button>
                  <button
                    onClick={handleClearLogs}
                    className="py-2 px-4 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors border border-slate-200"
                  >
                    ล้างประวัติ
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <h4 className="font-bold text-slate-800 mb-3 text-sm">บันทึกเหตุการณ์การจำลอง (Simulation Logs)</h4>
            <div className="flex-1 overflow-y-auto max-h-56 pr-2 space-y-2 text-xs font-normal">
              {simLogs.length === 0 ? (
                <div className="text-slate-400 text-center py-10 font-normal">ยังไม่มีการรันข้อมูลจำลอง</div>
              ) : (
                simLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3 justify-between">
                    <div className="flex items-start gap-2.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${log.cls}`}>
                        {log.lv}
                      </span>
                      <span className="text-slate-700">{log.msg}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 self-center">{log.t}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Existing Alerts Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-4 text-sm">ประวัติการแจ้งเตือนจริงจากระบบ (Historical Alerts)</h4>
          <div className="space-y-3">
            {!alerts || alerts.length === 0 ? (
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-medium">ไม่มีการแจ้งเตือนจริงในฐานข้อมูล</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 hover:bg-blue-50 hover:border-blue-200 transition-all duration-150 cursor-pointer group"
                >
                  <div className={`p-2 rounded-full ${alert.risk_level === 'High' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-xs font-normal">
                    <div className="flex justify-between items-start mb-0.5">
                      <h5 className="font-bold text-slate-800 text-xs">{alert.station_name}</h5>
                      <span className="text-[10px] text-slate-400">{new Date(alert.generated_at).toLocaleString('th-TH')}</span>
                    </div>
                    <p className="text-slate-500 leading-normal">{alert.message}</p>
                    <p className="text-[10px] text-blue-600 mt-1 font-bold group-hover:underline">→ คลิกเพื่อข้ามไปดูกราฟวิเคราะห์ของสถานีนี้</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 self-center group-hover:text-blue-500 transition-colors" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

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
      case 'overview': return renderOverviewComparison();
      case 'stations': return renderStations();
      case 'map': return renderMap();
      case 'landuse': return renderLandUse();
      case 'calendar': return renderCropCalendar();
      case 'advisory': return renderAdvisory();
      case 'impact': return renderImpactLinkage();
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