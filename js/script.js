document.addEventListener('DOMContentLoaded', function() {
    // --- ★★★ 修正箇所 ★★★ ---
    // API_BASE_URLをスクリプトのトップレベルで定義
    const API_BASE_URL = 'https://my-shift-backend.tamago-2483.workers.dev'; 

    let currentUser = null; 
    let appInitialized = false; // アプリが初期化済みかどうかのフラグ

    // --- DOM要素 ---
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    const loginIdInput = document.getElementById('loginId');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginError = document.getElementById('loginError');
    
    // --- ログイン処理 ---
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
                    // 2回目以降のログインでは、データの再取得と表示のみ行う
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
        appContainer.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginPasswordInput.value = '';
    }
    
    // ログイン関連のイベントリスナーのみを初期状態で有効化
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    loginPasswordInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });

    // --- ログイン後のアプリケーション初期化関数 ---
    function initializeApp() {
        // この関数は一度だけ呼ばれ、アプリケーション全体のイベントリスナーを設定する
        let dailyShiftChartInstance = null;
        let appState = { users: [], shifts: {}, manualBreaks: {}, manualShortages: {} };
        
        const mainViews = { calendar: document.getElementById('calendarView'), dailyChart: document.getElementById('dailyChartView'), bulkShift: document.getElementById('bulkShiftView') };
        const navButtons = { calendar: document.getElementById('showCalendarViewBtn'), dailyChart: document.getElementById('showDailyChartViewBtn'), bulkShift: document.getElementById('showBulkShiftViewBtn') };
        const shiftDetailModal = document.getElementById('shiftDetailModal');
        const modalContent = document.getElementById('modalContent');
        const currentUserInfo = document.getElementById('currentUserInfo');
        document.getElementById('currentYear').textContent = new Date().getFullYear();

        // (ここから下のDOM要素取得は、HTMLに存在するため問題ない)
        const calendarGrid = document.getElementById('calendarGrid');
        // ... (他のDOM要素も同様)

        let calendarDisplayDate = new Date(2025, 5, 1);
        let chartDisplayDate = new Date();
        // ... (他の状態変数)
        
        // --- ここから下にすべての関数定義を配置 ---
        
        function updateUserInfo() {
             currentUserInfo.innerHTML = `ログイン中: <span class="font-bold">${currentUser.name}</span>`;
        }

        async function fetchDataForMonth(date) { /* ... データベースからデータを取得する処理 ... */ }
        async function updateShift(shiftData) { /* ... データベースにシフトを更新する処理 ... */ }
        async function updateManualData(date, breaks, shortages) { /* ... データベースに手動データを更新する処理 ... */ }
        
        function renderCalendar() { /* ... カレンダーを描画する処理 ... */ }
        function renderDailyShiftChart() { /* ... グラフを描画する処理 ... */ }
        function renderBulkShiftTable() { /* ... 一括表示テーブルを描画する処理 ... */ }
        async function showShiftDetailModal(date) { /* ... モーダルを表示する処理 ... */ }

        function handleBulkShiftInputChange(event) { /* ... */ }
        // ... (他のイベントハンドラ)

        async function switchView(viewKey) {
            Object.keys(mainViews).forEach(key => mainViews[key].classList.toggle('hidden', key !== viewKey));
            // ... (setActiveNavButton の呼び出しなど)
            
            let targetDate;
            if (viewKey === 'calendar') targetDate = calendarDisplayDate;
            // ... (他のビューのロジック)

            await fetchDataForMonth(targetDate);
        }

        // --- イベントリスナー設定 ---
        Object.keys(navButtons).forEach(key => {
            navButtons[key].addEventListener('click', () => switchView(key));
        });
        // ... (他のすべてのイベントリスナーをここに設定)

        // --- 初期化処理 ---
        updateUserInfo();
        switchView('calendar'); // 最初にカレンダービューを表示
    }
});