document.addEventListener('DOMContentLoaded', function() {
    // --- グローバル変数と設定 ---
    const API_BASE_URL = 'https://my-shift-backend.tamago-2483.workers.dev';
    let dailyShiftChartInstance = null;
    let appState = { users: [], shifts: {}, manualBreaks: {}, manualShortages: {} };
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
    // ... 他のDOM要素も同様に取得 ...
    const shiftDetailModal = document.getElementById('shiftDetailModal');
    const modalContent = document.getElementById('modalContent');
    const roleSwitcher = document.getElementById('roleSwitcher');
    const currentUserInfo = document.getElementById('currentUserInfo');
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarMonthYear = document.getElementById('calendarMonthYear');
    const employeeHighlightSelect = document.getElementById('employeeHighlightSelect');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const dailyShiftChartCanvas = document.getElementById('dailyShiftChart');
    const currentChartDateInput = document.getElementById('currentChartDate');
    const prevDayChartBtn = document.getElementById('prevDayChartBtn');
    const nextDayChartBtn = document.getElementById('nextDayChartBtn');
    const bulkShiftMonthYearDisplay = document.getElementById('bulkShiftMonthYear');
    const prevMonthBulkBtn = document.getElementById('prevMonthBulkBtn');
    const nextMonthBulkBtn = document.getElementById('nextMonthBulkBtn');
    const toggleBulkShiftPeriodBtn = document.getElementById('toggleBulkShiftPeriodBtn');
    const bulkShiftTable = document.getElementById('bulkShiftTable');

    // --- 状態管理用変数 ---
    const today = new Date();
    const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let calendarDisplayDate = new Date(firstDayOfCurrentMonth);
    let chartDisplayDate = new Date(today);
    let bulkViewDisplayMonth = new Date(firstDayOfCurrentMonth);
    let bulkViewIsFirstHalf = true;
    let selectedEmployeeForHighlight = null;
    const EMPLOYEE_VIEW_ID = 0;


    // =================================================================
    // ▼▼▼ ここからが修正の中心となる関数です ▼▼▼
    // =================================================================

    /**
     * 日別グラフを描画するメインの関数
     */
    function renderDailyShiftChart() {
        // 1. この関数が呼ばれたことをコンソールに記録
        console.log("renderDailyShiftChart() 関数が呼び出されました。");

        try {
            if (!dailyShiftChartCanvas) {
                console.error("エラー: グラフを描画するためのキャンバス要素が見つかりません。");
                return;
            }

            const dateString = formatDate(chartDisplayDate);
            const shiftsForDay = appState.shifts[dateString] || [];
            
            console.log(`対象日[${dateString}]のシフト(ソート前):`, JSON.parse(JSON.stringify(shiftsForDay)));

            // 2. 出勤時間でシフトを並び替え
            const sortedShifts = shiftsForDay
                .filter(shift => shift && typeof shift.time === 'string' && shift.time.includes(' - '))
                .sort((a, b) => {
                    const startTimeA = a.time.split(' - ')[0];
                    const startTimeB = b.time.split(' - ')[0];
                    return startTimeA.localeCompare(startTimeB);
                });
            
            console.log("並び替え後のシフト:", JSON.parse(JSON.stringify(sortedShifts)));

            // 3. グラフのY軸ラベルとデータを作成
            const yLabels = sortedShifts.map(shift => shift.fullName).filter((name, index, self) => self.indexOf(name) === index);
            console.log("グラフY軸のラベル順:", yLabels);

            const chartDatasetData = [];
            sortedShifts.forEach(shift => {
                const mainStartDate = parseTimeToDate(shift.time.split(' - ')[0], chartDisplayDate);
                const mainEndDate = parseTimeToDate(shift.time.split(' - ')[1], chartDisplayDate);
                if (!mainStartDate || !mainEndDate) return;

                const bgColor = shift.role === 'manager' ? 'rgba(250, 204, 21, 0.7)' : 'rgba(59, 130, 246, 0.7)';
                
                // 休憩時間を考慮した描画処理
                if (shift.breakTime && shift.breakTime.includes(' - ')) {
                    const breakStartDate = parseTimeToDate(shift.breakTime.split(' - ')[0], chartDisplayDate);
                    const breakEndDate = parseTimeToDate(shift.breakTime.split(' - ')[1], chartDisplayDate);
                    if (breakStartDate && breakEndDate && breakStartDate < mainEndDate && breakEndDate > mainStartDate) {
                        if (mainStartDate < breakStartDate) chartDatasetData.push({ x: [mainStartDate.getTime(), breakStartDate.getTime()], y: shift.fullName, bgColor: bgColor });
                        if (breakEndDate < mainEndDate) chartDatasetData.push({ x: [breakEndDate.getTime(), mainEndDate.getTime()], y: shift.fullName, bgColor: bgColor });
                    } else {
                        chartDatasetData.push({ x: [mainStartDate.getTime(), mainEndDate.getTime()], y: shift.fullName, bgColor: bgColor });
                    }
                } else {
                    chartDatasetData.push({ x: [mainStartDate.getTime(), mainEndDate.getTime()], y: shift.fullName, bgColor: bgColor });
                }
            });

            // 4. グラフを実際に描画
            if (dailyShiftChartInstance) {
                dailyShiftChartInstance.destroy();
            }

            const chartMinTime = new Date(chartDisplayDate); chartMinTime.setHours(9,0,0,0);
            const chartMaxTime = new Date(chartDisplayDate); chartMaxTime.setHours(21,0,0,0);

            dailyShiftChartInstance = new Chart(dailyShiftChartCanvas, {
                type: 'bar',
                data: {
                    datasets: [{
                        data: chartDatasetData,
                        backgroundColor: chartDatasetData.map(d => d.bgColor),
                    }]
                },
                options: {
                    indexAxis: 'y',
                    scales: {
                        y: { type: 'category', labels: yLabels, offset: true, title: { display: true, text: '従業員' } },
                        x: { type: 'time', min: chartMinTime.getTime(), max: chartMaxTime.getTime(), time: { unit: 'hour', displayFormats: { hour: 'H時' } }, title: { display: true, text: '時間' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
            console.log("グラフの描画が完了しました。");

        } catch (error) {
            // 5. もし上記処理のどこかでエラーが起きたら、ここに内容が表示される
            console.error("renderDailyShiftChart 関数内でエラーが発生しました:", error);
        }
    }


    // --- 以下、その他の関数 (変更なし) ---

    async function fetchDataForMonth(date) {
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        try {
            const response = await fetch(`${API_BASE_URL}/api/data?month=${year}-${month}`);
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            
            appState.users = data.users || [];
            const monthKey = `${year}-${month}`;
            Object.keys(appState.shifts).forEach(key => { if (key.startsWith(monthKey)) delete appState.shifts[key]; });
            appState.shifts = { ...appState.shifts, ...data.shifts };

            if (!currentUser && appState.users.length > 0) initializeUser();
            refreshCurrentView();
        } catch (error) {
            console.error("データ取得エラー:", error);
        }
    }

    function refreshCurrentView() {
        if (!mainViews.calendar.classList.contains('hidden')) renderCalendar();
        else if (!mainViews.dailyChart.classList.contains('hidden')) renderDailyShiftChart();
        // ... 他のビューの描画関数呼び出し
    }

    async function switchView(viewKey) {
        Object.keys(mainViews).forEach(key => mainViews[key].classList.toggle('hidden', key !== viewKey));
        setActiveNavButton(viewKey);
        
        let targetDate = new Date();
        if (viewKey === 'dailyChart') targetDate = chartDisplayDate;
        else if (viewKey === 'calendar') targetDate = calendarDisplayDate;
        
        await fetchDataForMonth(targetDate);
    }
    
    // --- ユーティリティと初期化 ---
    function formatDate(date) { return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`; }
    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr || !timeStr.includes(':')) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        return date;
    }
    function setActiveNavButton(activeViewKey) {
        Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
        if (navButtons[activeViewKey]) navButtons[activeViewKey].classList.add('active');
    }
    function initializeUser() {
        const manager = appState.users.find(u => u.role === 'manager');
        currentUser = manager || { id: EMPLOYEE_VIEW_ID, name: '従業員ビュー', role: 'employee_viewer' };
    }
    // ダミーの関数
    function renderCalendar() { /* カレンダー描画処理 */ }
    
    async function initializeApp() {
        navButtons.calendar.addEventListener('click', () => switchView('calendar'));
        navButtons.dailyChart.addEventListener('click', () => switchView('dailyChart'));
        // ... 他のイベントリスナー
        
        currentChartDateInput.value = formatDate(chartDisplayDate);
        await fetchDataForMonth(firstDayOfCurrentMonth);
        switchView('calendar');
    }

    initializeApp();
});