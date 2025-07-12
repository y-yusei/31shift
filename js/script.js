document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ script.jsが読み込まれ、実行が開始されました。");

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
    const dummyEvents = { '2025-06-01': { text: '特売日', icon: 'fas fa-tags' } };

    // --- データ通信 ---
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
            appState.shifts = { ...appState.shifts, ...(data.shifts || {}) };
            appState.manualBreaks = { ...appState.manualBreaks, ...(data.manualBreaks || {}) };
            appState.manualShortages = { ...appState.manualShortages, ...(data.manualShortages || {}) };

            if (!currentUser && appState.users.length > 0) initializeUser();
            refreshCurrentView();
        } catch (error) {
            console.error("データ取得エラー:", error);
        }
    }
    async function updateShift(shiftData) { /* ... 元のコード ... */ }
    async function updateManualData(date, breaks, shortages) { /* ... 元のコード ... */ }

    // --- ユーティリティ関数 ---
    function formatTime(date) { return `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`; }
    function formatDate(date) { return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`; }
    function formatDateToJapanese(date) { return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`; }
    function formatDateToJapaneseShort(date) { return `${date.getMonth() + 1}/${date.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;}
    function isToday(date) { const today = new Date(); return date.toDateString() === today.toDateString(); }
    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr || !timeStr.includes(':')) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    // --- UI描画関数 ---

    function renderCalendar() {
        if (!calendarGrid || !calendarMonthYear || !employeeHighlightSelect) return;

        calendarGrid.innerHTML = '';
        const year = calendarDisplayDate.getFullYear();
        const month = calendarDisplayDate.getMonth();
        calendarMonthYear.textContent = `${year}年 ${month + 1}月`;
        
        const currentSelected = employeeHighlightSelect.value;
        employeeHighlightSelect.innerHTML = `<option value="">全員表示</option>` + appState.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        employeeHighlightSelect.value = currentSelected;
        
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const startDayOfWeek = new Date(year, month, 1).getDay();

        for (let i = 0; i < startDayOfWeek; i++) {
            calendarGrid.insertAdjacentHTML('beforeend', `<div class="other-month"></div>`);
        }

        for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = formatDate(date);
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            if(isToday(date)) dayCell.classList.add('today');

            const shiftsForDay = appState.shifts[dateString] || [];
            if (selectedEmployeeForHighlight && shiftsForDay.some(s => s.userId == selectedEmployeeForHighlight)) {
                dayCell.classList.add('highlight-shift');
            }
            
            let cellContent = `<div class="day-number">${day}</div>`;
            const eventForDay = dummyEvents[dateString];
            if (eventForDay) {
                cellContent += `<div class="event-entry"><i class="${eventForDay.icon} mr-1"></i>${eventForDay.text}</div>`;
            }
            dayCell.innerHTML = cellContent;
            dayCell.addEventListener('click', () => showShiftDetailModal(date));
            calendarGrid.appendChild(dayCell);
        }
    }

    function renderDailyShiftChart() {
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
            
             if (shift.breakTime && shift.breakTime.includes(' - ')) {
                const breakStartDate = parseTimeToDate(shift.breakTime.split(' - ')[0], chartDisplayDate);
                const breakEndDate = parseTimeToDate(shift.breakTime.split(' - ')[1], chartDisplayDate);
                if (breakStartDate && breakEndDate && breakStartDate < mainEndDate && breakEndDate > mainStartDate && breakStartDate < breakEndDate) {
                    if (mainStartDate < breakStartDate) chartDatasetData.push({ x: [mainStartDate.getTime(), breakStartDate.getTime()], y: shift.fullName, originalShift: shift, bgColor: bgColor });
                    if (breakEndDate < mainEndDate) chartDatasetData.push({ x: [breakEndDate.getTime(), mainEndDate.getTime()], y: shift.fullName, originalShift: shift, bgColor: bgColor });
                } else {
                    chartDatasetData.push({ x: [mainStartDate.getTime(), mainEndDate.getTime()], y: shift.fullName, originalShift: shift, bgColor: bgColor });
                }
            } else {
                chartDatasetData.push({ x: [mainStartDate.getTime(), mainEndDate.getTime()], y: shift.fullName, originalShift: shift, bgColor: bgColor });
            }
        });

        if (dailyShiftChartInstance) dailyShiftChartInstance.destroy();
        
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
    }

    function renderBulkShiftTable() {
        const dateHeader = bulkShiftTable.querySelector('thead tr');
        const body = bulkShiftTable.querySelector('tbody');
        if(!dateHeader || !body) return;

        dateHeader.innerHTML = '';
        body.innerHTML = '';

        const days = [];
        let headerHtml = '<th>従業員名</th>';
        const year = bulkViewDisplayMonth.getFullYear();
        const month = bulkViewDisplayMonth.getMonth();
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        
        const startDay = bulkViewIsFirstHalf ? 1 : 16;
        const endDayLoop = bulkViewIsFirstHalf ? 15 : lastDayOfMonth;

        for (let day = startDay; day <= endDayLoop; day++) {
            if (day > lastDayOfMonth) break;
            const currentDate = new Date(year, month, day);
            days.push(formatDate(currentDate));
            headerHtml += `<th>${formatDateToJapaneseShort(currentDate)}</th>`;
        }
        dateHeader.innerHTML = headerHtml;
        
        const displayableUsers = [...appState.users.filter(u=>u.role === 'manager'), ...appState.users.filter(u=>u.role === 'employee')];

        displayableUsers.forEach(user => {
            let rowHtml = `<tr><th class="font-semibold ${user.role === 'manager' ? 'text-amber-700' : ''}">${user.name}</th>`;
            days.forEach((dateString) => {
                const shift = (appState.shifts[dateString] || []).find(s => s.userId === user.id);
                let shiftText = shift ? shift.time : "";
                rowHtml += `<td><input type="text" value="${shiftText}" data-user-id="${user.id}" data-date="${dateString}" placeholder=""></td>`;
            });
            rowHtml += '</tr>';
            body.innerHTML += rowHtml;
        });
        
        bulkShiftMonthYearDisplay.textContent = `${bulkViewDisplayMonth.getFullYear()}年 ${bulkViewDisplayMonth.getMonth() + 1}月`;
        toggleBulkShiftPeriodBtn.textContent = bulkViewIsFirstHalf ? '前半 (1-15日)' : `後半 (16-${lastDayOfMonth}日)`;
    }

    async function showShiftDetailModal(date) { /* ... 元のコードをここに追加 ... */ }
    
    // --- UI制御 ---
    function setActiveNavButton(activeViewKey) {
        Object.keys(navButtons).forEach(key => {
            if (navButtons[key]) navButtons[key].classList.toggle('active', key === activeViewKey);
        });
    }

    async function switchView(viewKey) {
        Object.keys(mainViews).forEach(key => {
            if (mainViews[key]) mainViews[key].classList.toggle('hidden', key !== viewKey);
        });
        setActiveNavButton(viewKey);
        
        let targetDate;
        if (viewKey === 'calendar') targetDate = calendarDisplayDate;
        else if (viewKey === 'dailyChart') targetDate = chartDisplayDate;
        else if (viewKey === 'bulkShift') targetDate = bulkViewDisplayMonth;
        
        await fetchDataForMonth(targetDate);
    }
    
    function refreshCurrentView() {
        if (!mainViews.calendar.classList.contains('hidden')) renderCalendar();
        else if (!mainViews.dailyChart.classList.contains('hidden')) renderDailyShiftChart();
        else if (!mainViews.bulkShift.classList.contains('hidden')) renderBulkShiftTable();
    }

    function initializeUser() {
        const manager = appState.users.find(u => u.role === 'manager');
        currentUser = manager || { id: EMPLOYEE_VIEW_ID, name: '従業員ビュー', role: 'employee_viewer' };
    }

    // --- アプリケーション初期化 ---
    async function initializeApp() {
        Object.keys(navButtons).forEach(key => {
            if (navButtons[key]) {
                navButtons[key].addEventListener('click', () => switchView(key));
            }
        });
        
        if (currentChartDateInput) {
            currentChartDateInput.value = formatDate(chartDisplayDate);
            currentChartDateInput.addEventListener('change', (e) => { 
                chartDisplayDate = new Date(e.target.value + "T00:00:00"); 
                fetchDataForMonth(chartDisplayDate); 
            });
        }
        if(prevDayChartBtn) prevDayChartBtn.addEventListener('click', () => { chartDisplayDate.setDate(chartDisplayDate.getDate() - 1); currentChartDateInput.value = formatDate(chartDisplayDate); fetchDataForMonth(chartDisplayDate); });
        if(nextDayChartBtn) nextDayChartBtn.addEventListener('click', () => { chartDisplayDate.setDate(chartDisplayDate.getDate() + 1); currentChartDateInput.value = formatDate(chartDisplayDate); fetchDataForMonth(chartDisplayDate); });
        if(prevMonthBtn) prevMonthBtn.addEventListener('click', () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() - 1); fetchDataForMonth(calendarDisplayDate); });
        if(nextMonthBtn) nextMonthBtn.addEventListener('click', () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() + 1); fetchDataForMonth(calendarDisplayDate); });
        if(employeeHighlightSelect) employeeHighlightSelect.addEventListener('change', (e) => { selectedEmployeeForHighlight = e.target.value ? parseInt(e.target.value) : null; renderCalendar(); });
        if(toggleBulkShiftPeriodBtn) toggleBulkShiftPeriodBtn.addEventListener('click', () => { bulkViewIsFirstHalf = !bulkViewIsFirstHalf; renderBulkShiftTable(); });

        // 初回ロード
        switchView('calendar');
    }

    initializeApp();
});