import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, 
  Search, 
  User, 
  TrendingUp, 
  SlidersHorizontal, 
  MapPin, 
  School, 
  BookOpen, 
  AlertCircle, 
  Info,
  Terminal,
  RefreshCw,
  X,
  FileDown
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine, 
  Cell 
} from 'recharts';
import { Student, College } from './types';

export default function App() {
  // 1. Core State
  const [grade, setGrade] = useState<'1' | '2'>('1');
  const [students, setStudents] = useState<Student[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');

  // Main filters
  const [selectedRegion, setSelectedRegion] = useState<string>('전체');
  const [selectedUniv, setSelectedUniv] = useState<string>('전체');
  const [searchDept, setSearchDept] = useState<string>('');

  // 2. Fetch data from Google Sheet backend based on grade selection
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/load-data?grade=${grade}`);
        if (!response.ok) {
          throw new Error(`데이터 로드 실패: ${response.statusText}`);
        }
        const data = await response.json();
        setStudents(data.students || []);
        setColleges(data.colleges || []);
        
        // Auto-select first class and name
        if (data.students && data.students.length > 0) {
          // Sort classes numerically
          const uniqueClasses = (Array.from(new Set(data.students.map((s: Student) => s.반))) as string[])
            .sort((a, b) => parseInt(a) - parseInt(b));
          
          const firstClass = uniqueClasses[0] || '';
          setSelectedClass(firstClass);
          
          const classStudents = data.students.filter((s: Student) => s.반 === firstClass);
          if (classStudents.length > 0) {
            setSelectedStudentName(classStudents[0].이름);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || '데이터를 가져오는데 문제가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [grade]);

  // 3. Derived values from students database
  const uniqueClasses = useMemo(() => {
    return (Array.from(new Set(students.map(s => s.반))) as string[])
      .sort((a, b) => parseInt(a) - parseInt(b));
  }, [students]);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => s.반 === selectedClass);
  }, [students, selectedClass]);

  // When class changes, select the first student in that class
  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cls = e.target.value;
    setSelectedClass(cls);
    const filtered = students.filter(s => s.반 === cls);
    if (filtered.length > 0) {
      setSelectedStudentName(filtered[0].이름);
    }
  };

  // Currently selected student object
  const selectedStudent = useMemo(() => {
    return students.find(s => s.반 === selectedClass && s.이름 === selectedStudentName);
  }, [students, selectedClass, selectedStudentName]);

  // Core student stats
  const studentScore = useMemo(() => {
    if (!selectedStudent) return 0;
    return parseFloat(selectedStudent.원점수) || 0;
  }, [selectedStudent]);

  const gradeAverage = useMemo(() => {
    if (students.length === 0) return 0;
    const sum = students.reduce((acc, curr) => acc + (parseFloat(curr.원점수) || 0), 0);
    return sum / students.length;
  }, [students]);

  const studentRank = useMemo(() => {
    if (!selectedStudent || students.length === 0) return { rank: 1, total: 1 };
    const score = parseFloat(selectedStudent.원점수) || 0;
    const higherCount = students.filter(s => (parseFloat(s.원점수) || 0) > score).length;
    return {
      rank: higherCount + 1,
      total: students.length
    };
  }, [selectedStudent, students]);

  // 4. College dropdown selection logic
  const uniqueRegions = useMemo(() => {
    const regions = colleges.map(c => c.지역).filter(Boolean);
    return ['전체', ...Array.from(new Set(regions)).sort()];
  }, [colleges]);

  const uniqueUniversities = useMemo(() => {
    let list = colleges;
    if (selectedRegion !== '전체') {
      list = list.filter(c => c.지역 === selectedRegion);
    }
    const univs = list.map(c => c.대학).filter(Boolean);
    return ['전체', ...Array.from(new Set(univs)).sort()];
  }, [colleges, selectedRegion]);

  // Adjust university filter if region selection invalidates it
  useEffect(() => {
    setSelectedUniv('전체');
  }, [selectedRegion]);

  // Filtered colleges list
  const filteredColleges = useMemo(() => {
    let result = colleges.map(c => ({
      ...c,
      cutScore: parseFloat(c.원점수) || 0,
    })).filter(c => !isNaN(c.cutScore));

    if (selectedRegion !== '전체') {
      result = result.filter(c => c.지역 === selectedRegion);
    }
    if (selectedUniv !== '전체') {
      result = result.filter(c => c.대학 === selectedUniv);
    }
    if (searchDept.trim() !== '') {
      const query = searchDept.toLowerCase();
      result = result.filter(c => c.모집단위.toLowerCase().includes(query));
    }

    // Sort by university then department
    return result.sort((a, b) => a.대학.localeCompare(b.대학) || a.모집단위.localeCompare(b.모집단위));
  }, [colleges, selectedRegion, selectedUniv, searchDept]);

  // Distribution status counts
  const statusSummary = useMemo(() => {
    let safe = 0;
    let competitive = 0;
    let challenging = 0;

    filteredColleges.forEach(c => {
      const diff = studentScore - c.cutScore;
      if (diff >= 0) safe++;
      else if (diff >= -10) competitive++;
      else challenging++;
    });

    return { safe, competitive, challenging, total: filteredColleges.length };
  }, [filteredColleges, studentScore]);

  // Recharts Chart Data
  const chartData = useMemo(() => {
    return filteredColleges.map((c, index) => {
      const diff = studentScore - c.cutScore;
      let status = '상향/보완';
      if (diff >= 0) status = '안정 합격';
      else if (diff >= -10) status = '소신 지원';

      return {
        id: index,
        name: `${c.대학} ${c.모집단위}`,
        dept: c.모집단위,
        univ: c.대학,
        region: c.지역,
        score: c.cutScore,
        diff: diff,
        status: status
      };
    });
  }, [filteredColleges, studentScore]);

  // Custom tooltips for Chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isSafe = data.diff >= 0;
      const diffColor = isSafe ? 'text-emerald-600' : data.diff >= -10 ? 'text-amber-500' : 'text-rose-600';
      
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-lg max-w-sm font-sans z-50">
          <p className="text-xs font-semibold text-blue-700 tracking-wider mb-0.5">{data.region} 지역 • {data.univ}</p>
          <h4 className="text-base font-bold text-slate-800 mb-2">{data.dept}</h4>
          <div className="space-y-1 text-sm border-t border-slate-100 pt-2">
            <div className="flex justify-between">
              <span className="text-slate-500">대학 커트라인:</span>
              <span className="font-semibold text-slate-800">{data.score}점</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">내 원점수:</span>
              <span className="font-semibold text-slate-800">{studentScore.toFixed(1)}점</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-100">
              <span className="text-slate-500">판정 차이:</span>
              <span className={`font-bold ${diffColor}`}>
                {data.diff >= 0 ? `+${data.diff.toFixed(1)} (안정)` : `${data.diff.toFixed(1)} (${data.diff >= -10 ? '소신' : '보완'})`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleResetFilters = () => {
    setSelectedRegion('전체');
    setSelectedUniv('전체');
    setSearchDept('');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col p-6 space-y-8 border-r border-slate-800 h-full shrink-0">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">[정시] 합격 예측 시스템</h1>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Grade Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">학년 선택</label>
            <select 
              value={grade}
              onChange={(e) => setGrade(e.target.value as '1' | '2')}
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">1학년</option>
              <option value="2">2학년</option>
            </select>
          </div>
          
          {/* Class Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">반 선택</label>
            <select 
              value={selectedClass}
              onChange={handleClassChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}반</option>
              ))}
            </select>
          </div>

          {/* Student Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">학생 이름</label>
            <select 
              value={selectedStudentName}
              onChange={(e) => setSelectedStudentName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {classStudents.map(s => (
                <option key={s.이름} value={s.이름}>{s.이름}</option>
              ))}
            </select>
          </div>


        </div>

        {/* Python Streamlit download info block */}
        <div className="mt-auto space-y-3 pt-4 border-t border-slate-800">
          <a 
            href="/streamlit_app.py" 
            download 
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition"
          >
            <FileDown className="h-3.5 w-3.5 text-blue-400" />
            파이썬 코드 다운로드 (.py)
          </a>
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <p className="text-[10px] text-slate-500 leading-relaxed italic text-center">
              "데이터 기반 합격 분석 시스템 v2.4.1"
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Navigation / Filters */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex space-x-6 items-center flex-1">
            {/* Region select filter */}
            <div className="flex-1 max-w-[180px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">지역</label>
              <select 
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full text-sm border-none bg-slate-100 rounded p-1.5 focus:ring-0 text-slate-700 font-medium cursor-pointer"
              >
                {uniqueRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            
            {/* College select filter */}
            <div className="flex-1 max-w-[220px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">대학</label>
              <select 
                value={selectedUniv}
                onChange={(e) => setSelectedUniv(e.target.value)}
                className="w-full text-sm border-none bg-slate-100 rounded p-1.5 focus:ring-0 text-slate-700 font-medium cursor-pointer"
              >
                {uniqueUniversities.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Dept search filter */}
            <div className="flex-1 max-w-sm">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">모집단위 검색</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchDept}
                  onChange={(e) => setSearchDept(e.target.value)}
                  placeholder="컴퓨터공학, 경영..." 
                  className="w-full text-sm border-none bg-slate-100 rounded p-1.5 pr-8 focus:ring-0 text-slate-700 placeholder:text-slate-400"
                />
                {searchDept && (
                  <button 
                    onClick={() => setSearchDept('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Student raw score display */}
          {selectedStudent && (
            <div className="ml-8 text-right shrink-0">
              <span className="text-xs text-slate-400 block">{selectedStudent.이름} 학생의 원점수</span>
              <span className="text-2xl font-bold text-blue-600">
                {studentScore.toFixed(1)} <span className="text-sm font-normal text-slate-500">점</span>
              </span>
            </div>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 p-8 space-y-6 overflow-y-auto bg-slate-50">
          
          {/* Chart Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[480px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <h2 className="font-bold text-slate-700 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path>
                </svg>
                대학별 모집단위 합격선 분석
              </h2>
              <div className="flex flex-wrap items-center gap-3.5 text-xs font-medium text-slate-500">
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-1.5"></span> 안정 합격</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-amber-500 mr-1.5"></span> 소신 지원</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-rose-500 mr-1.5"></span> 상향 지원</div>
                <div className="flex items-center"><span className="w-8 h-0.5 bg-blue-600 mr-1.5"></span> {selectedStudentName} 학생 점수</div>
              </div>
            </div>

            {/* Recharts Scatter distribution */}
            <div className="flex-1 min-h-[340px] w-full bg-slate-50/30 rounded-xl p-3 border border-slate-100">
              {isLoading ? (
                <div className="h-full flex items-center justify-center py-24">
                  <RefreshCw className="h-10 w-10 text-blue-600 animate-spin" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 py-20">
                  <AlertCircle className="h-12 w-12 text-slate-300" />
                  <p className="text-slate-600 font-semibold text-sm">필터 조건에 매칭되는 대학 학과 데이터가 없습니다.</p>
                  <p className="text-slate-400 text-xs">전지역 혹은 다른 대학 학과명 검색을 활용해 보세요.</p>
                </div>
              ) : (
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis 
                        type="category" 
                        dataKey="name" 
                        name="모집단위" 
                        tick={{ fontSize: 9, fill: '#64748B' }}
                        angle={-25} 
                        textAnchor="end"
                        interval={0}
                        height={60}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="score" 
                        name="합격 커트라인" 
                        domain={['dataMin - 10', 'dataMax + 10']} 
                        tick={{ fontSize: 10, fill: '#64748B' }}
                      />
                      <ZAxis type="number" range={[110, 110]} />
                      <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#94A3B8' }} />
                      
                      {/* Student Score threshold line */}
                      <ReferenceLine 
                        y={studentScore} 
                        stroke="#2563EB" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        label={{
                          value: `${selectedStudentName} 학생 점수 (${studentScore.toFixed(1)}점)`,
                          position: 'top',
                          fill: '#1E3A8A',
                          fontSize: 11,
                          fontWeight: 700
                        }}
                      />

                      <Scatter name="대학 입학 커트라인" data={chartData}>
                        {chartData.map((entry, index) => {
                          const diff = studentScore - entry.score;
                          const color = diff >= 0 ? '#10B981' : diff >= -10 ? '#F59E0B' : '#EF4444';
                          return <Cell key={`cell-${index}`} fill={color} stroke="#1E293B" strokeWidth={0.5} />;
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Department detail current status bar list */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-700 text-sm mb-4 flex items-center justify-between">
                <span>모집단위 지원 현황 (상위 6개 학과)</span>
              </h3>
              
              {filteredColleges.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  상단 필터를 활용하여 대학 데이터를 필터링해 주세요.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredColleges.slice(0, 6).map((c, i) => {
                    const diff = studentScore - c.cutScore;
                    let statusText = `안정 (+${diff.toFixed(1)})`;
                    let colorClass = 'text-green-500';
                    let barColorClass = 'bg-green-500';
                    let percent = Math.min(100, Math.max(15, 50 + diff * 4));

                    if (diff < -10) {
                      statusText = `보완 필요 (${diff.toFixed(1)})`;
                      colorClass = 'text-red-500';
                      barColorClass = 'bg-red-500';
                    } else if (diff < 0) {
                      statusText = `소신 지원 (${diff.toFixed(1)})`;
                      colorClass = 'text-blue-500';
                      barColorClass = 'bg-blue-500';
                    }

                    return (
                      <div key={i} className="space-y-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-700 font-semibold truncate max-w-[180px]" title={`${c.대학} ${c.모집단위}`}>{c.대학} {c.모집단위}</span>
                          <span className={`font-bold ${colorClass}`}>{statusText}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className={`${barColorClass} h-full rounded-full transition-all duration-300`} style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>매칭 데이터 수: <strong className="text-slate-700 font-bold">{filteredColleges.length}</strong>개</span>
              <span className="italic text-[10px]">G-Sheets 실시간 연동</span>
            </div>
          </div>

          {/* Full Matching Details Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-blue-500" /> 세부 대학 합격 커트라인 매칭 데이터 리스트
              </span>
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-500 hover:text-blue-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition font-medium cursor-pointer"
              >
                필터 해제
              </button>
            </div>
            <div className="overflow-x-auto max-h-[250px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-6 py-3">지역</th>
                    <th className="px-6 py-3">대학</th>
                    <th className="px-6 py-3">모집단위 (학과)</th>
                    <th className="px-6 py-3 text-center">합격 컷 (원점수)</th>
                    <th className="px-6 py-3 text-right">학생 점수차 및 판정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredColleges.map((c, i) => {
                    const diff = studentScore - c.cutScore;
                    let badge = (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-2.5 py-0.5 rounded-full font-semibold">
                        🟢 안정 합격 (+{diff.toFixed(1)})
                      </span>
                    );
                    if (diff < -10) {
                      badge = (
                        <span className="bg-rose-50 text-rose-800 border border-rose-100 px-2.5 py-0.5 rounded-full font-semibold">
                          🔴 상향 보완 ({diff.toFixed(1)})
                        </span>
                      );
                    } else if (diff < 0) {
                      badge = (
                        <span className="bg-amber-50 text-amber-800 border border-amber-100 px-2.5 py-0.5 rounded-full font-semibold">
                          🟡 소신 경쟁 ({diff.toFixed(1)})
                        </span>
                      );
                    }

                    return (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-slate-500">{c.지역}</td>
                        <td className="px-6 py-3 font-semibold text-slate-800">{c.대학}</td>
                        <td className="px-6 py-3 font-medium">{c.모집단위}</td>
                        <td className="px-6 py-3 text-center font-bold text-slate-800">{c.cutScore}점</td>
                        <td className="px-6 py-3 text-right">{badge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
