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

    // --- メインの描画関数 ---
    function renderDailyShiftChart() {
        console.log("✅ renderDailyShiftChart() が呼び出されました。");
        try {
            if (!dailyShiftChartCanvas) {
                console.error("致命的エラー: グラフのキャンバス要素が見つかりません。");
                return;
            }
            const dateString = formatDate(chartDisplayDate);
            const shiftsForDay = (appState.shifts[dateString] || []).slice();
            
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

            console.log("グラフのY軸の最終的な順番:", yLabels);

            const chartDatasetData = [];
            sortedShifts.forEach(shift => {
                const [startTimeStr, endTimeStr] = shift.time.split(' - ');
                const mainStartDate = parseTimeToDate(startTimeStr, chartDisplayDate);
                const mainEndDate = parseTimeToDate(endTimeStr, chartDisplayDate);
                if (!mainStartDate || !mainEndDate) return;

                const bgColor = shift.role === 'manager' ? 'rgba(250, 204, 21, 0.7)' : 'rgba(59, 130, 246, 0.7)';
                chartDatasetData.push({ x: [mainStartDate.getTime(), mainEndDate.getTime()], y: shift.fullName, originalShift: shift, bgColor: bgColor });
            });

            if (dailyShiftChartInstance) dailyShiftChartInstance.destroy();

            const chartMinTime = new Date(chartDisplayDate); chartMinTime.setHours(9, 0, 0, 0);
            const chartMaxTime = new Date(chartDisplayDate); chartMaxTime.setHours(21, 0, 0, 0);

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
                    scales: {
                        y: { type: 'category', labels: yLabels, offset: true, title: { display: true, text: '従業員' } },
                        x: { type: 'time', min: chartMinTime.getTime(), max: chartMaxTime.getTime(), time: { unit: 'hour', displayFormats: { hour: 'H時' } }, title: { display: true, text: '時間' } }
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const dp = context.dataset.data[context.dataIndex]; const os = dp.originalShift;
                                    let l = `${formatTime(new Date(context.raw[0]))} - ${formatTime(new Date(context.raw[1]))}`;
                                    if (os.notes) l += ` (備考: ${os.notes})`; if (os.breakTime) l += ` (休憩: ${os.breakTime})`;
                                    return l;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error("renderDailyShiftChart 関数内でエラーが発生:", error);
        }
    }

    // --- データ取得・更新 ---
    async function fetchDataForMonth(date) { /* ... 省略 (変更なし) ... */ }
    function refreshCurrentView() {
        try {
            if (!mainViews.calendar.classList.contains('hidden')) renderCalendar();
            else if (!mainViews.dailyChart.classList.contains('hidden')) renderDailyShiftChart();
            else if (!mainViews.bulkShift.classList.contains('hidden')) renderBulkShiftTable();
        } catch(e) { console.error("refreshCurrentViewでエラー:", e)}
    }
    async function switchView(viewKey) { /* ... 省略 (変更なし) ... */ }

    // --- ユーティリティ関数群 (変更なし) ---
    function renderCalendar() { /* ... */ }
    function renderBulkShiftTable() { /* ... */ }
    function showShiftDetailModal(date) { /* ... */ }
    function setActiveNavButton(activeViewKey) { /* ... */ }
    function formatDate(date) { return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`; }
    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr || !timeStr.includes(':')) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        return date;
    }
    function formatTime(date) { return `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`; }
    function initializeUser() {
      const manager = appState.users.find(u => u.role === 'manager');
      currentUser = manager || { id: EMPLOYEE_VIEW_ID, name: '従業員ビュー', role: 'employee_viewer' };
    }

    // --- アプリケーション初期化 ---
    async function initializeApp() {
        console.log("initializeApp() を開始します。");
        
        // ▼▼▼ ここが最重要の確認ポイントです ▼▼▼
        if (navButtons.dailyChart) {
            navButtons.dailyChart.addEventListener('click', () => {
                console.log("🖱️ 「日別グラフ表示」ボタンがクリックされました！");
                switchView('dailyChart');
            });
        } else {
            console.error("致命的エラー: 「日別グラフ表示」ボタン(id='showDailyChartViewBtn')が見つかりません。");
        }
        // ▲▲▲ ▲▲▲ ▲▲▲

        // 他のボタンのイベントリスナー
        if (navButtons.calendar) {
            navButtons.calendar.addEventListener('click', () => switchView('calendar'));
        }
        if (navButtons.bulkShift) {
            navButtons.bulkShift.addEventListener('click', () => switchView('bulkShift'));
        }

        // その他の初期化処理...
        currentChartDateInput.value = formatDate(chartDisplayDate);
        await fetchDataForMonth(firstDayOfCurrentMonth);
        switchView('calendar');
        console.log("アプリケーションの初期化が完了しました。");
    }

    initializeApp();
});