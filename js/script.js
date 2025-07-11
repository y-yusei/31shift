document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = 'https://my-shift-backend.y-yusei.workers.dev'; 
    
    let currentUser = null; 
    let appInitialized = false;

    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    const loginIdInput = document.getElementById('loginId');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginError = document.getElementById('loginError');
    
    async function handleLogin() {
        const id = loginIdInput.value.toLowerCase();
        const password = loginPasswordInput.value;
        loginError.textContent = '';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: id, password: password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                currentUser = data.user;
                loginScreen.classList.add('hidden');
                appContainer.classList.remove('hidden');
                if (!appInitialized) {
                    initializeApp();
                    appInitialized = true;
                } else {
                    document.getElementById('currentUserInfo').innerHTML = `ログイン中: <span class="font-bold">${currentUser.name}</span>`;
                    document.getElementById('showCalendarViewBtn').click();
                }
            } else {
                loginError.textContent = data.message || 'IDまたはパスワードが正しくありません。';
            }
        } catch (error) {
            console.error("ログインエラー:", error);
            loginError.textContent = 'ログイン処理中にエラーが発生しました。サーバーが起動しているか確認してください。';
        }
    }

    function handleLogout() {
        currentUser = null;
        appInitialized = false;
        appContainer.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginPasswordInput.value = '';
        location.reload(); 
    }
    
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    loginPasswordInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });

    async function initializeApp() {
        let dailyShiftChartInstance = null;
        let appState = { users: [], shifts: {}, manualBreaks: {}, manualShortages: {} };
        
        const mainViews = { calendar: document.getElementById('calendarView'), dailyChart: document.getElementById('dailyChartView'), bulkShift: document.getElementById('bulkShiftView') };
        const navButtons = { calendar: document.getElementById('showCalendarViewBtn'), dailyChart: document.getElementById('showDailyChartViewBtn'), bulkShift: document.getElementById('showBulkShiftViewBtn') };
        const shiftDetailModal = document.getElementById('shiftDetailModal');
        const modalContent = document.getElementById('modalContent');
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
        const saveBulkShiftBtn = document.getElementById('saveBulkShiftBtn');

        let calendarDisplayDate = new Date(2025, 5, 1);
        let chartDisplayDate = new Date();
        let bulkViewDisplayMonth = new Date(2025, 5, 1);
        let bulkViewIsFirstHalf = true;
        let selectedEmployeeForHighlight = null;
        
        const dummyEvents = { 
            '2025-06-01': { text: '特売日', icon: 'fas fa-tags' },
            '2025-06-15': { text: '棚卸し', icon: 'fas fa-boxes-stacked' },
        };

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
                Object.keys(appState.manualBreaks).forEach(key => { if (key.startsWith(monthKey)) delete appState.manualBreaks[key]; });
                Object.keys(appState.manualShortages).forEach(key => { if (key.startsWith(monthKey)) delete appState.manualShortages[key]; });

                appState.shifts = { ...appState.shifts, ...data.shifts };
                appState.manualBreaks = { ...appState.manualBreaks, ...data.manualBreaks };
                appState.manualShortages = { ...appState.manualShortages, ...data.manualShortages };
                
                updateUserInfo();
                refreshCurrentView();
            } catch (error) {
                console.error("データ取得エラー:", error);
                alert("APIサーバーへの接続に失敗しました。");
            }
        }

        async function handleBulkUpdate() {
            const shiftInputs = bulkShiftTable.querySelectorAll('tbody input[type="text"]');
            const breakInputs = bulkShiftTable.querySelectorAll('tfoot #bulkShiftTableBreakTimesRow input');
            const shortageInputs = bulkShiftTable.querySelectorAll('tfoot #bulkShiftTableShortageHoursRow input');

            const shiftsToUpdate = [];
            shiftInputs.forEach(input => {
                shiftsToUpdate.push({
                    userId: parseInt(input.dataset.userId),
                    date: input.dataset.date,
                    time: input.value.trim()
                });
            });

            const breaksToUpdate = {};
            breakInputs.forEach(input => {
                breaksToUpdate[input.dataset.date] = input.value.trim();
            });

            const shortagesToUpdate = {};
            shortageInputs.forEach(input => {
                shortagesToUpdate[input.dataset.date] = input.value.trim();
            });

            const payload = {
                shifts: shiftsToUpdate,
                manualBreaks: breaksToUpdate,
                manualShortages: shortagesToUpdate
            };

            try {
                const response = await fetch(`${API_BASE_URL}/api/bulk-update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error('一括更新APIエラー');
                }
                alert('シフトを保存しました。');
                await fetchDataForMonth(bulkViewDisplayMonth);
            } catch (error) {
                console.error("一括更新エラー:", error);
                alert("シフトの保存に失敗しました。");
            }
        }
        
        function updateUserInfo() {
             currentUserInfo.innerHTML = `ログイン中: <span class="font-bold">${currentUser.name}</span>`;
        }

        function setActiveNavButton(activeViewKey) {
            Object.keys(navButtons).forEach(key => {
                const button = navButtons[key];
                button.classList.remove('bg-blue-700', 'bg-purple-700', 'bg-teal-700', 'active');
                let baseColor = key === 'calendar' ? 'bg-blue-600' : key === 'dailyChart' ? 'bg-purple-600' : 'bg-teal-600';
                button.classList.add(baseColor);
                if (key === activeViewKey) {
                    button.classList.remove(baseColor);
                    button.classList.add(key === 'calendar' ? 'bg-blue-700' : key === 'dailyChart' ? 'bg-purple-700' : 'bg-teal-700', 'active');
                }
            });
        }

        async function switchView(viewKey) {
            Object.keys(mainViews).forEach(key => mainViews[key].classList.toggle('hidden', key !== viewKey));
            setActiveNavButton(viewKey);
            
            let targetDate;
            if (viewKey === 'calendar') targetDate = calendarDisplayDate;
            else if (viewKey === 'dailyChart') {
                chartDisplayDate = new Date();
                targetDate = chartDisplayDate;
                currentChartDateInput.value = formatDate(chartDisplayDate); 
            }
            else if (viewKey === 'bulkShift') targetDate = bulkViewDisplayMonth;
            
            await fetchDataForMonth(targetDate);
        }
        
        function refreshCurrentView() {
            if (!mainViews.calendar.classList.contains('hidden')) renderCalendar();
            else if (!mainViews.dailyChart.classList.contains('hidden')) renderDailyShiftChart();
            else if (!mainViews.bulkShift.classList.contains('hidden')) renderBulkShiftTable();
        }

        function renderCalendar() { /* (実装は変更なし) */ }
        function renderDailyShiftChart() { /* (実装は変更なし) */ }
        function renderBulkShiftTable() { /* (実装は変更なし) */ }
        async function showShiftDetailModal(date) { /* (実装は変更なし) */ }
        
        // --- イベントリスナー設定 ---
        navButtons.calendar.addEventListener('click', () => switchView('calendar'));
        navButtons.dailyChart.addEventListener('click', () => switchView('dailyChart'));
        navButtons.bulkShift.addEventListener('click', () => switchView('bulkShift'));
        saveBulkShiftBtn.addEventListener('click', handleBulkUpdate);

        prevMonthBtn.addEventListener('click', async () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() - 1); await fetchDataForMonth(calendarDisplayDate); });
        nextMonthBtn.addEventListener('click', async () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() + 1); await fetchDataForMonth(calendarDisplayDate); });
        employeeHighlightSelect.addEventListener('change', (e) => { selectedEmployeeForHighlight = e.target.value ? parseInt(e.target.value) : null; renderCalendar();});
        prevDayChartBtn.addEventListener('click', async () => { chartDisplayDate.setDate(chartDisplayDate.getDate() - 1); currentChartDateInput.value = formatDate(chartDisplayDate); await fetchDataForMonth(chartDisplayDate); });
        nextDayChartBtn.addEventListener('click', async () => { chartDisplayDate.setDate(chartDisplayDate.getDate() + 1); currentChartDateInput.value = formatDate(chartDisplayDate); await fetchDataForMonth(chartDisplayDate); });
        currentChartDateInput.addEventListener('change', async (e) => { chartDisplayDate = new Date(e.target.value + "T00:00:00"); await fetchDataForMonth(chartDisplayDate); });
        prevMonthBulkBtn.addEventListener('click', async () => { bulkViewDisplayMonth.setMonth(bulkViewDisplayMonth.getMonth() - 1); await fetchDataForMonth(bulkViewDisplayMonth); });
        nextMonthBulkBtn.addEventListener('click', async () => { bulkViewDisplayMonth.setMonth(bulkViewDisplayMonth.getMonth() + 1); await fetchDataForMonth(bulkViewDisplayMonth); });
        toggleBulkShiftPeriodBtn.addEventListener('click', () => { bulkViewIsFirstHalf = !bulkViewIsFirstHalf; renderBulkShiftTable(); });
        shiftDetailModal.addEventListener('click', (event) => { if (event.target === shiftDetailModal) shiftDetailModal.style.display = 'none'; });
        
        // --- 初期化処理 ---
        updateUserInfo();
        switchView('calendar');
    }
});
