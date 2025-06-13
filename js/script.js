document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = 'https://my-shift-backend.tamago-2483.workers.dev';
    let dailyShiftChartInstance = null;
    let appState = { users: [], shifts: {}, manualBreaks: {}, manualShortages: {} };
    let currentUser = null; 

    // DOM要素
    const calendarView = document.getElementById('calendarView');
    const dailyChartView = document.getElementById('dailyChartView');
    const bulkShiftView = document.getElementById('bulkShiftView');
    const navButtons = { calendar: document.getElementById('showCalendarViewBtn'), dailyChart: document.getElementById('showDailyChartViewBtn'), bulkShift: document.getElementById('showBulkShiftViewBtn')};
    const mainViews = { calendar: calendarView, dailyChart: dailyChartView, bulkShift: bulkShiftView };
    
    const shiftDetailModal = document.getElementById('shiftDetailModal');
    const modalContent = document.getElementById('modalContent');
    const roleSwitcher = document.getElementById('roleSwitcher');
    const currentUserInfo = document.getElementById('currentUserInfo');
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // 表示管理用の変数
    let calendarDisplayDate = new Date(2025, 5, 1);
    let chartDisplayDate = new Date(2025, 5, 1);
    let bulkViewDisplayMonth = new Date(2025, 5, 1);
    let bulkViewIsFirstHalf = true;
    let selectedEmployeeForHighlight = null;
    const EMPLOYEE_VIEW_ID = 0;
    
    const dummyEvents = { 
        '2025-06-01': { text: '特売日', icon: 'fas fa-tags' },
        '2025-06-04': { text: '店長会議', icon: 'fas fa-users' },
        '2025-06-15': { text: '棚卸し', icon: 'fas fa-boxes-stacked' },
        '2025-06-20': { text: '新商品発売', icon: 'fas fa-gift' },
    };

    // --- データ通信 ---
    async function fetchDataForMonth(date) {
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        try {
            const response = await fetch(`${API_BASE_URL}/api/data?month=${year}-${month}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`APIからのデータ取得に失敗しました: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const data = await response.json();
            
            appState.users = data.users || [];
            // 特定の月のデータのみを更新する
            const monthKey = `${year}-${month}`;
            Object.keys(appState.shifts).forEach(key => {
                if (key.startsWith(monthKey)) delete appState.shifts[key];
            });
            Object.keys(appState.manualBreaks).forEach(key => {
                if (key.startsWith(monthKey)) delete appState.manualBreaks[key];
            });
             Object.keys(appState.manualShortages).forEach(key => {
                if (key.startsWith(monthKey)) delete appState.manualShortages[key];
            });

            appState.shifts = { ...appState.shifts, ...data.shifts };
            appState.manualBreaks = { ...appState.manualBreaks, ...data.manualBreaks };
            appState.manualShortages = { ...appState.manualShortages, ...data.manualShortages };
            
            if (!currentUser && appState.users.length > 0) { 
                const manager = appState.users.find(u => u.role === 'manager');
                currentUser = manager || { id: EMPLOYEE_VIEW_ID, name: '従業員ビュー', role: 'employee_viewer' };
                setupRoleSwitcher();
                updateUserInfo();
            }
            refreshCurrentView();
        } catch (error) {
            console.error("データ取得エラー:", error);
            alert("データの取得に失敗しました。ページをリロードしてみてください。");
        }
    }

    async function updateShift(shiftData) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/shift`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shiftData)
            });
            if (!response.ok) throw new Error('シフト更新APIエラー');
            return true;
        } catch (error) {
            console.error("シフト更新エラー:", error);
            alert("シフトの更新に失敗しました。");
            return false;
        }
    }
    
    async function updateManualData(date, breaks, shortages) {
        try {
            const payload = { date };
            if (breaks !== undefined) payload.breaks = breaks;
            if (shortages !== undefined) payload.shortages = shortages;

            const response = await fetch(`${API_BASE_URL}/api/manuals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('手動データ更新APIエラー');
            return true;
        } catch (error) {
            console.error("手動データ更新エラー:", error);
            alert("情報の更新に失敗しました。");
            return false;
        }
    }
    
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

    // --- UI制御 ---
    function setActiveNavButton(activeViewKey) {
        Object.keys(navButtons).forEach(key => {
            const button = navButtons[key];
            button.classList.remove('active', 'bg-blue-700', 'bg-purple-700', 'bg-teal-700');
            let baseColorClass = '';
            if (key === 'calendar') baseColorClass = 'bg-blue-600';
            else if (key === 'dailyChart') baseColorClass = 'bg-purple-600';
            else if (key === 'bulkShift') baseColorClass = 'bg-teal-600';
            button.classList.add(baseColorClass);
            if (key === activeViewKey) {
                button.classList.add('active');
                button.classList.remove(baseColorClass);
                if (key === 'calendar') button.classList.add('bg-blue-700');
                else if (key === 'dailyChart') button.classList.add('bg-purple-700');
                else if (key === 'bulkShift') button.classList.add('bg-teal-700');
            }
        });
    }

    async function switchView(viewKey) {
        Object.keys(mainViews).forEach(key => mainViews[key].classList.toggle('hidden', key !== viewKey));
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

    // --- DOM初期化 ---
    function initializeCalendarViewDOM() {
        calendarView.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h2 class="text-2xl font-semibold mb-2 md:mb-0 text-slate-700">イベント・個人シフト</h2>
                 <div class="flex items-center gap-2">
                    <label for="employeeHighlightSelect" class="text-sm font-medium text-slate-700">従業員ハイライト:</label>
                    <select id="employeeHighlightSelect" class="p-2 border border-slate-300 rounded-md shadow-sm text-sm"></select>
                </div>
                <div class="flex items-center">
                    <button id="prevMonthBtnInternal" class="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition"><i class="fas fa-angle-left mr-1"></i>前月</button>
                    <h3 id="calendarMonthYearInternal" class="text-xl font-semibold text-slate-700 w-40 text-center mx-2"></h3>
                    <button id="nextMonthBtnInternal" class="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">次月<i class="fas fa-angle-right ml-1"></i></button>
                </div>
            </div>
            <div class="grid grid-cols-7 gap-2 text-center font-semibold mb-2 text-sm">
                <div class="text-red-600">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div class="text-blue-600">土</div>
            </div>
            <div id="calendarGridInternal" class="grid grid-cols-7 gap-2"></div>`;
        
        document.getElementById('prevMonthBtnInternal').addEventListener('click', async () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() - 1); await fetchDataForMonth(calendarDisplayDate); });
        document.getElementById('nextMonthBtnInternal').addEventListener('click', async () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() + 1); await fetchDataForMonth(calendarDisplayDate); });
        document.getElementById('employeeHighlightSelect').addEventListener('change', (e) => {
            selectedEmployeeForHighlight = e.target.value ? parseInt(e.target.value) : null;
            renderCalendar();
        });
    }
    
    function initializeDailyChartViewDOM() {
         dailyChartView.innerHTML = `
            <h2 class="text-2xl font-semibold mb-4 text-slate-700">日別シフトグラフ</h2>
            <div class="flex items-center mb-4">
                <button id="prevDayChartBtnInternal" class="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-l-lg transition"><i class="fas fa-chevron-left"></i></button>
                <input type="date" id="currentChartDateInternal" class="border p-2 text-center rounded-none w-full text-lg">
                <button id="nextDayChartBtnInternal" class="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-r-lg transition"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="chart-container mb-6"><canvas id="dailyShiftChartInternal"></canvas></div>`; 

        document.getElementById('prevDayChartBtnInternal').addEventListener('click', async () => { chartDisplayDate.setDate(chartDisplayDate.getDate() - 1); document.getElementById('currentChartDateInternal').value = formatDate(chartDisplayDate); await fetchDataForMonth(chartDisplayDate); });
        document.getElementById('nextDayChartBtnInternal').addEventListener('click', async () => { chartDisplayDate.setDate(chartDisplayDate.getDate() + 1); document.getElementById('currentChartDateInternal').value = formatDate(chartDisplayDate); await fetchDataForMonth(chartDisplayDate); });
        document.getElementById('currentChartDateInternal').addEventListener('change', async (e) => { chartDisplayDate = new Date(e.target.value + "T00:00:00"); await fetchDataForMonth(chartDisplayDate); });
    }

    // --- UI描画関数 ---
    function renderCalendar() {
        const grid = document.getElementById('calendarGridInternal');
        const monthYearDisplay = document.getElementById('calendarMonthYearInternal');
        const employeeSelect = document.getElementById('employeeHighlightSelect');
        if (!grid || !monthYearDisplay || !employeeSelect) return; 

        grid.innerHTML = '';
        const year = calendarDisplayDate.getFullYear();
        const month = calendarDisplayDate.getMonth();
        monthYearDisplay.textContent = `${year}年 ${month + 1}月`;
        
        const currentSelected = employeeSelect.value;
        employeeSelect.innerHTML = `<option value="">全員表示</option>` + appState.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        employeeSelect.value = currentSelected;
        
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const startDayOfWeek = new Date(year, month, 1).getDay();

        for (let i = 0; i < startDayOfWeek; i++) {
            grid.insertAdjacentHTML('beforeend', `<div class="other-month"></div>`);
        }

        for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = formatDate(date);
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            if(isToday(date)) dayCell.classList.add('today');

            const shiftsForDay = appState.shifts[dateString] || [];
            if (selectedEmployeeForHighlight && shiftsForDay.some(s => s.userId === selectedEmployeeForHighlight)) {
                dayCell.classList.add('highlight-shift');
            }
            
            let cellContent = `<div class="calendar-day-header">${day}</div>`;
            const eventForDay = dummyEvents[dateString];
            if (eventForDay) {
                cellContent += `<div class="event-entry"><i class="${eventForDay.icon} mr-1"></i>${eventForDay.text}</div>`;
            }
            dayCell.innerHTML = cellContent;
            dayCell.addEventListener('click', () => showShiftDetailModal(date));
            grid.appendChild(dayCell);
        }
    }

    function renderDailyShiftChart() {
        const canvas = document.getElementById('dailyShiftChartInternal'); 
        if (!canvas) return;

        const dateString = formatDate(chartDisplayDate);
        const shiftsForDay = appState.shifts[dateString] || [];
        
        const chartDatasetData = [];
        const yLabels = []; 

        shiftsForDay.forEach(shift => {
            if (!yLabels.includes(shift.fullName)) yLabels.push(shift.fullName);
            const mainStartDate = parseTimeToDate(shift.time.split(' - ')[0], chartDisplayDate);
            const mainEndDate = parseTimeToDate(shift.time.split(' - ')[1], chartDisplayDate);
            const bgColor = shift.role === 'manager' ? 'rgba(250, 204, 21, 0.7)' : 'rgba(59, 130, 246, 0.7)';
            if (!mainStartDate || !mainEndDate) return;

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
        yLabels.sort();

        if (dailyShiftChartInstance) dailyShiftChartInstance.destroy();

        const todayForChart = new Date(chartDisplayDate);
        const chartMinTime = new Date(todayForChart); chartMinTime.setHours(9,0,0,0); 
        const chartMaxTime = new Date(todayForChart); chartMaxTime.setHours(21,0,0,0); 

        dailyShiftChartInstance = new Chart(canvas, {
            type: 'bar',
            data: { datasets: [{ label: '勤務時間', data: chartDatasetData, backgroundColor: chartDatasetData.map(d => d.bgColor), borderColor: chartDatasetData.map(d => d.bgColor.replace('0.7', '1')), borderWidth: 1, barPercentage: 0.6, categoryPercentage: 0.7 }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'hour', displayFormats: { hour: 'HH:mm' }, tooltipFormat: 'HH:mm' }, min: chartMinTime.getTime(), max: chartMaxTime.getTime(), title: { display: true, text: '時間' } },
                    y: { type: 'category', labels: yLabels, title: { display: true, text: '従業員' }, offset: true }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const dp = context.dataset.data[context.dataIndex]; const os = dp.originalShift;
                                let l = `${formatTime(new Date(context.raw[0]))} - ${formatTime(new Date(context.raw[1]))}`;
                                if (os.notes) l += ` (備考: ${os.notes})`; if (os.breakTime) l += ` (休憩: ${os.breakTime})`;
                                return l;
                            },
                            title: (items) => items[0].label
                        }
                    }, legend: { display: false }
                }
            }
        });
    }

    function renderBulkShiftTable() {
        const dateHeader = document.getElementById('bulkShiftTableDateHeader');
        const body = document.getElementById('bulkShiftTableBody');
        const breakRow = document.getElementById('bulkShiftTableBreakTimesRow');
        const shortageRow = document.getElementById('bulkShiftTableShortageHoursRow');
        if(!dateHeader || !body || !breakRow || !shortageRow) return;

        dateHeader.innerHTML = '';
        body.innerHTML = '';
        breakRow.innerHTML = '';
        shortageRow.innerHTML = ''; 

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
                if (currentUser.role === 'manager') {
                    rowHtml += `<td><input type="text" value="${shiftText}" data-user-id="${user.id}" data-date="${dateString}" placeholder="HH:mm-HH:mm"></td>`;
                } else { rowHtml += `<td>${shiftText}</td>`; }
            });
            rowHtml += '</tr>';
            body.innerHTML += rowHtml;
        });
        
        let breakTimesRowHtml = '<tr><th class="font-semibold">休憩</th>'; 
        days.forEach(dateString => {
            const manuallyEnteredBreak = appState.manualBreaks[dateString] || '';
            if (currentUser.role === 'manager') {
                 breakTimesRowHtml += `<td><input type="text" class="break-time-input" value="${manuallyEnteredBreak}" placeholder="例: 12-13, 15-15.5" data-date="${dateString}"></td>`;
            } else {
                breakTimesRowHtml += `<td class="break-time-display">${manuallyEnteredBreak || ''}</td>`; 
            }
        });
        breakTimesRowHtml += '</tr>';
        breakRow.innerHTML = breakTimesRowHtml;

        let shortageRowHtml = '<tr><th class="font-semibold">不足時間帯</th>'; 
        days.forEach(dateString => {
            const manuallyEnteredShortage = appState.manualShortages[dateString] || '';
            if (currentUser.role === 'manager') {
                 shortageRowHtml += `<td><input type="text" class="shortage-input" value="${manuallyEnteredShortage}" placeholder="例: 09:00-10:00" data-date="${dateString}"></td>`;
            } else {
                shortageRowHtml += `<td class="shortage-input">${manuallyEnteredShortage || ''}</td>`; 
            }
        });
        shortageRowHtml += '</tr>';
        shortageRow.innerHTML = shortageRowHtml;

        if (currentUser.role === 'manager') {
            body.querySelectorAll('input[type="text"]').forEach(input => input.addEventListener('change', handleBulkShiftInputChange));
            shortageRow.querySelectorAll('input[type="text"].shortage-input').forEach(input => input.addEventListener('change', handleManualShortageInputChange));
            breakRow.querySelectorAll('input[type="text"].break-time-input').forEach(input => input.addEventListener('change', handleManualBreakInputChange));
        }
        document.getElementById('bulkShiftMonthYear').textContent = `${bulkViewDisplayMonth.getFullYear()}年 ${bulkViewDisplayMonth.getMonth() + 1}月`;
        document.getElementById('toggleBulkShiftPeriodBtn').textContent = bulkViewIsFirstHalf ? '前半 (1-15日)' : `後半 (16-${lastDayOfMonth}日)`;
    }

    // --- イベントハンドラ ---
    function setupRoleSwitcher() {
        roleSwitcher.innerHTML = ''; 
        const managerUser = appState.users.find(u => u.role === 'manager');
        if (managerUser) {
             const optionManager = document.createElement('option');
             optionManager.value = managerUser.id;
             optionManager.textContent = `${managerUser.name} (店長)`;
             roleSwitcher.appendChild(optionManager);
        }
        const optionEmployeeView = document.createElement('option');
        optionEmployeeView.value = EMPLOYEE_VIEW_ID; 
        optionEmployeeView.textContent = "従業員ビュー";
        roleSwitcher.appendChild(optionEmployeeView);

        roleSwitcher.value = currentUser.id;

        roleSwitcher.addEventListener('change', (e) => {
            const selectedId = parseInt(e.target.value);
            if (selectedId === EMPLOYEE_VIEW_ID) {
                currentUser = { id: EMPLOYEE_VIEW_ID, name: '従業員ビュー', role: 'employee_viewer' }; 
            } else {
                currentUser = appState.users.find(u => u.id === selectedId);
            }
            updateUserInfo();
            refreshCurrentView();
        });
    }

    async function handleManualShortageInputChange(event) {
        const input = event.target;
        const date = input.dataset.date;
        const shortages = input.value.trim();
        await updateManualData(date, undefined, shortages);
        appState.manualShortages[date] = shortages; 
    }
    async function handleManualBreakInputChange(event) {
        const input = event.target;
        const date = input.dataset.date;
        const breaks = input.value.trim();
        await updateManualData(date, breaks, undefined);
        appState.manualBreaks[date] = breaks;
    }
    async function handleBulkShiftInputChange(event) {
        const input = event.target;
        const userId = parseInt(input.dataset.userId);
        const date = input.dataset.date;
        const time = input.value.trim();
        const existingShift = (appState.shifts[date] || []).find(s => s.userId === userId);
        const shiftData = { userId, date, time, breakTime: existingShift?.breakTime, notes: existingShift?.notes };
        
        if (await updateShift(shiftData)) {
            if (!appState.shifts[date]) appState.shifts[date] = [];
            let shiftIndex = appState.shifts[date].findIndex(s => s.userId === userId);
            if(time) {
                const user = appState.users.find(u => u.id === userId);
                const newShiftData = { ...shiftData, fullName: user.name, role: user.role };
                if (shiftIndex > -1) appState.shifts[date][shiftIndex] = newShiftData;
                else appState.shifts[date].push(newShiftData);
            } else {
                if (shiftIndex > -1) appState.shifts[date].splice(shiftIndex, 1);
            }
            renderBulkShiftTable();
        }
    }
    
    document.getElementById('prevMonthBulkBtn').addEventListener('click', async () => { bulkViewDisplayMonth.setMonth(bulkViewDisplayMonth.getMonth() - 1); await fetchDataForMonth(bulkViewDisplayMonth); });
    document.getElementById('nextMonthBulkBtn').addEventListener('click', async () => { bulkViewDisplayMonth.setMonth(bulkViewDisplayMonth.getMonth() + 1); await fetchDataForMonth(bulkViewDisplayMonth); });
    document.getElementById('toggleBulkShiftPeriodBtn').addEventListener('click', () => { bulkViewIsFirstHalf = !bulkViewIsFirstHalf; renderBulkShiftTable(); });
    shiftDetailModal.addEventListener('click', (event) => { if (event.target === shiftDetailModal) shiftDetailModal.style.display = 'none'; });

    // --- 初期化 ---
    async function initializeApp() {
        initializeCalendarViewDOM();
        initializeDailyChartViewDOM(); 
        await fetchDataForMonth(new Date(2025, 5, 1));
        switchView('calendar');
    }
    
    initializeApp();
});
