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
            if (!response.ok) throw new Error(`APIからのデータ取得に失敗しました (ステータス: ${response.status})`);
            
            const data = await response.json();
            appState.users = data.users || [];
            appState.shifts = { ...appState.shifts, ...(data.shifts || {}) };
            
            if (!currentUser && appState.users.length > 0) {
                currentUser = appState.users[0]; // ユーザー初期化（簡略化）
            }
            refreshCurrentView();
        } catch (error) {
            console.error("fetchDataForMonthでエラー:", error);
            // ここでユーザーにエラー通知UIを表示することも可能
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

        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarGrid.insertAdjacentHTML('beforeend', `<div class="other-month"></div>`);
        }

        for (let day = 1; day <= lastDateOfMonth; day++) {
            const date = new Date(year, month, day);
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            if (isToday(date)) {
                dayCell.classList.add('today');
            }
            dayCell.innerHTML = `<div>${day}</div>`;
            // TODO: シフト情報をセルに表示するロジック
            calendarGrid.appendChild(dayCell);
        }
    }

    function renderDailyShiftChart() {
        try {
            if (!dailyShiftChartCanvas) return;

            const dateString = formatDate(chartDisplayDate);
            const shiftsForDay = appState.shifts[dateString] || [];
            
            const sortedShifts = shiftsForDay
                .filter(shift => shift && typeof shift.time === 'string' && shift.time.includes(' - '))
                .sort((a, b) => {
                    const [startA, endA] = a.time.split(' - ');
                    const [startB, endB] = b.time.split(' - ');
                    if (startA !== startB) {
                        return startA.localeCompare(startB);
                    }
                    return endA.localeCompare(endB);
                });
            
            // +++ Setを使って効率的にユニークなラベルを取得 +++
            const yLabels = [...new Set(sortedShifts.map(shift => shift.fullName))];

            // +++ mapとfilterでデータセットを生成 +++
            const chartDatasetData = sortedShifts.map(shift => {
                const [startTimeStr, endTimeStr] = shift.time.split(' - ');
                const mainStartDate = parseTimeToDate(startTimeStr, chartDisplayDate);
                const mainEndDate = parseTimeToDate(endTimeStr, chartDisplayDate);

                if (!mainStartDate || !mainEndDate) return null;

                const bgColor = shift.role === 'manager' ? 'rgba(250, 204, 21, 0.7)' : 'rgba(59, 130, 246, 0.7)';
                
                return { 
                    x: [mainStartDate.getTime(), mainEndDate.getTime()], 
                    y: shift.fullName, 
                    originalShift: shift,
                    bgColor: bgColor 
                };
            }).filter(Boolean); // nullを除外

            if (dailyShiftChartInstance) {
                dailyShiftChartInstance.destroy();
            }
            
            const chartMinTime = new Date(chartDisplayDate); chartMinTime.setHours(9, 0, 0, 0);
            const chartMaxTime = new Date(chartDisplayDate); chartMaxTime.setHours(21, 0, 0, 0);

            dailyShiftChartInstance = new Chart(dailyShiftChartCanvas, {
                type: 'bar',
                data: {
                    // Y軸のラベルはここで指定するのがChart.jsの標準的な方法
                    labels: yLabels, 
                    datasets: [{ 
                        data: chartDatasetData, 
                        backgroundColor: chartDatasetData.map(d => d.bgColor) 
                    }]
                },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    scales: {
                        y: { offset: true, title: { display: true, text: '従業員' } },
                        x: { type: 'time', min: chartMinTime.getTime(), max: chartMaxTime.getTime(), time: { unit: 'hour', displayFormats: { hour: 'H時' } }, title: { display: true, text: '時間' } }
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                             callbacks: {
                                label: function(context) {
                                    const raw = context.raw;
                                    const shift = raw.originalShift;
                                    // +++ 従業員名を追加 +++
                                    let label = `${shift.fullName}: ${formatTime(new Date(raw.x[0]))} - ${formatTime(new Date(raw.x[1]))}`;
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
        
        const dateForFetch = viewKey === 'dailyChart' ? chartDisplayDate : calendarDisplayDate;
        await fetchDataForMonth(dateForFetch);
    }

    // --- アプリケーション初期化 ---
    function initializeApp() {
        Object.keys(navButtons).forEach(key => {
            if (navButtons[key]) {
                navButtons[key].addEventListener('click', () => switchView(key));
            }
        });

        // 日付変更ロジックを共通化
        const updateChartDate = (daysToAdd) => {
            chartDisplayDate.setDate(chartDisplayDate.getDate() + daysToAdd);
            currentChartDateInput.value = formatDate(chartDisplayDate);
            switchView('dailyChart');
        };

        if(currentChartDateInput) {
            currentChartDateInput.value = formatDate(chartDisplayDate);
            currentChartDateInput.addEventListener('change', (e) => { 
                chartDisplayDate = new Date(e.target.value + "T00:00:00"); 
                fetchDataForMonth(chartDisplayDate); 
            });
        }
        if(prevDayChartBtn) prevDayChartBtn.addEventListener('click', () => updateChartDate(-1));
        if(nextDayChartBtn) nextDayChartBtn.addEventListener('click', () => updateChartDate(1));
        
        if(prevMonthBtn) prevMonthBtn.addEventListener('click', () => { 
            calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() - 1); 
            switchView('calendar'); 
        });
        if(nextMonthBtn) nextMonthBtn.addEventListener('click', () => { 
            calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() + 1); 
            switchView('calendar'); 
        });

        switchView('calendar'); // 初回ロード
    }

    initializeApp();
});