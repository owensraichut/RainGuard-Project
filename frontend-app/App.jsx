import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';
import { 
  CloudRain, Map, Database, Leaf, Bell, Download, Info, 
  Calendar, MapPin, Activity, AlertTriangle, CheckCircle, Home, Loader2, ChevronRight
} from 'lucide-react';

const returnPeriods = [2, 5, 10, 20, 50, 100];

const MOCK_STATIONS = [
  { id: "48363", name: "บึงกาฬ (48363)" },
  { id: "48357", name: "นครพนม (48357)" },
  { id: "48358", name: "นครพนม สกษ. (48358)" },
  { id: "48356", name: "สกลนคร (48356)" },
  { id: "48355", name: "สกลนคร สกษ. (48355)" },
  { id: "48383", name: "มุกดาหาร (48383)" },
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

  // เมนูระบบ แยกกันชัดเจน
  const menuItems = [
    { id: 'home', label: 'หน้าหลัก', icon: Home },
    { id: 'stations', label: 'ข้อมูลสถานีและตาราง GEV', icon: Database },
    { id: 'map', label: 'แผนที่ความเสี่ยง', icon: Map },
    { id: 'advisory', label: 'คำแนะนำการเกษตร', icon: Leaf },
    { id: 'alerts', label: 'การแจ้งเตือน', icon: Bell },
  ];

  const pageTitles = {
    home: 'สรุปภาพรวมความเสี่ยง',
    stations: 'ข้อมูลสถานีและตารางสถิติ',
    map: 'แผนที่ความเสี่ยงอุทกวิทยา',
    advisory: 'คำแนะนำการเพาะปลูก',
    alerts: 'การแจ้งเตือนอุทกภัย',
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stRes, alRes] = await Promise.all([
          fetch('http://localhost:8000/api/stations'),
          fetch('http://localhost:8000/api/alerts')
        ]);
        if (stRes.ok) {
          const stData = await stRes.json();
          setStations(stData.stations || MOCK_STATIONS);
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
    fetch(`http://localhost:8000/api/prediction/${selectedStation}`)
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
    window.scrollTo({ top: 0, behavior: 'smooth' }); // เลื่อนขึ้นบนสุดเมื่อเปลี่ยนหน้า
  };

  if (isLoading || !predictionData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">กำลังประมวลผลข้อมูล...</h2>
        <p className="text-slate-500 text-sm mt-2">โปรดรอสักครู่ ระบบกำลังดึงข้อมูลอัจฉริยะ</p>
      </div>
    );
  }

  // ใช้ Optional Chaining (?.) เพื่อป้องกัน Error จอดำหากข้อมูลมาไม่ครบ
  const forecastedValue = predictionData?.return_levels?.[`${selectedPeriod}_year`] ?? 0;
  const meanRainfall = predictionData?.basic_stats?.mean ?? 1;
  const riskInfo = getRiskLevel(forecastedValue);
  const chartData = returnPeriods.map(p => ({ 
    name: `${p} ปี`, 
    rainfall: predictionData?.return_levels?.[`${p}_year`] ?? 0 
  }));

  // ==========================================
  // PAGE RENDERERS (ระบบแยกหน้าชัดเจน)
  // ==========================================

  const renderHome = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-blue-600 text-white rounded-2xl p-6 shadow-lg shadow-blue-200">
          <p className="text-blue-100 text-sm mb-1">ฝนคาดการณ์ ({selectedPeriod} ปี)</p>
          <h3 className="text-4xl font-bold">{forecastedValue.toFixed(2)} <span className="text-lg font-normal">มม.</span></h3>
          <p className="mt-4 text-xs text-blue-200 flex items-center gap-1"><Activity className="w-3 h-3"/> {apiStatus === 'online' ? 'ข้อมูลจริงจาก TMD' : 'โหมดจำลอง (Offline)'}</p>
        </div>
        <div className={`${riskInfo.bgLight} ${riskInfo.border} border rounded-2xl p-6 shadow-sm`}>
          <p className={`${riskInfo.text} text-sm mb-1`}>สถานะความเสี่ยงปัจจุบัน</p>
          <h3 className={`text-4xl font-bold ${riskInfo.text}`}>{riskInfo.level}</h3>
          <div className={`mt-4 w-full h-2 bg-slate-200 rounded-full overflow-hidden`}>
              <div className={`h-full ${riskInfo.color}`} style={{width: `${Math.min((forecastedValue/300)*100, 100)}%`}}></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <p className="text-slate-500 text-sm mb-1 text-center">แนวโน้มเปรียบเทียบค่าเฉลี่ย</p>
          <div className="flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-emerald-600">
                  ↗ +{(((forecastedValue - meanRainfall) / meanRainfall) * 100).toFixed(1)}%
              </span>
              <p className="text-[10px] text-slate-400 mt-2">จากสถิติฝนรายเดือนย้อนหลัง</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500"/> Return Level Plot</h4>
          <div className="h-64">
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Leaf className="w-5 h-5 text-green-500"/> คำแนะนำการเกษตรเบื้องต้น</h4>
          <div className="flex-1 space-y-4">
              <div className={`p-4 rounded-xl border ${riskInfo.bgLight} ${riskInfo.border}`}>
                  <p className={`text-sm font-bold ${riskInfo.text} mb-2`}>การจัดการความเสี่ยง:</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{predictionData?.risk_assessment?.description || "ข้อมูลไม่พร้อมใช้งาน"}</p>
              </div>
          </div>
          <button onClick={() => changePage('advisory')} className="mt-4 w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">อ่านคำแนะนำฉบับเต็ม</button>
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

  const renderMap = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden h-[600px] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Map className="w-6 h-6 text-blue-500"/> แผนที่ความเสี่ยงน้ำท่วม (Risk Map)</h3>
          <span className="text-sm text-slate-500">พื้นที่อิทธิพลของสถานี {predictionData?.station_name}</span>
        </div>
        <div className="w-full flex-1 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center relative overflow-hidden">
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
           <Map className="w-24 h-24 text-slate-300 absolute" />
           <div className="z-10 text-center bg-white/90 p-6 rounded-2xl backdrop-blur-sm border border-slate-200 shadow-sm max-w-sm">
              <MapPin className="w-10 h-10 text-blue-500 mx-auto mb-2" />
              <p className="text-slate-800 font-bold text-lg mb-2">พื้นที่: {predictionData?.station_name}</p>
              <p className="text-slate-500 text-sm mb-4">ส่วนนี้เตรียมไว้สำหรับเชื่อมต่อแผนที่ QGIS (GeoJSON) เพื่อแสดงจุดเสี่ยงแบบ Interactive ในอนาคต</p>
           </div>
        </div>
      </div>
    </div>
  );

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

  // สวิตช์สำหรับเลือก Render หน้าเว็บให้ถูกต้อง 100%
  const renderContent = () => {
    switch (activePage) {
      case 'home': return renderHome();
      case 'stations': return renderStations();
      case 'map': return renderMap();
      case 'advisory': return renderAdvisory();
      case 'alerts': return renderAlerts();
      default: return renderHome();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <div className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <CloudRain className="w-8 h-8 text-blue-400" />
          <h1 className="font-black text-xl tracking-tight">RainGuard<span className="text-blue-400">AI</span></h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
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

      <div className="flex-1 ml-64 min-h-screen flex flex-col">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-10 px-8">
          <div className="flex items-center gap-3">
             <div className="bg-slate-100 p-2 rounded-lg">
                <MapPin className="w-5 h-5 text-slate-600" />
             </div>
             <div>
                <select 
                    value={selectedStation} 
                    onChange={e => setSelectedStation(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p className="text-[10px] text-slate-400">สถานีที่กำลังแสดงผล</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className={`flex items-center gap-2 py-1.5 px-4 rounded-full border text-xs font-bold transition-all ${apiStatus === 'online' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                <span className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                {apiStatus === 'online' ? 'REAL-TIME CONNECTION' : 'SYSTEM OFFLINE'}
             </div>
             <button className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 text-slate-600 transition-colors">
                <Bell className="w-5 h-5" />
             </button>
          </div>
        </header>

        <main className="p-8">
            <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900 mb-1 tracking-tight">
                    {pageTitles[activePage] || 'RainGuard-AI'}
                </h2>
                <p className="text-slate-500 text-sm">อ้างอิงตามแบบจำลอง GEV อัปเดตล่าสุด: {new Date().toLocaleDateString('th-TH')}</p>
            </div>

            {/* แสดงผลหน้าเว็บจาก Switch-Case ด้านบน */}
            {renderContent()}
            
        </main>
      </div>
    </div>
  );
}