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
    const shiftDetailModal = document.getElementById('shiftDetailModal');
    const modalContent = document.getElementById('modalContent');
    const roleSwitcher = document.getElementById('roleSwitcher');
    const currentUserInfo = document.getElementById('currentUserInfo');
    if (document.getElementById('currentYear')) {
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }
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
    
    /**
     * 日別グラフを描画する関数
     */
    function renderDailyShiftChart() {
        try {
            if (!dailyShiftChartCanvas) return;

            const dateString = formatDate(chartDisplayDate);
            const shiftsForDay = (appState.shifts[dateString] || []).slice();

            // 出勤時間でシフトを並び替え
            const sortedShifts = shiftsForDay
                .filter(shift => shift && typeof shift.time === 'string' && shift.time.includes(' - '))
                .sort((a, b) => {
                    const startTimeA = a.time.split(' - ')[0];
                    const startTimeB = b.time.split(' - ')[0];
                    return startTimeA.localeCompare(startTimeB);
                });
            
            // Y軸ラベルとグラフデータを作成
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
                    originalShift: shift, // 元データを保持
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
                data: {
                    datasets: [{
                        label: '勤務時間',
                        data: chartDatasetData,
                        backgroundColor: chartDatasetData.map(d => d.bgColor),
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
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

    // --- データとUIの状態を更新する関数 ---
    async function fetchDataForMonth(date) { /* ... 既存のコード ... */ }
    function refreshCurrentView() {
        if (!mainViews.calendar.classList.contains('hidden')) renderCalendar();
        else if (!mainViews.dailyChart.classList.contains('hidden')) renderDailyShiftChart();
        else if (!mainViews.bulkShift.classList.contains('hidden')) renderBulkShiftTable();
    }
    async function switchView(viewKey) {
        Object.keys(mainViews).forEach(key => mainViews[key].classList.toggle('hidden', key !== viewKey));
        setActiveNavButton(viewKey);
        
        let targetDate = new Date();
        if (viewKey === 'dailyChart') targetDate = chartDisplayDate;
        else if (viewKey === 'calendar') targetDate = calendarDisplayDate;
        else if (viewKey === 'bulkShift') targetDate = bulkViewDisplayMonth;
        
        await fetchDataForMonth(targetDate);
    }
    
    // --- ユーティリティとその他の描画関数 ---
    function formatDate(date) { return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`; }
    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr || !timeStr.includes(':')) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        return date;
    }
    function formatTime(date) { return `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`; }
    function setActiveNavButton(activeViewKey) {
        Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
        if (navButtons[activeViewKey]) navButtons[activeViewKey].classList.add('active');
    }
    function initializeUser() { /* ... 既存のコード ... */ }
    function renderCalendar() { /* ... 既存のコード ... */ }
    function renderBulkShiftTable() { /* ... 既存のコード ... */ }
    function showShiftDetailModal(date) { /* ... 既存のコード ... */ }


    // --- アプリケーション初期化 ---
    async function initializeApp() {
        if (navButtons.dailyChart) {
            navButtons.dailyChart.addEventListener('click', () => switchView('dailyChart'));
        }
        if (navButtons.calendar) {
            navButtons.calendar.addEventListener('click', () => switchView('calendar'));
        }
        if (navButtons.bulkShift) {
            navButtons.bulkShift.addEventListener('click', () => switchView('bulkShift'));
        }

        // その他のイベントリスナー...
        
        currentChartDateInput.value = formatDate(chartDisplayDate);
        await fetchDataForMonth(firstDayOfCurrentMonth);
        switchView('calendar');
    }

    initializeApp();
});