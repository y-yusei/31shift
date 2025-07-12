document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ script.jsが読み込まれ、実行が開始されました。");

    // --- グローバル変数と設定 ---
    const API_BASE_URL = 'https://my-shift-backend.tamago-2483.workers.dev';
    let dailyShiftChartInstance = null;
    let appState = { users: [], shifts: {} };
    let currentUser = null;

    // --- DOM要素の取得 ---
    const mainViews = {
        calendar: document.getElementById('calendarView'),
        dailyChart: document.getElementById('dailyChartView'),
        bulkShift: document.getElementById('bulkShiftView'),
    };
    const navButtons = {
        calendar: document.getElementById('showCalendarViewBtn'),
        dailyChart: document.getElementById('showDailyChartViewBtn'),
        bulkShift: document.getElementById('showBulkShiftViewBtn')
    };
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarMonthYear = document.getElementById('calendarMonthYear');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const currentChartDateInput = document.getElementById('currentChartDate');
    const prevDayChartBtn = document.getElementById('prevDayChartBtn');
    const nextDayChartBtn = document.getElementById('nextDayChartBtn');
    const dailyShiftChartCanvas = document.getElementById('dailyShiftChart');
    
    // --- 状態管理用変数 ---
    const today = new Date();
    let chartDisplayDate = new Date(today);
    let calendarDisplayDate = new Date(today.getFullYear(), today.getMonth(), 1);

    // --- ユーティリティ関数 ---
    function formatDate(date) { return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`; }
    function formatTime(date) { return `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`; }
    function isToday(date) { const today = new Date(); return date.toDateString() === today.toDateString(); }
    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr || !timeStr.includes(':')) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    // --- データ取得 ---
    async function fetchDataForMonth(date) {
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const url = `${API_BASE_URL}/api/data?month=${year}-${month}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('APIからのデータ取得に失敗しました。');
            
            const data = await response.json();
            appState.users = data.users || [];
            appState.shifts = { ...appState.shifts, ...(data.shifts || {}) };
            
            if (!currentUser && appState.users.length > 0) {
                // ユーザー初期化（今回は簡略化）
                currentUser = appState.users[0];
            }
            refreshCurrentView();
        } catch (error) {
            console.error("fetchDataForMonthでエラー:", error);
        }
    }

    // --- 主要な描画関数 ---

    function renderCalendar() {
        if (!calendarGrid || !calendarMonthYear) return;

        calendarGrid.innerHTML = '';
        const year = calendarDisplayDate.getFullYear();
        const month = calendarDisplayDate.getMonth();
        calendarMonthYear.textContent = `${year}年 ${month + 1}月`;
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const lastDateOfMonth = new Date(year, month + 1, 0).getDate();

        // 月初の空白マスを埋める
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarGrid.insertAdjacentHTML('beforeend', `<div class="other-month"></div>`);
        }

        // 日付マスを生成
        for (let day = 1; day <= lastDateOfMonth; day++) {
            const date = new Date(year, month, day);
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            if (isToday(date)) {
                dayCell.classList.add('today');
            }
            dayCell.innerHTML = `<div>${day}</div>`;
            // ここにシフト情報を表示するロジックを追加できます
            calendarGrid.appendChild(dayCell);
        }
    }

    function renderDailyShiftChart() {
        try {
            if (!dailyShiftChartCanvas) return;

            const dateString = formatDate(chartDisplayDate);
            const shiftsForDay = (appState.shifts[dateString] || []).slice();
            
            // ▼▼▼【並び替え処理】▼▼▼
            const sortedShifts = shiftsForDay
                .filter(shift => shift && typeof shift.time === 'string' && shift.time.includes(' - '))
                .sort((a, b) => {
                    const startTimeA = a.time.split(' - ')[0];
                    const startTimeB = b.time.split(' - ')[0];
                    return startTimeA.localeCompare(startTimeB);
                });
            
            const yLabels = [];
            sortedShifts.forEach(shift => {
                if (!yLabels.includes(shift.fullName)) {
                    yLabels.push(shift.fullName);
                }
            });

            const chartDatasetData = [];
            sortedShifts.forEach(shift => {
                const [startTimeStr, endTimeStr] = shift.time.split(' - ');
                const mainStartDate = parseTimeToDate(startTimeStr, chartDisplayDate);
                const mainEndDate = parseTimeToDate(endTimeStr, chartDisplayDate);
                if (!mainStartDate || !mainEndDate) return;
                
                const bgColor = shift.role === 'manager' ? 'rgba(250, 204, 21, 0.7)' : 'rgba(59, 130, 246, 0.7)';
                
                chartDatasetData.push({ 
                    x: [mainStartDate.getTime(), mainEndDate.getTime()], 
                    y: shift.fullName, 
                    originalShift: shift,
                    bgColor: bgColor 
                });
            });

            if (dailyShiftChartInstance) {
                dailyShiftChartInstance.destroy();
            }
            
            const chartMinTime = new Date(chartDisplayDate); chartMinTime.setHours(9,0,0,0);
            const chartMaxTime = new Date(chartDisplayDate); chartMaxTime.setHours(21,0,0,0);

            dailyShiftChartInstance = new Chart(dailyShiftChartCanvas, {
                type: 'bar',
                data: { datasets: [{ label: '勤務時間', data: chartDatasetData, backgroundColor: chartDatasetData.map(d => d.bgColor) }] },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    scales: {
                        y: { type: 'category', labels: yLabels, offset: true, title: { display: true, text: '従業員' } },
                        x: { type: 'time', min: chartMinTime.getTime(), max: chartMaxTime.getTime(), time: { unit: 'hour', displayFormats: { hour: 'H時' } }, title: { display: true, text: '時間' } }
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                             callbacks: {
                                label: function(context) {
                                    const raw = context.raw;
                                    const shift = raw.originalShift;
                                    let label = `${formatTime(new Date(raw.x[0]))} - ${formatTime(new Date(raw.x[1]))}`;
                                    if (shift.notes) label += ` (備考: ${shift.notes})`;
                                    if (shift.breakTime) label += ` (休憩: ${shift.breakTime})`;
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error("グラフ描画中にエラー:", error);
        }
    }

    function renderBulkShiftTable() {
        // 一括シフト入力ビューの描画ロジック（今回は省略）
    }

    // --- ビュー管理 ---
    function refreshCurrentView() {
        if (mainViews.dailyChart && !mainViews.dailyChart.classList.contains('hidden')) {
            renderDailyShiftChart();
        } else if (mainViews.calendar && !mainViews.calendar.classList.contains('hidden')) {
            renderCalendar();
        } else if (mainViews.bulkShift && !mainViews.bulkShift.classList.contains('hidden')) {
            renderBulkShiftTable();
        }
    }

    async function switchView(viewKey) {
        Object.keys(mainViews).forEach(key => {
            if (mainViews[key]) mainViews[key].classList.toggle('hidden', key !== viewKey);
        });
        Object.keys(navButtons).forEach(key => {
            if (navButtons[key]) navButtons[key].classList.toggle('active', key === viewKey);
        });
        await fetchDataForMonth(viewKey === 'dailyChart' ? chartDisplayDate : calendarDisplayDate);
    }

    // --- アプリケーション初期化 ---
    async function initializeApp() {
        // ナビゲーションボタンのイベントリスナー
        Object.keys(navButtons).forEach(key => {
            if (navButtons[key]) {
                navButtons[key].addEventListener('click', () => switchView(key));
            }
        });

        // 日付変更のイベントリスナー
        if(currentChartDateInput) {
            currentChartDateInput.value = formatDate(chartDisplayDate);
            currentChartDateInput.addEventListener('change', (e) => { 
                chartDisplayDate = new Date(e.target.value + "T00:00:00"); 
                fetchDataForMonth(chartDisplayDate); 
            });
        }
        if(prevDayChartBtn) prevDayChartBtn.addEventListener('click', () => { chartDisplayDate.setDate(chartDisplayDate.getDate() - 1); currentChartDateInput.value = formatDate(chartDisplayDate); switchView('dailyChart'); });
        if(nextDayChartBtn) nextDayChartBtn.addEventListener('click', () => { chartDisplayDate.setDate(chartDisplayDate.getDate() + 1); currentChartDateInput.value = formatDate(chartDisplayDate); switchView('dailyChart'); });
        if(prevMonthBtn) prevMonthBtn.addEventListener('click', () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() - 1); switchView('calendar'); });
        if(nextMonthBtn) nextMonthBtn.addEventListener('click', () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() + 1); switchView('calendar'); });

        // 初回ロード
        switchView('calendar');
    }

    initializeApp();
});