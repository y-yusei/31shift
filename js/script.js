document.addEventListener('DOMContentLoaded', function() {
    // --- ★★★ 重要 ★★★ ---
    // wrangler deploy後に表示されるWorkerのURLに書き換えてください
    const API_BASE_URL = 'https://my-shift-backend.tamago-2483.workers.dev'; 
    
    // アプリケーションの状態を管理するオブジェクト
    let appState = {
        users: [],
        shifts: {},
        manualBreaks: {},
        manualShortages: {}
    };

    let dailyShiftChartInstance = null;
    let currentUser = null; 

    // DOM要素
    const calendarView = document.getElementById('calendarView');
    const dailyChartView = document.getElementById('dailyChartView');
    const bulkShiftView = document.getElementById('bulkShiftView');
    const navButtons = {
        calendar: document.getElementById('showCalendarViewBtn'),
        dailyChart: document.getElementById('showDailyChartViewBtn'),
        bulkShift: document.getElementById('showBulkShiftViewBtn'),
    };
    const mainViews = { calendar: calendarView, dailyChart: dailyChartView, bulkShift: bulkShiftView };
    const bulkShiftMonthYearDisplay = document.getElementById('bulkShiftMonthYear');
    const prevMonthBulkBtn = document.getElementById('prevMonthBulkBtn');
    const nextMonthBulkBtn = document.getElementById('nextMonthBulkBtn');
    const toggleBulkShiftPeriodBtn = document.getElementById('toggleBulkShiftPeriodBtn');
    const bulkShiftTableDateHeader = document.getElementById('bulkShiftTableDateHeader');
    const bulkShiftTableBody = document.getElementById('bulkShiftTableBody');
    const bulkShiftTableBreakTimesRow = document.getElementById('bulkShiftTableBreakTimesRow');
    const bulkShiftTableShortageHoursRow = document.getElementById('bulkShiftTableShortageHoursRow');
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

    // --- データ取得 ---
    async function fetchDataForMonth(date) {
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        try {
            const response = await fetch(`${API_BASE_URL}/api/data?month=${year}-${month}`);
            if (!response.ok) {
                throw new Error(`APIからのデータ取得に失敗しました: ${response.statusText}`);
            }
            const data = await response.json();
            appState = { ...appState, ...data };

            if (!currentUser) { // 初回ロード時
                const manager = appState.users.find(u => u.role === 'manager');
                currentUser = manager || { id: EMPLOYEE_VIEW_ID, name: '従業員ビュー', role: 'employee_viewer' };
            }

            // データ取得後にUIを更新
            setupRoleSwitcher();
            updateUserInfo();
            refreshCurrentView();
        } catch (error) {
            console.error("データの取得に失敗しました:", error);
            alert("データの取得に失敗しました。");
        }
    }

    function refreshCurrentView() {
        if (!mainViews.calendar.classList.contains('hidden')) renderCalendar();
        else if (!mainViews.dailyChart.classList.contains('hidden')) renderDailyShiftChart();
        else if (!mainViews.bulkShift.classList.contains('hidden')) renderBulkShiftTable();
    }

    // --- UIの描画 ---
    // (renderCalendar, renderDailyShiftChart, renderBulkShiftTableなどの描画関数は
    //  appStateからデータを読み取るように変更されていますが、ロジック自体はほぼ同じです)
    
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
        Object.keys(mainViews).forEach(key => {
            mainViews[key].classList.toggle('hidden', key !== viewKey);
        });
        setActiveNavButton(viewKey);
        
        let targetDate;
        if (viewKey === 'calendar') targetDate = calendarDisplayDate;
        else if (viewKey === 'dailyChart') targetDate = chartDisplayDate;
        else if (viewKey === 'bulkShift') targetDate = bulkViewDisplayMonth;
        
        // 必要な月のデータがなければ取得
        const currentMonthKey = `${targetDate.getFullYear()}-${('0' + (targetDate.getMonth() + 1)).slice(-2)}`;
        const monthDataExists = Object.keys(appState.shifts).some(date => date.startsWith(currentMonthKey));

        if (!monthDataExists) {
            await fetchDataForMonth(targetDate);
        } else {
             refreshCurrentView();
        }
    }

    function initializeCalendarViewDOM() {
        calendarView.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-4">
                <h2 class="text-2xl font-semibold mb-2 md:mb-0 text-slate-700">イベント・個人シフトカレンダー</h2>
                 <div class="flex items-center gap-2">
                    <label for="employeeHighlightSelect" class="text-sm font-medium text-slate-700">従業員ハイライト:</label>
                    <select id="employeeHighlightSelect" class="p-2 border border-slate-300 rounded-md shadow-sm text-sm">
                    </select>
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
            <div class="chart-container mb-6">
                <canvas id="dailyShiftChartInternal"></canvas>
            </div>`; 

        document.getElementById('prevDayChartBtnInternal').addEventListener('click', async () => { chartDisplayDate.setDate(chartDisplayDate.getDate() - 1); document.getElementById('currentChartDateInternal').value = formatDate(chartDisplayDate); await fetchDataForMonth(chartDisplayDate); });
        document.getElementById('nextDayChartBtnInternal').addEventListener('click', async () => { chartDisplayDate.setDate(chartDisplayDate.getDate() + 1); document.getElementById('currentChartDateInternal').value = formatDate(chartDisplayDate); await fetchDataForMonth(chartDisplayDate); });
        document.getElementById('currentChartDateInternal').addEventListener('change', async (e) => { chartDisplayDate = new Date(e.target.value + "T00:00:00"); await fetchDataForMonth(chartDisplayDate); });
    }

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

    function updateUserInfo() {
         currentUserInfo.innerHTML = `表示モード: <span class="font-bold">${currentUser.name}</span>`;
    }

    function renderCalendar() {
        const grid = document.getElementById('calendarGridInternal');
        const monthYearDisplay = document.getElementById('calendarMonthYearInternal');
        const employeeSelect = document.getElementById('employeeHighlightSelect');
        if (!grid || !monthYearDisplay || !employeeSelect) return;

        grid.innerHTML = '';
        monthYearDisplay.textContent = `${calendarDisplayDate.getFullYear()}年 ${calendarDisplayDate.getMonth() + 1}月`;
        
        // ハイライト用ドロップダウンの中身を更新
        const currentSelected = employeeSelect.value;
        employeeSelect.innerHTML = `<option value="">全員表示</option>` + appState.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        employeeSelect.value = currentSelected;

        // 以下、描画ロジック (appState.shifts と appState.events を使用)
        // ... (以前のコードとほぼ同じだが、dummyShifts/dummyEventsの代わりにappStateを参照)
    }

    function renderDailyShiftChart() {
        // ... (以前のコードとほぼ同じだが、dummyShiftsの代わりにappState.shiftsを参照)
    }
    
    function renderBulkShiftTable() {
        // ... (以前のコードとほぼ同じだが、dummyShifts/manual...の代わりにappStateを参照)
    }
    
    // データ更新系の関数はすべてAPIを叩くように変更
    async function handleBulkShiftInputChange(event) {
        // ...
        // await fetch(`${API_BASE_URL}/api/shift`, { method: 'POST', ... });
        // await fetchDataForMonth(bulkViewDisplayMonth);
    }

    async function handleManualShortageInputChange(event) {
        // ...
        // await fetch(`${API_BASE_URL}/api/manuals`, { method: 'POST', ... });
        // appState.manualShortages[dateString] = input.value.trim(); // ローカルも更新
    }
    // ... 他のイベントハンドラも同様にAPIを叩くように修正 ...

    // --- 初期化 ---
    async function initializeApp() {
        initializeCalendarViewDOM();
        initializeDailyChartViewDOM();
        await fetchDataForMonth(new Date()); // 初期データを取得
        switchView('calendar');
    }

    initializeApp();
});
// 注: このJSファイルは大幅に簡略化しています。
// 実際には、前のバージョンの描画ロジックと、API通信ロジックを組み合わせる必要があります。
// この例では、全体の構造とAPI呼び出しの基本的な流れを示しています。
