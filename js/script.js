document.addEventListener('DOMContentLoaded', function() {
    let dailyShiftChartInstance = null;

    const calendarView = document.getElementById('calendarView');
    const dailyChartView = document.getElementById('dailyChartView');
    const bulkShiftView = document.getElementById('bulkShiftView');

    const navButtons = {
        calendar: document.getElementById('showCalendarViewBtn'),
        dailyChart: document.getElementById('showDailyChartViewBtn'),
        bulkShift: document.getElementById('showBulkShiftViewBtn'),
    };
    const mainViews = {
        calendar: calendarView,
        dailyChart: dailyChartView,
        bulkShift: bulkShiftView,
    };
    
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

    const users = [
        { id: 1, name: '田中一郎', role: 'manager' },
        { id: 2, name: '佐藤花子', role: 'employee' },
        { id: 3, name: '鈴木三郎', role: 'employee' },
        { id: 4, name: '山田太郎', role: 'employee' },
        { id: 5, name: '高橋美咲', role: 'employee' },
        { id: 6, name: '伊藤健太', role: 'employee' },
        { id: 7, name: '渡辺直子', role: 'employee' },
        { id: 8, name: '山本敬子', role: 'employee' },
        { id: 9, name: '中村修平', role: 'employee' },
        { id: 10, name: '小林明美', role: 'employee' },
        { id: 11, name: '加藤大輔', role: 'employee' },
    ];
    const EMPLOYEE_VIEW_ID = 0; 

    let currentUser = users.find(u => u.role === 'manager'); 
    let calendarDisplayDate = new Date(2025, 5, 1); 
    let chartDisplayDate = new Date(2025, 5, 1);    
    let bulkViewDisplayMonth = new Date(2025, 5, 1); 
    let bulkViewIsFirstHalf = true; 
    let selectedEmployeeForHighlight = null;

    let manualShortages = {}; 
    let manualBreaks = {}; 

    const dummyShifts = {
         '2025-05-30': [ { userId: 4, fullName: '山田太郎', time: '09:00 - 17:00', breakTime: '12:00 - 13:00', role: 'employee', notes: '棚卸し準備' } ],
         '2025-05-31': [ { userId: 4, fullName: '山田太郎', time: '09:00 - 17:00', breakTime: '12:00 - 13:00', role: 'employee', notes: '棚卸し' } ],
         '2025-06-01': [ 
             { userId: 1, fullName: '田中一郎', time: '09:00 - 18:00', breakTime: '13:00 - 14:00', role: 'manager', notes: '週末対応' },
             { userId: 2, fullName: '佐藤花子', time: '10:00 - 19:00', breakTime: '14:00 - 15:00', role: 'employee', notes: 'レジ応援' },
             { userId: 5, fullName: '高橋美咲', time: '12:00 - 21:00', role: 'employee', notes: '' },
         ],
         '2025-06-02': [ 
             { userId: 3, fullName: '鈴木三郎', time: '09:00 - 17:00', breakTime: '12:00 - 13:00', role: 'employee', notes: '早番' },
             { userId: 6, fullName: '伊藤健太', time: '13:00 - 21:00', role: 'employee', notes: '遅番' },
         ],
        '2025-06-03': [ 
             { userId: 4, fullName: '山田太郎', time: '09:00 - 15:00', role: 'employee', notes: '' },
             { userId: 7, fullName: '渡辺直子', time: '15:00 - 21:00', breakTime: '17:30 - 18:00', role: 'employee', notes: '' },
         ],
         '2025-06-04': [ 
             { userId: 1, fullName: '田中一郎', time: '10:00 - 19:00', breakTime: '14:00 - 15:00', role: 'manager', notes: 'ミーティング' },
             { userId: 8, fullName: '山本敬子', time: '09:00 - 17:00', breakTime: '13:00 - 13:45', role: 'employee', notes: '' },
             { userId: 9, fullName: '中村修平', time: '11:00 - 20:00', role: 'employee', notes: '研修' },
         ],
         '2025-06-05': [
            { userId: 5, fullName: '高橋美咲', time: '09:00 - 18:00', breakTime: '12:00 - 13:00', role: 'employee', notes: '商品陳列' },
            { userId: 11, fullName: '加藤大輔', time: '12:00 - 21:00', breakTime: '16:00 - 17:00', role: 'employee', notes: '' },
         ],
         '2025-06-06': [ 
             { userId: 2, fullName: '佐藤花子', time: '13:00 - 21:00', breakTime: '17:00 - 17:30', role: 'employee', notes: '' },
             { userId: 10, fullName: '小林明美', time: '09:00 - 18:00', breakTime: '12:00 - 13:00', role: 'employee', notes: '新人教育' },
         ],
         '2025-06-07': [ 
             { userId: 1, fullName: '田中一郎', time: '09:00 - 18:00', breakTime: '12:30 - 13:30', role: 'manager', notes: '全体MTG' }, 
             { userId: 2, fullName: '佐藤花子', time: '09:00 - 17:00', role: 'employee', notes: '早番リーダー' },
             { userId: 4, fullName: '山田太郎', time: '13:00 - 21:00', breakTime: '17:00 - 17:45', role: 'employee', notes: '遅番' },
             { userId: 11, fullName: '加藤大輔', time: '10:00 - 16:00', role: 'employee', notes: 'ヘルプ' }
         ],
         '2025-06-08': [
            { userId: 3, fullName: '鈴木三郎', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: ''},
            { userId: 6, fullName: '伊藤健太', time: '09:00 - 17:00', breakTime: '12:00-13:00', role: 'employee', notes: ''}
         ],
         '2025-06-09': [
            { userId: 5, fullName: '高橋美咲', time: '12:00 - 21:00', breakTime: '16:00-17:00', role: 'employee', notes: ''},
            { userId: 7, fullName: '渡辺直子', time: '09:00 - 18:00', breakTime: '13:00-14:00', role: 'employee', notes: ''}
         ],
         '2025-06-10': [
            { userId: 8, fullName: '山本敬子', time: '11:00 - 20:00', breakTime: '15:00-16:00', role: 'employee', notes: ''},
            { userId: 9, fullName: '中村修平', time: '09:00 - 17:00', breakTime: '12:00-13:00', role: 'employee', notes: ''}
         ],
         '2025-06-11': [
            { userId: 1, fullName: '田中一郎', time: '09:00 - 17:00', role: 'manager', notes: '事務作業'},
            { userId: 10, fullName: '小林明美', time: '13:00 - 21:00', breakTime: '17:00-17:30', role: 'employee', notes: ''}
         ],
         '2025-06-12': [
            { userId: 11, fullName: '加藤大輔', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: ''},
            { userId: 2, fullName: '佐藤花子', time: '09:00 - 17:00', breakTime: '12:00-13:00', role: 'employee', notes: ''}
         ],
         '2025-06-13': [
            { userId: 3, fullName: '鈴木三郎', time: '12:00 - 21:00', breakTime: '16:00-17:00', role: 'employee', notes: ''},
            { userId: 6, fullName: '伊藤健太', time: '09:00 - 18:00', breakTime: '13:00-14:00', role: 'employee', notes: ''}
         ],
         '2025-06-14': [
            { userId: 4, fullName: '山田太郎', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: '週末早番'},
            { userId: 7, fullName: '渡辺直子', time: '12:00 - 21:00', role: 'employee', notes: '週末遅番'}
         ],
         '2025-06-15': [ 
            { userId: 5, fullName: '高橋美咲', time: '09:00 - 18:00', breakTime: '13:00 - 14:00', role: 'employee', notes: '' },
            { userId: 8, fullName: '山本敬子', time: '12:00 - 21:00', role: 'employee', notes: 'イベント準備' },
         ],
         '2025-06-16': [ 
             { userId: 3, fullName: '鈴木三郎', time: '09:00 - 12:00', role: 'employee', notes: '' },
             { userId: 7, fullName: '渡辺直子', time: '14:00 - 20:00', breakTime: '17:00 - 17:30', role: 'employee', notes: '' },
             { userId: 9, fullName: '中村修平', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: ''},
         ], 
         '2025-06-17': [ 
             { userId: 4, fullName: '山田太郎', time: '17:00 - 21:00', breakTime: '18:00-18:30', role: 'employee', notes: '' },
             { userId: 8, fullName: '山本敬子', time: '09:00 - 16:00', breakTime: '12:00 - 12:45', role: 'employee', notes: '' },
             { userId: 10, fullName: '小林明美', time: '10:00 - 18:00', breakTime: '13:00-14:00', role: 'employee', notes: ''},
        ],
        '2025-06-18': [
            { userId: 1, fullName: '田中一郎', time: '09:00 - 17:00', role: 'manager', notes: '棚卸し指示'},
            { userId: 11, fullName: '加藤大輔', time: '11:00 - 20:00', breakTime: '15:00-16:00', role: 'employee', notes: ''}
        ],
        '2025-06-19': [
            { userId: 2, fullName: '佐藤花子', time: '09:00 - 18:00', breakTime: '13:00-14:00', role: 'employee', notes: ''},
            { userId: 5, fullName: '高橋美咲', time: '12:00 - 21:00', breakTime: '16:00-17:00', role: 'employee', notes: ''}
        ],
        '2025-06-20': [ 
            { userId: 1, fullName: '田中一郎', time: '終日', role: 'manager', notes: '出張'},
            { userId: 9, fullName: '中村修平', time: '09:00 - 18:00', breakTime: '13:00-14:00', role: 'employee', notes: '店長不在対応'},
            { userId: 10, fullName: '小林明美', time: '12:00 - 21:00', breakTime: '16:00-16:30, 19:00-19:15', role: 'employee', notes: ''}, 
        ],
        '2025-06-21': [
            { userId: 3, fullName: '鈴木三郎', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: ''},
            { userId: 6, fullName: '伊藤健太', time: '12:00 - 21:00', breakTime: '16:00-17:00', role: 'employee', notes: ''}
        ],
        '2025-06-22': [
            { userId: 4, fullName: '山田太郎', time: '09:00 - 18:00', breakTime: '13:00-14:00', role: 'employee', notes: '週末応援'},
            { userId: 7, fullName: '渡辺直子', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: ''}
        ],
        '2025-06-23': [
            { userId: 8, fullName: '山本敬子', time: '12:00 - 21:00', breakTime: '16:00-17:00', role: 'employee', notes: ''},
            { userId: 11, fullName: '加藤大輔', time: '09:00 - 17:00', breakTime: '12:00-13:00', role: 'employee', notes: ''}
        ],
        '2025-06-24': [
            { userId: 5, fullName: '高橋美咲', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: ''},
            { userId: 9, fullName: '中村修平', time: '11:00 - 20:00', breakTime: '15:00-16:00', role: 'employee', notes: ''}
        ],
        '2025-06-25': [
            { userId: 1, fullName: '田中一郎', time: '09:00 - 18:00', breakTime: '13:00-14:00', role: 'manager', notes: '月末処理'},
            { userId: 2, fullName: '佐藤花子', time: '12:00 - 21:00', breakTime: '16:00-17:00', role: 'employee', notes: ''}
        ],
        '2025-06-26': [
            { userId: 6, fullName: '伊藤健太', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: ''},
            { userId: 10, fullName: '小林明美', time: '09:00 - 17:00', breakTime: '12:00-13:00', role: 'employee', notes: ''}
        ],
        '2025-06-27': [
            { userId: 3, fullName: '鈴木三郎', time: '13:00 - 21:00', breakTime: '17:00-17:30', role: 'employee', notes: ''},
            { userId: 7, fullName: '渡辺直子', time: '09:00 - 18:00', breakTime: '13:00-14:00', role: 'employee', notes: ''}
        ],
        '2025-06-28': [
            { userId: 4, fullName: '山田太郎', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: '月末週末'},
            { userId: 8, fullName: '山本敬子', time: '12:00 - 21:00', breakTime: '16:00-17:00', role: 'employee', notes: ''}
        ],
        '2025-06-29': [
            { userId: 5, fullName: '高橋美咲', time: '09:00 - 18:00', breakTime: '13:00-14:00', role: 'employee', notes: ''},
            { userId: 11, fullName: '加藤大輔', time: '10:00 - 19:00', breakTime: '14:00-15:00', role: 'employee', notes: ''}
        ],
        '2025-06-30': [
            { userId: 1, fullName: '田中一郎', time: '09:00 - 17:00', role: 'manager', notes: '月末締め'},
            { userId: 9, fullName: '中村修平', time: '12:00 - 21:00', breakTime: '16:00-17:00', role: 'employee', notes: ''}
        ]
    };
    const dummyEvents = {
        '2025-06-01': { text: '特売日', icon: 'fas fa-tags' },
        '2025-06-04': { text: '店長会議', icon: 'fas fa-users' },
        '2025-06-15': { text: '棚卸し', icon: 'fas fa-boxes-stacked' },
        '2025-06-20': { text: '新商品発売', icon: 'fas fa-gift' },
    };
    
    // 以下、関数の実装は変更なし...
    // ...
    // script.jsの残りの部分は、前のバージョンから変更ありません。
    // ...
    
    // (前のバージョンのJavaScriptコードの残りをここに貼り付け)

    // 上記のdummyShiftsデータを反映させるため、
    // ここから下のJavaScriptコードは、一つ前のバージョンから変更ありません。

    function formatTime(date) {
        return `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`;
    }

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

    function switchView(viewKey) {
        Object.keys(mainViews).forEach(key => {
            mainViews[key].classList.toggle('hidden', key !== viewKey);
        });
        setActiveNavButton(viewKey);
        
        if (viewKey === 'calendar' && !document.getElementById('calendarGridInternal')) initializeCalendarViewDOM();
        if (viewKey === 'calendar') renderCalendar();
        else if (viewKey === 'dailyChart') {
            if(!document.getElementById('currentChartDateInternal')) initializeDailyChartViewDOM();
            document.getElementById('currentChartDateInternal').value = formatDate(chartDisplayDate);
            renderDailyShiftChart();
        }
        else if (viewKey === 'bulkShift') {
             bulkShiftMonthYearDisplay.textContent = `${bulkViewDisplayMonth.getFullYear()}年 ${bulkViewDisplayMonth.getMonth() + 1}月`;
             renderBulkShiftTable();
        }
    }
    
    navButtons.calendar.addEventListener('click', () => switchView('calendar'));
    navButtons.dailyChart.addEventListener('click', () => switchView('dailyChart'));
    navButtons.bulkShift.addEventListener('click', () => switchView('bulkShift'));

    function initializeCalendarViewDOM() {
        calendarView.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-4">
                <h2 class="text-2xl font-semibold mb-2 md:mb-0 text-slate-700">イベント・個人シフトカレンダー</h2>
                 <div class="flex items-center gap-2">
                    <label for="employeeHighlightSelect" class="text-sm font-medium text-slate-700">従業員ハイライト:</label>
                    <select id="employeeHighlightSelect" class="p-2 border border-slate-300 rounded-md shadow-sm text-sm">
                        <option value="">全員表示</option>
                        ${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
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
        
        document.getElementById('prevMonthBtnInternal').addEventListener('click', () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() - 1); renderCalendar(); });
        document.getElementById('nextMonthBtnInternal').addEventListener('click', () => { calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() + 1); renderCalendar(); });
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
            </div>
            `; 

        document.getElementById('prevDayChartBtnInternal').addEventListener('click', () => { chartDisplayDate.setDate(chartDisplayDate.getDate() - 1); document.getElementById('currentChartDateInternal').value = formatDate(chartDisplayDate); renderDailyShiftChart(); });
        document.getElementById('nextDayChartBtnInternal').addEventListener('click', () => { chartDisplayDate.setDate(chartDisplayDate.getDate() + 1); document.getElementById('currentChartDateInternal').value = formatDate(chartDisplayDate); renderDailyShiftChart(); });
        document.getElementById('currentChartDateInternal').addEventListener('change', (e) => { chartDisplayDate = new Date(e.target.value + "T00:00:00"); renderDailyShiftChart(); });
    }

    function setupRoleSwitcher() {
        roleSwitcher.innerHTML = ''; 
        const managerUser = users.find(u => u.role === 'manager');
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

        roleSwitcher.value = managerUser ? managerUser.id : EMPLOYEE_VIEW_ID;

        roleSwitcher.addEventListener('change', (e) => {
            const selectedId = parseInt(e.target.value);
            if (selectedId === EMPLOYEE_VIEW_ID) {
                currentUser = { id: EMPLOYEE_VIEW_ID, name: '従業員ビュー', role: 'employee_viewer' }; 
            } else {
                currentUser = users.find(u => u.id === selectedId);
            }
            updateUserInfo();
            if (!calendarView.classList.contains('hidden')) renderCalendar();
            else if (!dailyChartView.classList.contains('hidden')) renderDailyShiftChart();
            else if (!bulkShiftView.classList.contains('hidden')) renderBulkShiftTable();
        });
    }
    
    function updateUserInfo() {
         currentUserInfo.innerHTML = `表示モード: <span class="font-bold">${currentUser.name}</span>`;
    }
    
    function renderCalendar() {
        const grid = document.getElementById('calendarGridInternal');
        const monthYearDisplay = document.getElementById('calendarMonthYearInternal');
        if (!grid || !monthYearDisplay) return; 

        grid.innerHTML = '';
        const year = calendarDisplayDate.getFullYear();
        const month = calendarDisplayDate.getMonth();
        monthYearDisplay.textContent = `${year}年 ${month + 1}月`;
        
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();

        const renderDayCell = (date, isCurrentMonth) => {
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            if (!isCurrentMonth) dayCell.classList.add('other-month');
            else if (isToday(date)) dayCell.classList.add('today');
            
            const header = document.createElement('div');
            header.classList.add('calendar-day-header');
            header.textContent = date.getDate();
            dayCell.appendChild(header);

            if (isCurrentMonth) {
                const dateString = formatDate(date);
                const eventForDay = dummyEvents[dateString];
                if (eventForDay) {
                    const eventDiv = document.createElement('div');
                    eventDiv.classList.add('event-entry');
                    eventDiv.innerHTML = `<i class="${eventForDay.icon} mr-1"></i>${eventForDay.text}`;
                    dayCell.appendChild(eventDiv);
                }

                const shiftsForDay = dummyShifts[dateString] || [];
                if (selectedEmployeeForHighlight && shiftsForDay.some(s => s.userId === selectedEmployeeForHighlight)) {
                    dayCell.classList.add('highlight-shift');
                }
                dayCell.addEventListener('click', () => showShiftDetailModal(date));
            }
            return dayCell;
        };

        const prevMonthLastDate = new Date(year, month, 0);
        for (let i = startDayOfWeek; i > 0; i--) {
            const date = new Date(prevMonthLastDate); date.setDate(date.getDate() - i + 1);
            grid.appendChild(renderDayCell(date, false));
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            grid.appendChild(renderDayCell(date, true));
        }
        const totalCells = startDayOfWeek + daysInMonth;
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= remainingCells; i++) {
            const date = new Date(year, month + 1, i);
            grid.appendChild(renderDayCell(date, false));
        }
    }

    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr || !timeStr.includes(':')) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    function renderDailyShiftChart() {
        const canvas = document.getElementById('dailyShiftChartInternal'); 
        if (!canvas) return;

        const dateString = formatDate(chartDisplayDate);
        const shiftsForDay = dummyShifts[dateString] || [];
        
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
            data: {
                datasets: [{
                    label: '勤務時間', data: chartDatasetData,
                    backgroundColor: chartDatasetData.map(d => d.bgColor),
                    borderColor: chartDatasetData.map(d => d.bgColor.replace('0.7', '1')),
                    borderWidth: 1, barPercentage: 0.6, categoryPercentage: 0.7
                }]
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'hour', displayFormats: { hour: 'HH:mm' }, tooltipFormat: 'HH:mm' },
                        min: chartMinTime.getTime(), max: chartMaxTime.getTime(), title: { display: true, text: '時間' } },
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
    
    function calculateWorkHours(timeStr, breakTimeStr) {
        if (!timeStr || !timeStr.includes(' - ')) return 0;
        const [start, end] = timeStr.split(' - ');
        const startDate = parseTimeToDate(start, new Date());
        const endDate = parseTimeToDate(end, new Date());
        if (!startDate || !endDate || endDate <= startDate) return 0;
        let durationMs = endDate.getTime() - startDate.getTime();

        if (breakTimeStr && breakTimeStr.includes(' - ')) {
            const [breakStart, breakEnd] = breakTimeStr.split(' - ');
            const breakStartDate = parseTimeToDate(breakStart, new Date());
            const breakEndDate = parseTimeToDate(breakEnd, new Date());
            if (breakStartDate && breakEndDate && breakEndDate > breakStartDate) {
                durationMs -= (breakEndDate.getTime() - breakStartDate.getTime());
            }
        }
        return durationMs / (1000 * 60 * 60); 
    }
   

    function renderBulkShiftTable() {
        bulkShiftTableDateHeader.innerHTML = '';
        bulkShiftTableBody.innerHTML = '';
        bulkShiftTableBreakTimesRow.innerHTML = '';
        bulkShiftTableShortageHoursRow.innerHTML = ''; 

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
        bulkShiftTableDateHeader.innerHTML = headerHtml;
        
        const displayableUsers = [...users.filter(u=>u.role === 'manager'), ...users.filter(u=>u.role === 'employee')];

        displayableUsers.forEach(user => {
            let rowHtml = `<tr><th class="font-semibold ${user.role === 'manager' ? 'text-amber-700' : ''}">${user.name}</th>`;
            days.forEach((dateString) => {
                const shift = (dummyShifts[dateString] || []).find(s => s.userId === user.id);
                let shiftText = "";
                if (shift) {
                    shiftText = shift.time; 
                }
                if (currentUser.role === 'manager') {
                    rowHtml += `<td><input type="text" value="${shiftText}" data-user-id="${user.id}" data-date="${dateString}" placeholder="HH:mm-HH:mm"></td>`;
                } else { 
                    rowHtml += `<td>${shiftText}</td>`;
                }
            });
            rowHtml += '</tr>';
            bulkShiftTableBody.innerHTML += rowHtml;
        });
        
        let breakTimesRowHtml = '<tr><th class="font-semibold">休憩</th>'; 
        days.forEach(dateString => {
            const manuallyEnteredBreak = manualBreaks[dateString] || '';
            if (currentUser.role === 'manager') {
                 breakTimesRowHtml += `<td><input type="text" class="break-time-input" value="${manuallyEnteredBreak}" placeholder="例: 12-13, 15-15.5" data-date="${dateString}"></td>`;
            } else {
                breakTimesRowHtml += `<td class="break-time-display">${manuallyEnteredBreak || ''}</td>`; 
            }
        });
        breakTimesRowHtml += '</tr>';
        bulkShiftTableBreakTimesRow.innerHTML = breakTimesRowHtml;


        let shortageRowHtml = '<tr><th class="font-semibold">不足時間帯</th>'; 
        days.forEach(dateString => {
            const manuallyEnteredShortage = manualShortages[dateString] || '';
            if (currentUser.role === 'manager') {
                 shortageRowHtml += `<td><input type="text" class="shortage-input" value="${manuallyEnteredShortage}" placeholder="例: 09:00-10:00" data-date="${dateString}"></td>`;
            } else {
                shortageRowHtml += `<td class="shortage-input">${manuallyEnteredShortage || ''}</td>`; 
            }
        });
        shortageRowHtml += '</tr>';
        bulkShiftTableShortageHoursRow.innerHTML = shortageRowHtml;


        if (currentUser.role === 'manager') {
            bulkShiftTableBody.querySelectorAll('input[type="text"]').forEach(input => {
                input.addEventListener('change', handleBulkShiftInputChange);
            });
            bulkShiftTableShortageHoursRow.querySelectorAll('input[type="text"].shortage-input').forEach(input => {
                input.addEventListener('change', handleManualShortageInputChange);
            });
            bulkShiftTableBreakTimesRow.querySelectorAll('input[type="text"].break-time-input').forEach(input => {
                input.addEventListener('change', handleManualBreakInputChange);
            });
        }
        bulkShiftMonthYearDisplay.textContent = `${bulkViewDisplayMonth.getFullYear()}年 ${bulkViewDisplayMonth.getMonth() + 1}月`;
        toggleBulkShiftPeriodBtn.textContent = bulkViewIsFirstHalf ? '前半 (1-15日)' : `後半 (16-${lastDayOfMonth}日)`;
    }
    
    function handleManualShortageInputChange(event) {
        const input = event.target;
        const dateString = input.dataset.date;
        manualShortages[dateString] = input.value.trim();
    }
    function handleManualBreakInputChange(event) {
        const input = event.target;
        const dateString = input.dataset.date;
        manualBreaks[dateString] = input.value.trim();
    }

    function handleBulkShiftInputChange(event) {
        const input = event.target;
        const userId = parseInt(input.dataset.userId);
        const dateString = input.dataset.date;
        const value = input.value.trim();

        if (!dummyShifts[dateString]) dummyShifts[dateString] = [];
        let shiftIndex = dummyShifts[dateString].findIndex(s => s.userId === userId);

        if (value) {
            const timePart = value; 
            let existingBreakTime = undefined;
            if (shiftIndex !== -1 && dummyShifts[dateString][shiftIndex].breakTime) {
               existingBreakTime = dummyShifts[dateString][shiftIndex].breakTime;
            }

            const user = users.find(u => u.id === userId);
            if (!user) { console.error("User not found for ID:", userId); return;}

            const newShiftData = {
                userId: userId, fullName: user.name, time: timePart,
                breakTime: existingBreakTime, 
                role: user.role, notes: (shiftIndex !== -1 ? dummyShifts[dateString][shiftIndex].notes : '') 
            };
            if (shiftIndex !== -1) dummyShifts[dateString][shiftIndex] = newShiftData;
            else dummyShifts[dateString].push(newShiftData);
        } else {
            if (shiftIndex !== -1) {
                dummyShifts[dateString].splice(shiftIndex, 1);
                if (dummyShifts[dateString].length === 0) delete dummyShifts[dateString];
            }
        }
        renderBulkShiftTable(); 
        if(!calendarView.classList.contains('hidden')) renderCalendar();
        if(!dailyChartView.classList.contains('hidden')) renderDailyShiftChart();
    }

    prevMonthBulkBtn.addEventListener('click', () => {
        bulkViewDisplayMonth.setMonth(bulkViewDisplayMonth.getMonth() - 1);
        renderBulkShiftTable();
    });
    nextMonthBulkBtn.addEventListener('click', () => {
        bulkViewDisplayMonth.setMonth(bulkViewDisplayMonth.getMonth() + 1);
        renderBulkShiftTable();
    });
    toggleBulkShiftPeriodBtn.addEventListener('click', () => {
        bulkViewIsFirstHalf = !bulkViewIsFirstHalf;
        renderBulkShiftTable();
    });


    function showShiftDetailModal(date) {
        modalContent.innerHTML = ''; 
        const dateString = formatDate(date);
        const shiftsForDay = dummyShifts[dateString] || [];

        let contentHtml = `
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-2xl font-bold text-slate-700">${formatDateToJapanese(date)}</h3>
                <button id="closeModalBtn" class="text-2xl text-slate-500 hover:text-slate-800">&times;</button>
            </div>`;
        
        contentHtml += '<div class="mb-6"><h4 class="font-semibold text-lg text-slate-600 border-b pb-1 mb-3">確定シフト</h4>';
        if (shiftsForDay.length > 0) {
            shiftsForDay.forEach((s, index) => {
                contentHtml += `
                    <div class="p-3 rounded-md mb-2 flex justify-between items-center ${s.role === 'manager' ? 'bg-yellow-100' : 'bg-blue-100'}">
                        <div>
                            <p class="font-semibold ${s.role === 'manager' ? 'text-yellow-800' : 'text-blue-800'}">${s.fullName}</p>
                            <p class="text-sm ${s.role === 'manager' ? 'text-yellow-700' : 'text-blue-700'}">${s.time}</p>
                            ${s.breakTime ? `<p class="text-xs text-gray-500">休憩: ${s.breakTime}</p>` : ''}
                            ${s.notes ? `<p class="text-xs text-gray-600 mt-1">備考: ${s.notes}</p>` : ''}
                        </div>
                        ${currentUser.role === 'manager' ? `<button class="delete-shift-btn" data-shift-index="${index}" data-date-string="${dateString}"><i class="fas fa-trash-alt"></i></button>` : ''}
                    </div>`;
            });
        } else { contentHtml += '<p class="text-slate-500 text-sm">確定シフトはありません。</p>'; }
        contentHtml += '</div>';

        if (currentUser.role === 'manager') {
            contentHtml += `
                <div>
                    <h4 class="font-semibold text-lg text-slate-600 border-b pb-1 mb-3">新しいシフトを追加</h4>
                    <div class="space-y-3">
                        <div><label for="newShiftEmployee" class="block text-sm font-medium text-slate-700 mb-1">従業員:</label><select id="newShiftEmployee" class="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm">${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}</select></div>
                        <div class="grid grid-cols-2 gap-3">
                            <div><label for="newShiftStartTime" class="block text-sm font-medium text-slate-700 mb-1">勤務開始:</label><input type="time" id="newShiftStartTime" class="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm"></div>
                            <div><label for="newShiftEndTime" class="block text-sm font-medium text-slate-700 mb-1">勤務終了:</label><input type="time" id="newShiftEndTime" class="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div><label for="newBreakStartTime" class="block text-sm font-medium text-slate-700 mb-1">休憩開始 (任意):</label><input type="time" id="newBreakStartTime" class="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm"></div>
                            <div><label for="newBreakEndTime" class="block text-sm font-medium text-slate-700 mb-1">休憩終了 (任意):</label><input type="time" id="newBreakEndTime" class="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm"></div>
                        </div>
                        <div><label for="newShiftNotes" class="block text-sm font-medium text-slate-700 mb-1">備考 (任意):</label><input type="text" id="newShiftNotes" class="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm" placeholder="例: 早番リーダー"></div>
                        <button id="addShiftBtn" data-date-string="${dateString}" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md transition"><i class="fas fa-plus-circle mr-1"></i> シフトを追加</button>
                    </div>
                </div>`;
        } else if (currentUser.role === 'employee_viewer') { 
             contentHtml += '<p class="text-slate-500 text-sm">シフトの編集は店長が行います。</p>';
        }
        modalContent.innerHTML = contentHtml;
        document.getElementById('closeModalBtn').addEventListener('click', () => shiftDetailModal.style.display = 'none');
        
        if (currentUser.role === 'manager') {
            document.querySelectorAll('.delete-shift-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const shiftIndex = parseInt(e.currentTarget.dataset.shiftIndex);
                    const targetDateString = e.currentTarget.dataset.dateString;
                    if (dummyShifts[targetDateString] && dummyShifts[targetDateString][shiftIndex]) {
                        dummyShifts[targetDateString].splice(shiftIndex, 1);
                        if (dummyShifts[targetDateString].length === 0) delete dummyShifts[targetDateString];
                        renderCalendar(); renderBulkShiftTable();
                        if (!dailyChartView.classList.contains('hidden')) renderDailyShiftChart();
                        showShiftDetailModal(date);
                    }
                });
            });

            const addShiftBtn = document.getElementById('addShiftBtn');
            if(addShiftBtn) {
                addShiftBtn.addEventListener('click', (e) => {
                    const targetDateString = e.currentTarget.dataset.dateString;
                    const employeeId = parseInt(document.getElementById('newShiftEmployee').value);
                    const startTime = document.getElementById('newShiftStartTime').value;
                    const endTime = document.getElementById('newShiftEndTime').value;
                    const breakStartTime = document.getElementById('newBreakStartTime').value;
                    const breakEndTime = document.getElementById('newBreakEndTime').value;
                    const notes = document.getElementById('newShiftNotes').value.trim();

                    if (!employeeId || !startTime || !endTime) { alert("従業員、勤務開始時刻、勤務終了時刻は必須です。"); return; }
                    if ((breakStartTime && !breakEndTime) || (!breakStartTime && breakEndTime)) {
                        alert("休憩時間を入力する場合は、開始と終了の両方を入力してください。"); return;
                    }
                    const selectedUser = users.find(u => u.id === employeeId);
                    if (!selectedUser) return;
                    const newShift = { userId: selectedUser.id, fullName: selectedUser.name, time: `${startTime} - ${endTime}`, role: selectedUser.role, notes: notes };
                    if (breakStartTime && breakEndTime) newShift.breakTime = `${breakStartTime} - ${breakEndTime}`;
                    if (!dummyShifts[targetDateString]) dummyShifts[targetDateString] = [];
                    dummyShifts[targetDateString].push(newShift);
                    renderCalendar(); renderBulkShiftTable();
                    if (!dailyChartView.classList.contains('hidden')) renderDailyShiftChart();
                    showShiftDetailModal(date);
                });
            }
        }
        shiftDetailModal.style.display = 'block';
    }

    shiftDetailModal.addEventListener('click', (event) => { if (event.target === shiftDetailModal) shiftDetailModal.style.display = 'none'; });
    function formatDate(date) { return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`; }
    function formatDateToJapanese(date) { return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`; }
    function formatDateToJapaneseShort(date) { return `${date.getMonth() + 1}/${date.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;}
    function isToday(date) { const today = new Date(); return date.toDateString() === today.toDateString(); }

    initializeCalendarViewDOM();
    initializeDailyChartViewDOM(); 
    setupRoleSwitcher();
    updateUserInfo();
    switchView('calendar'); 
    if(document.getElementById('currentChartDateInternal')) document.getElementById('currentChartDateInternal').value = formatDate(chartDisplayDate);
    });