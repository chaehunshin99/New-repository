import React, { useState, useEffect } from 'react';
import './App.css';

// 5가지 자세 정의
const POSTURE_TYPES = {
  good: { name: '바른 자세', color: '#10b981' },
  left: { name: '좌측 쏠림 (다리 꼬기)', color: '#f59e0b' },
  right: { name: '우측 쏠림 (다리 꼬기)', color: '#6366f1' },
  forward: { name: '거북목 / 상체 숙임', color: '#ef4444' },
  slouch: { name: '뒤로 눕기 (슬라우칭)', color: '#8b5cf6' },
};

function App() {
  const [todayDate, setTodayDate] = useState('');
  const [currentPosture, setCurrentPosture] = useState('good');
  
  // 모달 상태 ('daily': 일별 기록, 'monthly': 월별 평균, null: 닫힘)
  const [activeModal, setActiveModal] = useState(null);

  // 라즈베리파이 IP 상태 관리 (브라우저에 자동 저장)
  const [piIp, setPiIp] = useState(() => localStorage.getItem('chair_pi_ip') || '');
  const [inputIp, setInputIp] = useState('');
  const [isIpModalOpen, setIsIpModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // 1. 일별 지난 기록 (시뮬레이션 데이터)
  const [historyScores] = useState([
    { date: '2026년 9월 7일', score: 88, sitTime: '5시간 40분' },
    { date: '2026년 9월 6일', score: 74, sitTime: '6시간 10분' },
    { date: '2026년 9월 5일', score: 92, sitTime: '4시간 50분' },
    { date: '2026년 9월 4일', score: 68, sitTime: '7시간 05분' },
    { date: '2026년 9월 3일', score: 85, sitTime: '5시간 15분' },
  ]);

  // 2. 월별 평균 점수 및 위험도 (시뮬레이션 데이터)
  const [monthlyScores] = useState([
    { month: '2026년 8월', score: 86, avgSitTime: '5시간 30분' },
    { month: '2026년 7월', score: 78, avgSitTime: '6시간 15분' },
    { month: '2026년 6월', score: 82, avgSitTime: '5시간 50분' },
    { month: '2026년 5월', score: 64, avgSitTime: '7시간 10분' },
    { month: '2026년 4월', score: 72, avgSitTime: '6시간 05분' },
    { month: '2026년 3월', score: 91, avgSitTime: '4시간 40분' },
  ]);

  // 오늘 누적된 각 자세별 시간 (초 단위)
  const [postureSeconds, setPostureSeconds] = useState({
    good: 180,
    left: 20,
    right: 15,
    forward: 25,
    slouch: 10,
  });

  // 오늘 날짜 갱신
  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const formatted = now.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
      setTodayDate(formatted);
    };

    updateDate();
    const dateTimer = setInterval(updateDate, 60000);
    return () => clearInterval(dateTimer);
  }, []);

  // IP 저장 핸들러
  const handleSaveIp = (e) => {
    e.preventDefault();
    const cleanIp = inputIp.trim();
    localStorage.setItem('chair_pi_ip', cleanIp);
    setPiIp(cleanIp);
    setIsIpModalOpen(false);
  };

  // 1초 실시간 센서 데이터 수집 (IP 연동 or 가상 시뮬레이션)
  useEffect(() => {
    const keys = Object.keys(POSTURE_TYPES);

    const dataTimer = setInterval(async () => {
      // 1) IP가 설정된 경우: 실제 라즈베리파이 API 통신 시도
      if (piIp) {
        try {
          const response = await fetch(`http://${piIp}:5000/api/live-status`, { signal: AbortSignal.timeout(800) });
          if (response.ok) {
            const data = await response.json();
            setCurrentPosture(data.currentPosture);
            setPostureSeconds(data.postureSeconds);
            setIsConnected(true);
            return;
          }
        } catch {
          setIsConnected(false);
          // 통신 실패 시 아래 시뮬레이션 로직으로 자동 전환
        }
      }

      // 2) IP가 없거나 라즈베리파이 통신 전일 때: 자체 시뮬레이션 구동
      const isGood = Math.random() < 0.7;
      const detected = isGood
        ? 'good'
        : keys[Math.floor(Math.random() * keys.length)];

      setCurrentPosture(detected);

      setPostureSeconds((prev) => ({
        ...prev,
        [detected]: prev[detected] + 1,
      }));
    }, 1000);

    return () => clearInterval(dataTimer);
  }, [piIp]);

  const totalSeconds = Object.values(postureSeconds).reduce((a, b) => a + b, 0);

  const postureStats = Object.keys(POSTURE_TYPES).map((key) => {
    const sec = postureSeconds[key];
    const percentage = totalSeconds > 0 ? (sec / totalSeconds) * 100 : 0;
    return {
      key,
      ...POSTURE_TYPES[key],
      seconds: sec,
      percentage: percentage,
    };
  });

  const healthScore = totalSeconds > 0
    ? Math.round((postureSeconds.good / totalSeconds) * 100)
    : 100;

  // 도넛 차트 계산
  let cumulativePercent = 0;
  const gradientParts = postureStats.map((stat) => {
    const start = cumulativePercent;
    cumulativePercent += stat.percentage;
    return `${stat.color} ${start}% ${cumulativePercent}%`;
  });
  const donutChartStyle = {
    background: `conic-gradient(${gradientParts.join(', ')})`,
  };

  const formatTime = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  const getRiskInfo = (score) => {
    if (score >= 80) return { label: '안전', class: 'risk-safe' };
    if (score >= 70) return { label: '주의', class: 'risk-warning' };
    return { label: '위험', class: 'risk-danger' };
  };

  return (
    <div className="dashboard">
      {/* 1. 상단 헤더 */}
      <header className="header-card">
        <div className="header-left">
          <div className="status-indicators">
            <span className="live-dot">● 모니터링 활성</span>
            {piIp && (
              <span className={`connection-badge ${isConnected ? 'online' : 'offline'}`}>
                {isConnected ? `연결됨 (${piIp})` : `연결 대기중 (${piIp})`}
              </span>
            )}
          </div>
          <h2 className="date-title">{todayDate}</h2>
          <p className="sub-info">오늘 총 착석 시간: <strong>{formatTime(totalSeconds)}</strong></p>
        </div>

        <div className="header-right">
          <div className="score-badge">
            <div className="score-label">실시간 자세 점수</div>
            <div className="score-number">{healthScore}<span className="score-unit">점</span></div>
          </div>
          
          <div className="button-group">
            <button className="ip-btn" onClick={() => { setInputIp(piIp); setIsIpModalOpen(true); }}>
              ⚙️ {piIp ? 'IP 변경' : '의자 IP 연결'}
            </button>
            <button className="history-btn" onClick={() => setActiveModal('daily')}>
              📊 지난 자세점수 보기
            </button>
            <button className="monthly-btn" onClick={() => setActiveModal('monthly')}>
              📅 월별 평균 점수
            </button>
          </div>
        </div>
      </header>

      {/* 2. 현재 상태 안내 띠 */}
      <div className="current-status-banner">
        <span>현재 감지 상태: </span>
        <strong style={{ color: POSTURE_TYPES[currentPosture].color }}>
          {POSTURE_TYPES[currentPosture].name}
        </strong>
      </div>

      {/* 3. 본문: 원형 차트 & 상세 통계 */}
      <div className="main-content">
        <div className="chart-section">
          <h3>오늘의 자세 비율</h3>
          <div className="donut-container">
            <div className="donut-chart" style={donutChartStyle}>
              <div className="donut-hole">
                <span className="donut-center-label">바른 자세</span>
                <span className="donut-center-value">
                  {postureStats.find(p => p.key === 'good')?.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="details-section">
          <h3>자세별 상세 통계 (자정 초기화)</h3>
          <div className="stat-list">
            {postureStats.map((item) => (
              <div key={item.key} className="stat-item">
                <div className="stat-header">
                  <div className="stat-name-wrap">
                    <span className="color-dot" style={{ backgroundColor: item.color }}></span>
                    <span className="stat-name">{item.name}</span>
                  </div>
                  <span className="stat-ratio">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  ></div>
                </div>
                <div className="stat-time">{formatTime(item.seconds)} 유지</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 라즈베리파이 IP 설정 모달 */}
      {isIpModalOpen && (
        <div className="modal-overlay" onClick={() => setIsIpModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>개인 스마트 의자 IP 설정</h3>
              <button className="close-btn" onClick={() => setIsIpModalOpen(false)}>✕</button>
            </div>
            <p className="modal-subtext">본인 의자 라즈베리파이의 Wi-Fi IP 주소를 입력하세요.</p>
            
            <form onSubmit={handleSaveIp}>
              <input
                type="text"
                className="ip-input"
                placeholder="예: 192.168.0.28"
                value={inputIp}
                onChange={(e) => setInputIp(e.target.value)}
                autoFocus
              />
              <p className="ip-help-text">
                * 동일한 Wi-Fi 공유기에 연결되어 있어야 데이터를 불러올 수 있습니다.
              </p>
              <div className="modal-actions">
                <button type="submit" className="modal-confirm-btn">
                  연결 주소 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 일별 지난 자세점수 모달 */}
      {activeModal === 'daily' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>과거 자세점수 기록</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <p className="modal-subtext">하루 착석 종료 시점의 최종 점수 (최근 1년 치 보관)</p>

            <div className="history-list">
              {historyScores.map((record, index) => {
                const risk = getRiskInfo(record.score);
                return (
                  <div key={index} className="history-item">
                    <div className="history-info">
                      <span className="history-text">
                        <strong>{record.date}</strong> 자세점수 <span className="highlight-score">{record.score}점</span>
                      </span>
                      <span className="history-sit-time">(착석 시간: {record.sitTime})</span>
                    </div>
                    <span className={`risk-tag ${risk.class}`}>{risk.label}</span>
                  </div>
                );
              })}
            </div>

            <button className="modal-confirm-btn" onClick={() => setActiveModal(null)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 6. 월별 평균 점수 모달 */}
      {activeModal === 'monthly' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>월별 평균 점수 및 위험도</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <p className="modal-subtext">한 달간 누적된 일일 점수의 평균 및 척추 불균형 위험도</p>

            <div className="history-list">
              {monthlyScores.map((item, index) => {
                const risk = getRiskInfo(item.score);
                return (
                  <div key={index} className="history-item">
                    <div className="history-info">
                      <span className="history-text">
                        <strong>{item.month}</strong> 자세점수 <span className="highlight-score">{item.score}점</span>
                      </span>
                      <span className="history-sit-time">(일평균 착석: {item.avgSitTime})</span>
                    </div>
                    <div className="monthly-risk-wrap">
                      <span className="risk-text-label">위험도:</span>
                      <span className={`risk-tag ${risk.class}`}>{risk.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="modal-confirm-btn" onClick={() => setActiveModal(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;