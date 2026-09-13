/* ==========================================================================
   WINOGRADSKY INSTITUTE APP LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const API_URL = 'http://94.247.230.221:5000/api';
  
  // --- STATE ---
  const state = {
    coins: 0,
    completedQuests: new Set(),
    registeredEvents: new Set(['lecture']), // Pre-registered for lecture
    transactions: [],
    profile: {
      name: 'Віталій Шевченко',
      email: 'v.shevchenko@winogradsky.edu.ua',
      avatar: 'assets/avatar.png'
    }
  };

  // --- UI ELEMENTS ---
  const screens = document.querySelectorAll('.app-screen');
  const navTabs = document.querySelectorAll('.nav-tab');
  const gridCards = document.querySelectorAll('.grid-card');
  const backButtons = document.querySelectorAll('.back-btn');
  
  // Coin display elements
  const headerCoinCount = document.getElementById('header-coin-count');
  const profileCoinCount = document.getElementById('profile-coin-count');
  const coinShowerOverlay = document.getElementById('coin-shower-overlay');
  
  // Modals
  const profileModal = document.getElementById('profile-modal');
  const newsDetailsModal = document.getElementById('news-details-modal');
  const openProfileBtn = document.getElementById('open-profile-btn');
  const openWalletBtn = document.getElementById('open-wallet-btn');
  const modalCloseButtons = document.querySelectorAll('.modal-close-btn');
  
  // News Elements
  const newsFeedViewAll = document.getElementById('news-feed-view-all');
  const newsItems = document.querySelectorAll('.news-item');
  const allNewsContainer = document.getElementById('all-news-container');
  const newsModalBody = document.getElementById('news-modal-body');
  
  // Quests Elements
  const questActionButtons = document.querySelectorAll('.quest-action-btn');
  
  // Events Elements
  const regWorkshopBtn = document.getElementById('reg-workshop-btn');
  
  // Community Elements
  const communityChatForm = document.getElementById('community-chat-form');
  const communityInput = document.getElementById('community-input');
  const communityMessages = document.getElementById('community-messages');
  
  // Support Elements
  const supportChatForm = document.getElementById('support-chat-form');
  const supportInput = document.getElementById('support-input');
  const supportMessages = document.getElementById('support-messages');
  
  // Transaction Elements
  const transactionList = document.getElementById('transaction-list');

  // Auth Elements
  const authScreen = document.getElementById('auth-screen');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');
  
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const loginErrorMsg = document.getElementById('login-error-msg');
  
  const registerNameInput = document.getElementById('register-name');
  const registerEmailInput = document.getElementById('register-email');
  const registerPasswordInput = document.getElementById('register-password');
  const registerSubmitBtn = document.getElementById('register-submit-btn');
  const registerErrorMsg = document.getElementById('register-error-msg');
  
  const logoutBtn = document.getElementById('logout-btn');
  
  // Profile UI text fields
  const profileNameTxt = document.getElementById('profile-name');
  const profileEmailTxt = document.querySelector('.profile-email');

  // --- NEWS DATABASE ---
  let newsDatabase = {};

  // --- ROUTING / VIEW NAVIGATION ---
  
  function switchScreen(targetScreenId) {
    // If navigating away from active quest, pause background activity (cameras, audios)
    if (targetScreenId !== 'active-quest-screen') {
      if (typeof pauseQuestBackgroundActivity === 'function') {
        pauseQuestBackgroundActivity();
      }
    }

    screens.forEach(screen => {
      if (screen.id === targetScreenId) {
        screen.classList.add('active');
      } else {
        screen.classList.remove('active');
      }
    });

    // Update bottom nav bar active state depending on the active screen
    navTabs.forEach(tab => {
      const tabTarget = tab.getAttribute('data-screen');
      if (tabTarget === targetScreenId || (tabTarget === 'quests-screen' && targetScreenId === 'active-quest-screen')) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Special behavior: If we go to news tab, build news list if it's empty
    if (targetScreenId === 'news-tab-screen' && allNewsContainer.children.length === 0) {
      buildAllNewsList();
    }
  }

  // Hook bottom navigation tabs - Resume quest if in progress
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetScreen = tab.getAttribute('data-screen');
      if (targetScreen === 'quests-screen' && isQuestStarted && !state.completedQuests.has('kyiv-vinogradsky')) {
        resumeActiveQuest();
      } else {
        switchScreen(targetScreen);
      }
    });
  });

  // Hook 6-grid cards - Resume quest if in progress
  gridCards.forEach(card => {
    card.addEventListener('click', () => {
      const targetScreen = card.getAttribute('data-target');
      if (targetScreen === 'quests-screen' && isQuestStarted && !state.completedQuests.has('kyiv-vinogradsky')) {
        resumeActiveQuest();
      } else {
        switchScreen(targetScreen);
      }
    });
  });

  // Hook back buttons
  backButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchScreen('home-screen');
    });
  });

  // --- NEWS HANDLING ---
  
  function openNewsDetail(newsId) {
    const article = newsDatabase[newsId];
    if (article) {
      newsModalBody.innerHTML = article.content;
      newsDetailsModal.classList.add('active');
    }
  }

  // View All news button click
  if (newsFeedViewAll) {
    newsFeedViewAll.addEventListener('click', () => {
      switchScreen('news-tab-screen');
    });
  }

  // Populate news tab dynamically using dashboard markup references
  function buildAllNewsList() {
    allNewsContainer.innerHTML = '';
    
    // We clone the dashboard news items and append them to news tab
    const newsListDiv = document.createElement('div');
    newsListDiv.className = 'news-list';
    
    const currentNewsItems = document.querySelectorAll('#home-screen .news-item');
    currentNewsItems.forEach(item => {
      const clone = item.cloneNode(true);
      clone.addEventListener('click', () => {
        const newsId = clone.getAttribute('data-news-id');
        openNewsDetail(newsId);
      });
      newsListDiv.appendChild(clone);
    });
    
    allNewsContainer.appendChild(newsListDiv);
  }

  async function loadNewsFromServer() {
    try {
      const response = await fetch(`${API_URL}/news`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        newsDatabase = {};
        const newsListDiv = document.querySelector('#home-screen .news-list');
        if (newsListDiv) {
          newsListDiv.innerHTML = '';
          data.news.forEach(item => {
            // Split content into paragraphs for clean styling
            const paragraphs = item.content.split('\n\n').map(p => `<p class="article-body-text">${p.trim()}</p>`).join('');
            
            // Populate newsDatabase
            newsDatabase[item.id] = {
              tag: item.tag,
              tagClass: item.tag_class,
              image: item.image,
              headline: item.headline,
              date: item.date,
              content: `
                <div class="news-article-view">
                  <img src="${item.image}" class="article-hero-img" alt="${item.headline}">
                  <span class="news-tag ${item.tag_class} article-tag">${item.tag}</span>
                  <h3 class="article-headline">${item.headline}</h3>
                  <span class="article-date">${item.date}</span>
                  ${paragraphs}
                </div>
              `
            };

            // Build HTML item
            const article = document.createElement('article');
            article.className = 'news-item';
            article.setAttribute('data-news-id', item.id);
            article.innerHTML = `
              <div class="news-img-container">
                <img src="${item.image}" alt="${item.headline}" class="news-img">
              </div>
              <div class="news-content">
                <span class="news-tag ${item.tag_class}">${item.tag}</span>
                <h3 class="news-headline">${item.headline}</h3>
                <p class="news-desc">${item.content.length > 80 ? item.content.slice(0, 80) + '...' : item.content}</p>
                <span class="news-date">${item.date}</span>
              </div>
              <span class="news-arrow">&rsaquo;</span>
            `;

            article.addEventListener('click', () => {
              openNewsDetail(item.id);
            });

            newsListDiv.appendChild(article);
          });
          
          // Rebuild news tab list if it was already initialized
          const allNewsContainer = document.getElementById('all-news-container');
          if (allNewsContainer && allNewsContainer.children.length > 0) {
            buildAllNewsList();
          }
        }
      }
    } catch (err) {
      console.error('Error loading news:', err);
    }
  }

  // --- MODALS TOGGLING ---

  openProfileBtn.addEventListener('click', () => {
    updateProfileUI();
    profileModal.classList.add('active');
  });

  openWalletBtn.addEventListener('click', () => {
    updateProfileUI();
    profileModal.classList.add('active');
  });

  modalCloseButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal-overlay').classList.remove('active');
    });
  });

  // Close modal when clicking outside the modal content
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // --- WINCOIN SYSTEM & QUESTS ---

  function addCoins(amount, sourceDescription) {
    state.coins += amount;
    
    // Add transaction to history
    const now = new Date();
    const dateStr = now.toLocaleDateString('uk-UA') + ' ' + now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    
    state.transactions.unshift({
      desc: sourceDescription,
      amount: `+${amount}`,
      date: dateStr
    });

    // Send to backend if authenticated
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          description: sourceDescription,
          amount: `+${amount}`,
          currentCoins: state.coins
        })
      }).catch(err => console.error('Error logging transaction on server:', err));
    }

    // Animate coin counter update (smooth numerical increment)
    animateCoinCounter(amount);
    
    // NOTE: Falling coins animation is disabled across all quest actions per user request
  }

  function animateCoinCounter(addedAmount) {
    const startVal = state.coins - addedAmount;
    const endVal = state.coins;
    let currentVal = startVal;
    
    const duration = 800; // ms
    const stepTime = Math.max(Math.floor(duration / addedAmount), 30);
    
    const timer = setInterval(() => {
      currentVal++;
      if (currentVal >= endVal) {
        currentVal = endVal;
        clearInterval(timer);
      }
      headerCoinCount.textContent = currentVal;
      profileCoinCount.textContent = currentVal;
    }, stepTime);
  }

  function triggerCoinShower() {
    // Disabled everywhere on quests
  }

  // Handle Quest Button Clicks - Opening or resuming active quest screen for Kyiv quest
  questActionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const questId = btn.getAttribute('data-quest-id');
      const reward = parseInt(btn.getAttribute('data-reward'), 10);
      const questTitle = btn.closest('.quest-item').querySelector('h4').textContent;
      
      if (questId === 'kyiv-vinogradsky') {
        if (state.completedQuests.has('kyiv-vinogradsky')) {
          return;
        }

        // If quest is already started, resume from current stage!
        if (isQuestStarted) {
          resumeActiveQuest();
          return;
        }

        // First time start: Transition to active quest screen with welcome modal
        switchScreen('active-quest-screen');
        
        const navTitle = document.getElementById('quest-navbar-title');
        if (navTitle) navTitle.textContent = 'Маршрут до Точки 1';

        // Reset welcome modal and active content visibility
        document.getElementById('quest-welcome-modal').style.display = 'flex';
        document.getElementById('quest-active-content').style.display = 'none';
        
        pauseQuestBackgroundActivity();
      } else {
        // Fallback for other standard quick quests
        if (!state.completedQuests.has(questId)) {
          state.completedQuests.add(questId);
          btn.classList.add('completed');
          btn.textContent = 'Виконано';
          btn.disabled = true;
          addCoins(reward, `Квест: ${questTitle}`);
        }
      }
    });
  });

  // --- EVENTS REGISTER ---
  
  if (regWorkshopBtn) {
    regWorkshopBtn.addEventListener('click', () => {
      regWorkshopBtn.classList.add('registered');
      regWorkshopBtn.textContent = 'Ви зареєстровані';
      regWorkshopBtn.disabled = true;
      
      // Give small reward for registration
      addCoins(5, 'Реєстрація: Воркшоп з командної роботи');
    });
  }

  // --- CHAT SYSTEM (COMMUNITY) ---
  
  if (communityChatForm) {
    communityChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = communityInput.value.trim();
      if (!text) return;

      // Add user message
      appendChatMessage(communityMessages, 'Ви', text, true, 'self');
      communityInput.value = '';
      
      // Auto scroll
      communityMessages.scrollTop = communityMessages.scrollHeight;

      // Simulate a small delay response from someone else if it's the first time
      setTimeout(() => {
        appendChatMessage(communityMessages, 'Олексій Мороз', 'Чудово! Побачимось на місці.', false, 'other', '#7a996d');
        communityMessages.scrollTop = communityMessages.scrollHeight;
      }, 1500);
    });
  }

  // --- CHAT SYSTEM (SUPPORT CHATBOT) ---
  
  if (supportChatForm) {
    supportChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = supportInput.value.trim();
      if (!text) return;

      // Append user message
      appendChatMessage(supportMessages, 'Ви', text, true, 'self');
      supportInput.value = '';
      supportMessages.scrollTop = supportMessages.scrollHeight;

      // Generate bot answer with typing indicator
      setTimeout(() => {
        let responseText = '';
        const lowercaseText = text.toLowerCase();
        
        if (lowercaseText.includes('wincoin') || lowercaseText.includes('монет')) {
          responseText = 'WinCoin — це віртуальні накопичувальні бали нашого інституту. Ви можете заробити їх за проходження Квестів, а також за реєстрацію на Події. У майбутньому їх можна буде обміняти на брендований мерч або сертифікати.';
        } else if (lowercaseText.includes('навчан') || lowercaseText.includes('курс')) {
          responseText = 'У розділі "Навчання" відображаються предмети, на які ви записані, та ваш поточний відсоток виконання завдань. Щоб записатися на нові курси, зверніться в деканат.';
        } else if (lowercaseText.includes('подi') || lowercaseText.includes('заход') || lowercaseText.includes('лекц')) {
          responseText = 'У розділі "Події" ви можете переглянути розклад майбутніх лекцій, воркшопів та зустрічей інституту, а також зареєструватися на них.';
        } else if (lowercaseText.includes('квест')) {
          responseText = 'У вкладці "Квести" доступний захоплюючий маршрут "Київ. Місцями Виноградського". Виконуйте фото-завдання, слухайте аудіогід та отримуйте WinCoins!';
        } else {
          responseText = 'Дякуємо за звернення! Наша служба підтримки відповість вам якнайшвидше. Якщо питання термінове, зверніться до приймальної комісії або деканату.';
        }
        
        appendChatMessage(supportMessages, 'Помічник Winogradsky', responseText, false, 'system');
        supportMessages.scrollTop = supportMessages.scrollHeight;
      }, 800);
    });
  }

  function appendChatMessage(container, author, text, isSelf, type, customColor) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${type}`;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    let avatarHtml = '';
    if (type === 'system') {
      avatarHtml = `<div class="msg-avatar-support">Wi</div>`;
    } else if (isSelf) {
      avatarHtml = `<div class="msg-avatar self">Ви</div>`;
    } else {
      const initials = author.split(' ').map(n => n[0]).join('').slice(0, 2);
      const bgStyle = customColor ? `style="background-color: ${customColor};"` : '';
      avatarHtml = `<div class="msg-avatar" ${bgStyle}>${initials}</div>`;
    }

    msgDiv.innerHTML = `
      ${!isSelf ? avatarHtml : ''}
      <div class="msg-body">
        <div class="msg-author">${author}</div>
        <div class="msg-text">${text}</div>
        <div class="msg-meta">${timeStr}</div>
      </div>
      ${isSelf ? avatarHtml : ''}
    `;

    container.appendChild(msgDiv);
  }

  // --- PROFILE MANAGEMENT ---
  
  // --- OFFLINE / ONLINE MONITORING ---
  const offlineBanner = document.getElementById('offline-status-banner');
  const offlineText = document.getElementById('offline-status-text');

  function updateNetworkStatus(isOnline) {
    if (!offlineBanner) return;
    if (!isOnline) {
      offlineBanner.classList.remove('online-recovered');
      if (offlineText) offlineText.textContent = "Немає з'єднання";
      offlineBanner.style.display = 'inline-flex';
    } else {
      if (offlineBanner.style.display !== 'none') {
        offlineBanner.classList.add('online-recovered');
        if (offlineText) offlineText.textContent = "З'єднання відновлено";
        setTimeout(() => {
          offlineBanner.style.display = 'none';
          offlineBanner.classList.remove('online-recovered');
        }, 2200);
      }
    }
  }

  window.addEventListener('online', () => updateNetworkStatus(true));
  window.addEventListener('offline', () => updateNetworkStatus(false));
  if (!navigator.onLine) {
    updateNetworkStatus(false);
  }

  const profileCoursesCount = document.getElementById('profile-courses-count');
  const profileEventsCount = document.getElementById('profile-events-count');

  function updateProfileUI() {
    if (profileNameTxt) profileNameTxt.textContent = state.profile.name;
    if (profileEmailTxt) profileEmailTxt.textContent = state.profile.email;
    if (headerCoinCount) headerCoinCount.textContent = state.coins;
    if (profileCoinCount) profileCoinCount.textContent = state.coins;
    if (profileCoursesCount) profileCoursesCount.textContent = '0';
    if (profileEventsCount) profileEventsCount.textContent = '0';
  }

  async function loadProfileFromServer() {
    try {
      const response = await fetch(`${API_URL}/profile`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const user = data.user || data;
        if (user.name) state.profile.name = user.name;
        if (user.email) state.profile.email = user.email;
        if (typeof user.coins === 'number') state.coins = user.coins;

        // Save profile to local cache for offline start
        localStorage.setItem('cached_profile_name', state.profile.name);
        localStorage.setItem('cached_profile_email', state.profile.email);
        localStorage.setItem('cached_profile_coins', state.coins.toString());
        
        updateProfileUI();
        loadNewsFromServer();
        loadCompletedQuestsFromServer();
      } else if (response.status === 401) {
        localStorage.removeItem('auth_token');
        showAuthScreen();
      } else {
        restoreCachedProfileOrFallback();
      }
    } catch (err) {
      console.warn('Network error loading profile, launching in offline mode:', err);
      updateNetworkStatus(false);
      restoreCachedProfileOrFallback();
    }
  }

  async function saveCompletedQuestToServer(questId) {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/quests/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ questId })
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Quest completion recorded in server DB:', data);
      }
    } catch (err) {
      console.warn('Could not record quest completion to server:', err);
    }
  }

  async function loadCompletedQuestsFromServer() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/quests/completed`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.completed_quests)) {
          state.completedQuests.clear();
          data.completed_quests.forEach(qId => {
            state.completedQuests.add(qId);
          });
          if (state.completedQuests.has('kyiv-vinogradsky')) {
            localStorage.setItem('quest_kyiv_completed', 'true');
          } else {
            // DB is the authority! If DB doesn't have it, reset quest progress cleanly
            resetQuestProgress();
          }
          updateQuestListUI();
        }
      }
    } catch (err) {
      console.warn('Could not fetch completed quests from server:', err);
    }
  }

  function restoreCachedProfileOrFallback() {
    const cachedName = localStorage.getItem('cached_profile_name');
    const cachedEmail = localStorage.getItem('cached_profile_email');
    const cachedCoins = localStorage.getItem('cached_profile_coins');

    if (cachedName) state.profile.name = cachedName;
    else if (!state.profile.name) state.profile.name = 'Користувач';

    if (cachedEmail) state.profile.email = cachedEmail;
    else if (!state.profile.email) state.profile.email = 'offline@winogradsky.app';

    if (cachedCoins !== null) {
      const parsed = parseInt(cachedCoins, 10);
      if (!isNaN(parsed)) state.coins = parsed;
    }

    updateProfileUI();
    if (authScreen) authScreen.classList.remove('active');
    switchScreen('home-screen');
  }

  // --- AUTHENTICATION ---
  
  function getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  function showAuthScreen() {
    authScreen.classList.add('active');
    screens.forEach(s => {
      if (s.id !== 'auth-screen') s.classList.remove('active');
    });
  }

  function hideAuthScreen() {
    authScreen.classList.remove('active');
    switchScreen('home-screen');
  }

  if (switchToRegister) {
    switchToRegister.addEventListener('click', () => {
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
      loginErrorMsg.textContent = '';
    });
  }

  if (switchToLogin) {
    switchToLogin.addEventListener('click', () => {
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
      registerErrorMsg.textContent = '';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginErrorMsg.textContent = '';
      setLoading(loginSubmitBtn, true);

      try {
        let response = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: loginEmailInput.value.trim(),
            password: loginPasswordInput.value
          })
        });

        // Fallback for /api/auth/login if /api/login returned 404
        if (response.status === 404) {
          response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: loginEmailInput.value.trim(),
              password: loginPasswordInput.value
            })
          });
        }

        let data = {};
        try {
          data = await response.json();
        } catch (jsonErr) {
          console.error('Failed to parse login response JSON:', jsonErr);
        }

        if (response.ok && data.token) {
          localStorage.setItem('auth_token', data.token);
          await loadProfileFromServer();
          hideAuthScreen();
        } else {
          loginErrorMsg.textContent = data.error || data.message || 'Помилка входу. Перевірте email та пароль.';
        }
      } catch (err) {
        console.error('Login network error:', err);
        loginErrorMsg.textContent = 'Сервер недоступний. Спробуйте пізніше.';
      } finally {
        setLoading(loginSubmitBtn, false);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      registerErrorMsg.textContent = '';
      setLoading(registerSubmitBtn, true);

      try {
        let response = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: registerNameInput.value.trim(),
            email: registerEmailInput.value.trim(),
            password: registerPasswordInput.value
          })
        });

        // Fallback for /api/auth/register if /api/register returned 404
        if (response.status === 404) {
          response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: registerNameInput.value.trim(),
              email: registerEmailInput.value.trim(),
              password: registerPasswordInput.value
            })
          });
        }

        let data = {};
        try {
          data = await response.json();
        } catch (jsonErr) {
          console.error('Failed to parse register response JSON:', jsonErr);
        }

        if (response.ok && data.token) {
          localStorage.setItem('auth_token', data.token);
          await loadProfileFromServer();
          hideAuthScreen();
        } else {
          registerErrorMsg.textContent = data.error || data.message || 'Помилка реєстрації. Перевірте введені дані.';
        }
      } catch (err) {
        console.error('Register network error:', err);
        registerErrorMsg.textContent = 'Сервер недоступний. Спробуйте пізніше.';
      } finally {
        setLoading(registerSubmitBtn, false);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('auth_token');
      profileModal.classList.remove('active');
      showAuthScreen();
    });
  }

  // Helper to show/hide loading spinners on submit buttons
  function setLoading(btn, isLoading) {
    const textSpan = btn.querySelector('.btn-text');
    const spinnerSpan = btn.querySelector('.btn-spinner');
    btn.disabled = isLoading;
    if (isLoading) {
      textSpan.style.opacity = '0.3';
      spinnerSpan.classList.remove('hidden');
    } else {
      textSpan.style.opacity = '1';
      spinnerSpan.classList.add('hidden');
    }
  }

  // --- AUDIO CACHE MANAGER (IndexedDB) ---
  const AudioCacheManager = {
    dbName: 'WinogradskyAudioCache',
    storeName: 'audio_blobs',

    async openDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });
    },

    async getAudioBlob(key) {
      try {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        console.warn('IndexedDB read error:', e);
        return null;
      }
    },

    async saveAudioBlob(key, blob) {
      try {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.put(blob, key);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        console.warn('IndexedDB write error:', e);
        return false;
      }
    },

    async getOrFetchAudioUrl(remoteUrl, cacheKey, onStatusChange) {
      try {
        // 1. Check local IndexedDB cache
        const cachedBlob = await this.getAudioBlob(cacheKey);
        if (cachedBlob && cachedBlob.size > 0) {
          console.log('[AudioCache] Playing from IndexedDB local cache:', cacheKey);
          if (onStatusChange) onStatusChange('Аудіогід (з локального кешу)');
          return URL.createObjectURL(cachedBlob);
        }

        // 2. Fetch from server
        console.log('[AudioCache] Fetching from server:', remoteUrl);
        if (onStatusChange) onStatusChange('Завантаження аудіогіда...');
        
        const response = await fetch(remoteUrl);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const blob = await response.blob();
        await this.saveAudioBlob(cacheKey, blob);
        console.log('[AudioCache] Successfully cached to IndexedDB:', cacheKey, blob.size, 'bytes');
        if (onStatusChange) onStatusChange('Прослухати гід під час руху до точки');
        return URL.createObjectURL(blob);
      } catch (err) {
        console.error('[AudioCache] Error fetching audio, streaming directly:', err);
        if (onStatusChange) onStatusChange('Прослухати гід під час руху до точки');
        return remoteUrl; // Fallback to direct URL streaming
      }
    }
  };

  // --- ACTIVE QUEST LOGIC ---
  let isQuestStarted = false;
  let currentQuestStage = 1;

  function saveQuestProgress() {
    try {
      localStorage.setItem('quest_kyiv_started', isQuestStarted ? 'true' : 'false');
      localStorage.setItem('quest_kyiv_stage', String(currentQuestStage));
      localStorage.setItem('quest_kyiv_relief_index', String(currentReliefIndex));
      localStorage.setItem('quest_kyiv_stage3_done', isStage3Completed ? 'true' : 'false');
      localStorage.setItem('quest_kyiv_stage7_done', isStage7Completed ? 'true' : 'false');
      if (stage7CapturedDataUrl) localStorage.setItem('quest_kyiv_stage7_photo', stage7CapturedDataUrl);
      localStorage.setItem('quest_kyiv_p6_quiz_done', isPoint6QuizCompleted ? 'true' : 'false');
      localStorage.setItem('quest_kyiv_quiz_score', (quizScore || 0).toString());
      localStorage.setItem('quest_kyiv_p8_awarded', isQuestCompletedAwarded ? 'true' : 'false');
      localStorage.setItem('quest_kyiv_coin_thrown', isCoinThrown ? 'true' : 'false');
      localStorage.setItem('quest_kyiv_quiz_index', String(currentQuizIndex));
      localStorage.setItem('quest_kyiv_quiz_score', String(quizScore));
    } catch (e) {
      console.warn('Unable to save quest progress:', e);
    }
  }

  function loadQuestProgress() {
    try {
      const savedStarted = localStorage.getItem('quest_kyiv_started');
      const savedStage = parseInt(localStorage.getItem('quest_kyiv_stage'), 10);
      if (savedStarted === 'true' && savedStage >= 1 && savedStage <= 18) {
        isQuestStarted = true;
        currentQuestStage = savedStage;

        const savedRelief = parseInt(localStorage.getItem('quest_kyiv_relief_index'), 10);
        if (savedRelief === 1 || savedRelief === 2) currentReliefIndex = savedRelief;

        if (localStorage.getItem('quest_kyiv_stage3_done') === 'true') isStage3Completed = true;
        if (localStorage.getItem('quest_kyiv_stage7_done') === 'true') isStage7Completed = true;
        const savedPhoto7 = localStorage.getItem('quest_kyiv_stage7_photo');
        if (savedPhoto7) stage7CapturedDataUrl = savedPhoto7;
        if (localStorage.getItem('quest_kyiv_p6_quiz_done') === 'true') isPoint6QuizCompleted = true;
        const savedQuizScore = parseInt(localStorage.getItem('quest_kyiv_quiz_score'), 10);
        if (!isNaN(savedQuizScore)) quizScore = savedQuizScore;
        if (localStorage.getItem('quest_kyiv_p8_awarded') === 'true') isQuestCompletedAwarded = true;
        if (localStorage.getItem('quest_kyiv_completed') === 'true') state.completedQuests.add('kyiv-vinogradsky');
        if (localStorage.getItem('quest_kyiv_coin_thrown') === 'true') isCoinThrown = true;

        const savedQuizIdx = parseInt(localStorage.getItem('quest_kyiv_quiz_index'), 10);
        if (!isNaN(savedQuizIdx)) currentQuizIndex = savedQuizIdx;

        const savedQuizSc = parseInt(localStorage.getItem('quest_kyiv_quiz_score'), 10);
        if (!isNaN(savedQuizSc)) quizScore = savedQuizSc;

        updateQuestListUI();
      }
    } catch (e) {
      console.warn('Unable to load quest progress:', e);
    }
  }

  function resetQuestProgress() {
    isQuestStarted = false;
    currentQuestStage = 1;
    currentReliefIndex = 1;
    isStage3Completed = false;
    isStage7Completed = false;
    stage7CapturedDataUrl = null;
    isPoint6QuizCompleted = false;
    isQuestCompletedAwarded = false;
    quizScore = 0;
    isCoinThrown = false;
    currentQuizIndex = 0;
    quizScore = 0;
    quizAnswered = false;

    pauseQuestBackgroundActivity();

    localStorage.removeItem('quest_kyiv_completed');
    localStorage.removeItem('quest_kyiv_started');
    localStorage.removeItem('quest_kyiv_stage');
    localStorage.removeItem('quest_kyiv_relief_index');
    localStorage.removeItem('quest_kyiv_stage3_done');
    localStorage.removeItem('quest_kyiv_stage7_done');
    localStorage.removeItem('quest_kyiv_stage7_photo');
    localStorage.removeItem('quest_kyiv_p6_quiz_done');
    localStorage.removeItem('quest_kyiv_p8_awarded');
    localStorage.removeItem('quest_kyiv_coin_thrown');
    localStorage.removeItem('quest_kyiv_quiz_index');
    localStorage.removeItem('quest_kyiv_quiz_score');

    state.completedQuests.delete('kyiv-vinogradsky');

    updateQuestListUI();
  }

  function getQuestStageInfo(stage) {
    switch (stage) {
      case 1: return { point: 1, title: 'Точка 1 (Маршрут)' };
      case 2: return { point: 1, title: 'Точка 1 (Завдання)' };
      case 3: return { point: 1, title: 'Точка 1 (Результат)' };
      case 4: return { point: 2, title: 'Точка 2 (Маршрут)' };
      case 5: return { point: 2, title: 'Точка 2 (Завдання)' };
      case 6: return { point: 2, title: 'Точка 2 (Завершено)' };
      case 7: return { point: 3, title: 'Точка 3 (Маршрут)' };
      case 8: return { point: 3, title: 'Точка 3 (Завдання)' };
      case 9: return { point: 4, title: 'Точка 4 (Маршрут)' };
      case 10: return { point: 4, title: 'Точка 4 (Завдання)' };
      case 11: return { point: 5, title: 'Точка 5 (Маршрут)' };
      case 12: return { point: 5, title: 'Точка 5 (Завдання)' };
      case 13: return { point: 5, title: 'Точка 5 (Результат)' };
      case 14: return { point: 6, title: 'Точка 6 (Маршрут)' };
      case 15: return { point: 6, title: 'Точка 6 (Завдання)' };
      case 16: return { point: 7, title: 'Точка 7 (Маршрут)' };
      case 17: return { point: 7, title: 'Точка 7 (Завдання)' };
      case 18: return { point: 8, title: 'Точка 8 (Фінал)' };
      default: return { point: 1, title: 'Точка 1' };
    }
  }

  function updateQuestListUI() {
    const kyivQuestBtn = document.querySelector('.quest-action-btn[data-quest-id="kyiv-vinogradsky"]');
    const badge = document.getElementById('quest-progress-badge');

    if (state.completedQuests.has('kyiv-vinogradsky')) {
      if (kyivQuestBtn) {
        kyivQuestBtn.classList.add('completed');
        kyivQuestBtn.classList.remove('in-progress');
        kyivQuestBtn.textContent = 'Виконано';
        kyivQuestBtn.disabled = true;
      }
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = '✓ Завершено';
      }
    } else if (isQuestStarted) {
      const stageInfo = getQuestStageInfo(currentQuestStage);
      if (kyivQuestBtn) {
        kyivQuestBtn.classList.add('in-progress');
        kyivQuestBtn.classList.remove('completed');
        kyivQuestBtn.textContent = 'Продовжити';
        kyivQuestBtn.disabled = false;
      }
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = '📍 У процесі: ' + stageInfo.title;
      }
    } else {
      if (kyivQuestBtn) {
        kyivQuestBtn.classList.remove('completed', 'in-progress');
        kyivQuestBtn.textContent = 'Виконати';
        kyivQuestBtn.disabled = false;
      }
      if (badge) badge.style.display = 'none';
    }
  }

  function pauseQuestBackgroundActivity() {
    stopCamera();
    stopCamera2();
    stopCamera3QR();
    stopCamera5();
    stopCamera7();

    if (questAudio8 && !questAudio8.paused) {
      questAudio8.pause();
      if (play8Icon) play8Icon.style.display = 'block';
      if (pause8Icon) pause8Icon.style.display = 'none';
    }

    if (questAudio && !questAudio.paused) {
      questAudio.pause();
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    }
    if (questAudio2 && !questAudio2.paused) {
      questAudio2.pause();
      if (play2Icon) play2Icon.style.display = 'block';
      if (pause2Icon) pause2Icon.style.display = 'none';
    }
    if (questAudio3 && !questAudio3.paused) {
      questAudio3.pause();
      if (play3Icon) play3Icon.style.display = 'block';
      if (pause3Icon) pause3Icon.style.display = 'none';
    }
    if (wagnerAudio && !wagnerAudio.paused) {
      wagnerAudio.pause();
      if (stage3VinylIcon) stage3VinylIcon.classList.remove('spinning');
      if (stage3WaveBars) stage3WaveBars.classList.remove('active');
    }
    if (questAudio4 && !questAudio4.paused) {
      questAudio4.pause();
      if (play4Icon) play4Icon.style.display = 'block';
      if (pause4Icon) pause4Icon.style.display = 'none';
    }
    if (questAudio5 && !questAudio5.paused) {
      questAudio5.pause();
      if (play5Icon) play5Icon.style.display = 'block';
      if (pause5Icon) pause5Icon.style.display = 'none';
    }
    if (questAudio6 && !questAudio6.paused) {
      questAudio6.pause();
      if (play6Icon) play6Icon.style.display = 'block';
      if (pause6Icon) pause6Icon.style.display = 'none';
    }
    if (questAudio7 && !questAudio7.paused) {
      questAudio7.pause();
      if (play7Icon) play7Icon.style.display = 'block';
      if (pause7Icon) pause7Icon.style.display = 'none';
    }
  }

  function resumeActiveQuest() {
    switchScreen('active-quest-screen');

    const welcomeModal = document.getElementById('quest-welcome-modal');
    if (welcomeModal) welcomeModal.style.display = 'none';

    const activeContent = document.getElementById('quest-active-content');
    if (activeContent) activeContent.style.display = 'block';

    prepareQuestAssets();

    const stageToRestore = currentQuestStage || 1;
    setQuestStage(stageToRestore);

    setTimeout(() => {
      if (stageToRestore === 1 && leafletMap) leafletMap.invalidateSize();
      else if (stageToRestore === 4 && leafletMap2) leafletMap2.invalidateSize();
      else if (stageToRestore === 7 && leafletMap3) leafletMap3.invalidateSize();
      else if (stageToRestore === 9 && leafletMap4) leafletMap4.invalidateSize();
      else if (stageToRestore === 11 && leafletMap5) leafletMap5.invalidateSize();
      else if (stageToRestore === 14 && leafletMap6) leafletMap6.invalidateSize();
      else if (stageToRestore === 16 && leafletMap7) leafletMap7.invalidateSize();
      else if (stageToRestore === 18 && leafletMap8) leafletMap8.invalidateSize();
    }, 250);
  }

  const destLat = 50.455543;
  const destLng = 30.516990;

  // Point 2 Coordinates: Володимирська 24 (Дзвінниця Софійського собору)
  const destLat2 = 50.452874;
  const destLng2 = 30.515343;

  // Point 1 State
  let questAudio = new Audio();
  let isAudioLoaded = false;
  let leafletMap = null;
  let routingControl = null;
  let isNavigating = false;
  let lastLat = null;
  let lastLng = null;
  let userMarker = null;
  let cameraStream = null;
  let capturedMergedDataUrl = null;

  // Point 2 Navigation State
  let questAudio2 = new Audio();
  let isAudio2Loaded = false;
  let leafletMap2 = null;
  let routingControl2 = null;
  let isNavigating2 = false;
  let lastLat2 = null;
  let lastLng2 = null;
  let userMarker2 = null;

  // Point 3 Navigation State
  let questAudio3 = new Audio();
  let isAudio3Loaded = false;
  let leafletMap3 = null;
  let routingControl3 = null;
  let isNavigating3 = false;
  let lastLat3 = null;
  let lastLng3 = null;
  let userMarker3 = null;
  let destLat3 = 50.456370;
  let destLng3 = 30.526033;

  // Point 3 Task State (QR Scanner & Wagner Music)
  let stage3QrStream = null;
  let stage3QrScanning = false;
  let stage3QrTimer = null;
  let isStage3Completed = false;
  let wagnerAudio = new Audio();
  let isWagnerPlaying = false;

  // Point 4 Navigation & Task State
  let questAudio4 = new Audio();
  let isAudio4Loaded = false;
  let leafletMap4 = null;
  let routingControl4 = null;
  let isNavigating4 = false;
  let lastLat4 = null;
  let lastLng4 = null;
  let userMarker4 = null;
  let destLat4 = 50.455497;
  let destLng4 = 30.526762;
  let isCoinThrown = false;

  // Point 5 Navigation & Task State
  let questAudio5 = new Audio();
  let isAudio5Loaded = false;
  let leafletMap5 = null;
  let routingControl5 = null;
  let isNavigating5 = false;
  let lastLat5 = null;
  let lastLng5 = null;
  let userMarker5 = null;
  let destLat5 = 50.453113;
  let destLng5 = 30.528007;
  let stage5Stream = null;
  let stage5CapturedDataUrl = null;
  let stage5GeneratedPosterDataUrl = null;

  // Point 6 Navigation & Task State
  let questAudio6 = new Audio();
  let isAudio6Loaded = false;
  let leafletMap6 = null;
  let routingControl6 = null;
  let isNavigating6 = false;
  let lastLat6 = null;
  let lastLng6 = null;
  let userMarker6 = null;
  let destLat6 = 50.444081;
  let destLng6 = 30.510751;
  let currentQuizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;

  // Point 7 Navigation & Task State
  let questAudio7 = new Audio();
  let isAudio7Loaded = false;
  let leafletMap7 = null;
  let routingControl7 = null;
  let isNavigating7 = false;
  let lastLat7 = null;
  let lastLng7 = null;
  let userMarker7 = null;
  let destLat7 = 50.441989;
  let destLng7 = 30.511549;
  let stage7Stream = null;
  let stage7CapturedDataUrl = null;
  let isStage7Completed = false;

  // Point 8 Navigation & Final Quest State
  let questAudio8 = new Audio();
  let isAudio8Loaded = false;
  let leafletMap8 = null;
  let routingControl8 = null;
  let isNavigating8 = false;
  let lastLat8 = null;
  let lastLng8 = null;
  let userMarker8 = null;
  let destLat8 = 50.448623;
  let destLng8 = 30.498697;
  let isPoint6QuizCompleted = false;
  let isQuestCompletedAwarded = false;

  // Point 2 Task State (Stucco reliefs with camera zoom)
  let stage2CameraStream = null;
  let currentReliefIndex = 1; // 1 for stage2_1.png, 2 for stage2_2.png
  let stage2CurrentZoom = 1.0;
  let stage2CapturedImg1Data = null;
  let stage2CapturedImg2Data = null;

  // Custom Div Icons for Overview and Navigation
  const blueDotIcon = L.divIcon({
    className: 'user-blue-dot',
    html: '<div style="background: #007aff; width: 14px; height: 14px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  function createArrowIcon(rotation) {
    return L.divIcon({
      className: 'user-nav-arrow',
      html: `<div style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 22px solid #1e3d2f; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transform: rotate(${rotation}deg); transform-origin: 50% 70%;"></div>`,
      iconSize: [20, 22],
      iconAnchor: [10, 15]
    });
  }

  // Elements - General & Point 1
  const questStartBtn = document.getElementById('quest-start-btn');
  const questBackBtn = document.getElementById('quest-back-btn');
  const audioPlayBtn = document.getElementById('audio-play-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const audioTime = document.getElementById('audio-time');
  const audioProgress = document.getElementById('audio-progress');
  const audioTitleStatus = document.getElementById('audio-title-status');
  const navStartBtn = document.getElementById('nav-start-btn');
  const questArrivedBtn = document.getElementById('quest-arrived-btn');

  // Elements - Point 2 Navigation
  const audio2PlayBtn = document.getElementById('audio2-play-btn');
  const play2Icon = document.getElementById('play2-icon');
  const pause2Icon = document.getElementById('pause2-icon');
  const audio2Time = document.getElementById('audio2-time');
  const audio2Progress = document.getElementById('audio2-progress');
  const audio2TitleStatus = document.getElementById('audio2-title-status');
  const nav2StartBtn = document.getElementById('nav2-start-btn');
  const questArrivedBtn2 = document.getElementById('quest-arrived-btn-2');

  // Elements - Point 2 Task (Stucco detection & Zoom)
  const questPoint2TaskView = document.getElementById('quest-point2-task-view');
  const stage2Video = document.getElementById('stage2-camera-stream');
  const stage2OverlayImg = document.getElementById('stage2-overlay-img');
  const stage2StepPill = document.getElementById('stage2-step-pill');
  const stage2GuideHint = document.getElementById('stage2-guide-hint');
  const stage2CameraLoading = document.getElementById('stage2-camera-loading');
  const stage2CaptureBtn = document.getElementById('stage2-capture-btn');
  const stage2CaptureText = document.getElementById('stage2-capture-text');
  const stage2ZoomSlider = document.getElementById('stage2-zoom-slider');
  const stage2ZoomLabel = document.getElementById('stage2-zoom-label');
  const stage2ZoomMinus = document.getElementById('stage2-zoom-minus');
  const stage2ZoomPlus = document.getElementById('stage2-zoom-plus');
  const stage2ZoomChips = document.querySelectorAll('.zoom-chip');
  const stage2ResultImg1 = document.getElementById('stage2-result-img-1');
  const stage2ResultImg2 = document.getElementById('stage2-result-img-2');
  const proceedPoint3Btn = document.getElementById('proceed-point3-btn');

  // Elements - Point 3 Navigation & Task
  const questPoint3View = document.getElementById('quest-point3-view');
  const questPoint3TaskView = document.getElementById('quest-point3-task-view');
  const audio3PlayBtn = document.getElementById('audio3-play-btn');
  const play3Icon = document.getElementById('play3-icon');
  const pause3Icon = document.getElementById('pause3-icon');
  const audio3Time = document.getElementById('audio3-time');
  const audio3Progress = document.getElementById('audio3-progress');
  const audio3TitleStatus = document.getElementById('audio3-title-status');
  const nav3StartBtn = document.getElementById('nav3-start-btn');
  const questArrivedBtn3 = document.getElementById('quest-arrived-btn-3');
  const returnFromPoint3Btn = document.getElementById('return-from-point3-btn');

  // Elements - Point 3 Task QR & Wagner Music
  const stage3OrientyrImg = document.getElementById('stage3-orientyr-img');
  const stage3QrVideo = document.getElementById('stage3-qr-video');
  const stage3QrCanvas = document.getElementById('stage3-qr-canvas');
  const stage3QrStatus = document.getElementById('stage3-qr-status');
  const stage3CameraLoading = document.getElementById('stage3-camera-loading');
  const stage3MockScanBtn = document.getElementById('stage3-mock-scan-btn');
  const stage3MusicCard = document.getElementById('stage3-music-card');
  const stage3VinylIcon = document.getElementById('stage3-vinyl-icon');
  const stage3WaveBars = document.getElementById('stage3-wave-bars');
  const wagnerPlayBtn = document.getElementById('wagner-play-btn');
  const wagnerPlayIcon = document.getElementById('wagner-play-icon');
  const wagnerPauseIcon = document.getElementById('wagner-pause-icon');
  const wagnerProgress = document.getElementById('wagner-progress');
  const wagnerTime = document.getElementById('wagner-time');
  const wagnerStatusText = document.getElementById('wagner-status-text');
  const proceedPoint4Btn = document.getElementById('proceed-point4-btn');

  // Elements - Point 4 Navigation & Task
  const questPoint4View = document.getElementById('quest-point4-view');
  const questPoint4TaskView = document.getElementById('quest-point4-task-view');
  const returnFromPoint4Btn = document.getElementById('return-from-point4-btn');
  const audio4PlayBtn = document.getElementById('audio4-play-btn');
  const play4Icon = document.getElementById('play4-icon');
  const pause4Icon = document.getElementById('pause4-icon');
  const audio4Time = document.getElementById('audio4-time');
  const audio4Progress = document.getElementById('audio4-progress');
  const audio4TitleStatus = document.getElementById('audio4-title-status');
  const nav4StartBtn = document.getElementById('nav4-start-btn');
  const questArrivedBtn4 = document.getElementById('quest-arrived-btn-4');

  // Elements - Point 4 Task
  const stage4OrientyrImg = document.getElementById('stage4-orientyr-img');
  const stage4ThrowCoinBtn = document.getElementById('stage4-throw-coin-btn');
  const stage4CoinVisual = document.getElementById('stage4-coin-visual');
  const stage4WishResult = document.getElementById('stage4-wish-result');
  const proceedPoint5Btn = document.getElementById('proceed-point5-btn');

  // Elements - Point 5 Navigation & Task
  const questPoint5View = document.getElementById('quest-point5-view');
  const questPoint5TaskView = document.getElementById('quest-point5-task-view');
  const questPoint5ResultView = document.getElementById('quest-point5-result-view');
  const audio5PlayBtn = document.getElementById('audio5-play-btn');
  const play5Icon = document.getElementById('play5-icon');
  const pause5Icon = document.getElementById('pause5-icon');
  const audio5Time = document.getElementById('audio5-time');
  const audio5Progress = document.getElementById('audio5-progress');
  const audio5TitleStatus = document.getElementById('audio5-title-status');
  const nav5StartBtn = document.getElementById('nav5-start-btn');
  const questArrivedBtn5 = document.getElementById('quest-arrived-btn-5');

  // Point 5 Camera & Poster Generation Elements
  const stage5CameraBox = document.getElementById('stage5-camera-box');
  const stage5CameraVideo = document.getElementById('stage5-camera-stream');
  const stage5CameraLoading = document.getElementById('stage5-camera-loading');
  const stage5CaptureBtn = document.getElementById('stage5-capture-btn');
  const stage5CompositeCanvas = document.getElementById('stage5-composite-canvas');
  const stage5FileInput = document.getElementById('stage5-file-input');

  // Point 5 Analysis & Info Elements
  const stage5AnalysisCard = document.getElementById('stage5-analysis-card');
  const stage5ScanStatusText = document.getElementById('stage5-scan-status-text');
  const stage5CapturedPreview = document.getElementById('stage5-captured-preview');
  const stage5LaserLine = document.getElementById('stage5-laser-line');
  const stage5ExtractedInfo = document.getElementById('stage5-extracted-info');
  const stage5PosterTitleInput = document.getElementById('stage5-poster-title-input');
  const stage5EditTitleBtn = document.getElementById('stage5-edit-title-btn');
  const stage5CurrentDateBadge = document.getElementById('stage5-current-date-badge');
  const stage5GeneratePosterBtn = document.getElementById('stage5-generate-poster-btn');

  // Point 5 Result & Point 6 Elements
  const stage5PosterPreviewImg = document.getElementById('stage5-poster-preview-img');
  const stage5RetakeBtn = document.getElementById('stage5-retake-btn');
  const stage5FullscreenBtn = document.getElementById('stage5-fullscreen-btn');
  const proceedPoint6Btn = document.getElementById('proceed-point6-btn');
  const questPoint6View = document.getElementById('quest-point6-view');
  const returnFromPoint6Btn = document.getElementById('return-from-point6-btn');

  // Elements - Point 6 Navigation & Task
  const questPoint6TaskView = document.getElementById('quest-point6-task-view');
  const audio6PlayBtn = document.getElementById('audio6-play-btn');
  const play6Icon = document.getElementById('play6-icon');
  const pause6Icon = document.getElementById('pause6-icon');
  const audio6Time = document.getElementById('audio6-time');
  const audio6Progress = document.getElementById('audio6-progress');
  const audio6TitleStatus = document.getElementById('audio6-title-status');
  const nav6StartBtn = document.getElementById('nav6-start-btn');
  const questArrivedBtn6 = document.getElementById('quest-arrived-btn-6');

  // Point 6 Quiz Elements
  const point6QuizStepTitle = document.getElementById('point6-quiz-step-title');
  const point6QuizScoreBadge = document.getElementById('point6-quiz-score-badge');
  const point6QuizProgressFill = document.getElementById('point6-quiz-progress-fill');
  const point6QuestionCard = document.getElementById('point6-question-card');
  const point6QuestionTitle = document.getElementById('point6-question-title');
  const point6OptionsContainer = document.getElementById('point6-options-container');
  const point6ExplanationCard = document.getElementById('point6-explanation-card');
  const point6ExplanationText = document.getElementById('point6-explanation-text');
  const point6NextBtn = document.getElementById('point6-next-btn');
  const point6QuizResult = document.getElementById('point6-quiz-result');
  const point6FinalScoreText = document.getElementById('point6-final-score-text');
  const proceedPoint7Btn = document.getElementById('proceed-point7-btn');

  // Point 7 Navigation & Task Elements
  const questPoint7View = document.getElementById('quest-point7-view');
  const questPoint7TaskView = document.getElementById('quest-point7-task-view');
  const audio7PlayBtn = document.getElementById('audio7-play-btn');
  const play7Icon = document.getElementById('play7-icon');
  const pause7Icon = document.getElementById('pause7-icon');
  const audio7Time = document.getElementById('audio7-time');
  const audio7Progress = document.getElementById('audio7-progress');
  const audio7TitleStatus = document.getElementById('audio7-title-status');
  const nav7StartBtn = document.getElementById('nav7-start-btn');
  const questArrivedBtn7 = document.getElementById('quest-arrived-btn-7');
  const returnFromPoint7Btn = document.getElementById('return-from-point7-btn');
  const stage7CameraVideo = document.getElementById('stage7-camera-stream');
  const stage7CapturedPreview = document.getElementById('stage7-captured-preview');
  const stage7CameraLoading = document.getElementById('stage7-camera-loading');
  const stage7FrameGuide = document.getElementById('stage7-frame-guide');
  const stage7CaptureBtn = document.getElementById('stage7-capture-btn');
  const stage7ShutterBar = document.getElementById('stage7-shutter-bar');
  const stage7CaptureCanvas = document.getElementById('stage7-capture-canvas');
  const stage7FileInput = document.getElementById('stage7-file-input');
  const stage7ResultArea = document.getElementById('stage7-result-area');
  const stage7RetakeBtn = document.getElementById('stage7-retake-btn');
  const proceedPoint8Btn = document.getElementById('proceed-point8-btn');
  const questPoint8View = document.getElementById('quest-point8-view');
  const returnFromPoint8Btn = document.getElementById('return-from-point8-btn');
  const audio8PlayBtn = document.getElementById('audio8-play-btn');
  const play8Icon = document.getElementById('play8-icon');
  const pause8Icon = document.getElementById('pause8-icon');
  const audio8Time = document.getElementById('audio8-time');
  const audio8Progress = document.getElementById('audio8-progress');
  const audio8TitleStatus = document.getElementById('audio8-title-status');
  const nav8StartBtn = document.getElementById('nav8-start-btn');
  const questFinishBtn = document.getElementById('quest-finish-btn');
  const questFinishResult = document.getElementById('quest-finish-result');
  const questFinalScoreBadge = document.getElementById('quest-final-score-badge');
  const questTotalSummaryText = document.getElementById('quest-total-summary-text');
  const finishToRewardsBtn = document.getElementById('finish-to-rewards-btn');

  // Stages
  const questNavigationView = document.getElementById('quest-navigation-view');
  const questTaskView = document.getElementById('quest-task-view');
  const questResultView = document.getElementById('quest-result-view');
  const questPoint2View = document.getElementById('quest-point2-view');
  const questPoint2CompleteView = document.getElementById('quest-point2-complete-view');

  // Camera & Shutter Elements (Point 1)
  const cameraVideo = document.getElementById('camera-stream');
  const cameraLoadingOverlay = document.getElementById('camera-loading-overlay');
  const vintageGuideImg = document.getElementById('vintage-guide-img');
  const capturePhotoBtn = document.getElementById('capture-quest-photo-btn');
  const hiddenMergeCanvas = document.getElementById('hidden-merge-canvas');

  // Result & Review Elements (Point 1)
  const mergedResultImg = document.getElementById('merged-result-img');
  const retakePhotoBtn = document.getElementById('retake-photo-btn');
  const fullscreenViewBtn = document.getElementById('fullscreen-view-btn');
  const proceedPoint2Btn = document.getElementById('proceed-point2-btn');
  const returnFromQuestBtn = document.getElementById('return-from-quest-btn');

  // Fullscreen Modal Elements
  const fullscreenPhotoModal = document.getElementById('fullscreen-photo-modal');
  const fullscreenMergedImg = document.getElementById('fullscreen-merged-img');
  const closeFullscreenPhotoBtn = document.getElementById('close-fullscreen-photo-btn');

  // Switch between stages in Quest
  function setQuestStage(stage) {
    currentQuestStage = stage;
    isQuestStarted = true;
    saveQuestProgress();
    updateQuestListUI();

    if (questNavigationView) questNavigationView.style.display = 'none';
    if (questTaskView) questTaskView.style.display = 'none';
    if (questResultView) questResultView.style.display = 'none';
    if (questPoint2View) questPoint2View.style.display = 'none';
    if (questPoint2TaskView) questPoint2TaskView.style.display = 'none';
    if (questPoint2CompleteView) questPoint2CompleteView.style.display = 'none';
    if (questPoint3View) questPoint3View.style.display = 'none';
    if (questPoint3TaskView) questPoint3TaskView.style.display = 'none';
    if (questPoint4View) questPoint4View.style.display = 'none';
    if (questPoint4TaskView) questPoint4TaskView.style.display = 'none';
    if (questPoint5View) questPoint5View.style.display = 'none';
    if (questPoint5TaskView) questPoint5TaskView.style.display = 'none';
    if (questPoint5ResultView) questPoint5ResultView.style.display = 'none';
    if (questPoint6View) questPoint6View.style.display = 'none';
    if (questPoint6TaskView) questPoint6TaskView.style.display = 'none';
    if (questPoint7View) questPoint7View.style.display = 'none';
    if (questPoint7TaskView) questPoint7TaskView.style.display = 'none';
    if (questPoint8View) questPoint8View.style.display = 'none';
    if (stage !== 17) {
      stopCamera7();
    }
    if (stage !== 18 && questAudio8 && !questAudio8.paused) {
      questAudio8.pause();
      if (play8Icon) play8Icon.style.display = 'block';
      if (pause8Icon) pause8Icon.style.display = 'none';
    }

    const navbarTitle = document.getElementById('quest-navbar-title');

    if (stage === 1) {
      if (questNavigationView) questNavigationView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Маршрут до Точки 1';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      setTimeout(initQuestMap, 200);
      prepareAudioGuide();
    } else if (stage === 2) {
      if (questTaskView) questTaskView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 1: Завдання';
      startCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
    } else if (stage === 3) {
      if (questResultView) questResultView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 1: Результат';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (capturedMergedDataUrl && mergedResultImg) {
        mergedResultImg.src = capturedMergedDataUrl;
      }
    } else if (stage === 4) {
      if (questPoint2View) questPoint2View.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Маршрут до Точки 2';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      // Initialize or refresh Point 2 map & prefetch Point 2 audio
      setTimeout(initQuestMap2, 200);
      prepareAudioGuide2();
    } else if (stage === 5) {
      if (questPoint2TaskView) questPoint2TaskView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 2: Завдання';
      stopCamera();
      stopCamera3QR();
      stopCamera5();
      startCamera2();
      setupReliefStep(currentReliefIndex || 1);
    } else if (stage === 6) {
      if (questPoint2CompleteView) questPoint2CompleteView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 2: Завершено';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (stage2CapturedImg1Data && stage2ResultImg1) stage2ResultImg1.src = stage2CapturedImg1Data;
      if (stage2CapturedImg2Data && stage2ResultImg2) stage2ResultImg2.src = stage2CapturedImg2Data;
    } else if (stage === 7) {
      if (questPoint3View) questPoint3View.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Маршрут до Точки 3';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (wagnerAudio) wagnerAudio.pause();
      setTimeout(initQuestMap3, 200);
      prepareAudioGuide3();
    } else if (stage === 8) {
      if (questPoint3TaskView) questPoint3TaskView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 3: Завдання';
      stopCamera();
      stopCamera2();
      stopCamera5();
      if (isStage3Completed) {
        stopCamera3QR();
        if (stage3QrStatus) {
          stage3QrStatus.className = 'qr-status-pill success';
          stage3QrStatus.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Замок розпізнано!</span>';
        }
        const laser = document.getElementById('stage3-qr-laser');
        if (laser) laser.style.display = 'none';
        if (stage3MusicCard) stage3MusicCard.style.display = 'block';
        if (proceedPoint4Btn) proceedPoint4Btn.style.display = 'flex';
      } else {
        startCamera3QR();
      }
      // Load landmark orientyr image with server check
      if (stage3OrientyrImg) {
        const serverBase = API_URL.replace(/\/api\/?$/, '');
        const remoteOrientyrUrl = serverBase + '/uploads/quest/orientyr-altanka.jpg';
        const testImg = new Image();
        testImg.onload = () => { stage3OrientyrImg.src = remoteOrientyrUrl; };
        testImg.onerror = () => { stage3OrientyrImg.src = 'assets/orientyr-altanka.jpg'; };
        testImg.src = remoteOrientyrUrl;
      }
    } else if (stage === 9) {
      if (questPoint4View) questPoint4View.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Маршрут до Точки 4';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (wagnerAudio) wagnerAudio.pause();
      setTimeout(initQuestMap4, 200);
      prepareAudioGuide4();
    } else if (stage === 10) {
      if (questPoint4TaskView) questPoint4TaskView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 4: Завдання';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (isCoinThrown) {
        if (stage4WishResult) stage4WishResult.style.display = 'block';
        if (stage4ThrowCoinBtn) {
          stage4ThrowCoinBtn.style.background = '#2e7d32';
          stage4ThrowCoinBtn.innerHTML = '<span>Монетку кинуто ✓ Бажання загадано</span>';
          stage4ThrowCoinBtn.disabled = true;
        }
      }
      if (stage4OrientyrImg) {
        const serverBase = API_URL.replace(/\/api\/?$/, '');
        const remoteOrientyrUrl = serverBase + '/uploads/quest/orient-volodymyr.jpg';
        const testImg = new Image();
        testImg.onload = () => { stage4OrientyrImg.src = remoteOrientyrUrl; };
        testImg.onerror = () => { stage4OrientyrImg.src = 'assets/orient-volodymyr.jpg'; };
        testImg.src = remoteOrientyrUrl;
      }
    } else if (stage === 11) {
      if (questPoint5View) questPoint5View.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Маршрут до Точки 5';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (questAudio4) questAudio4.pause();
      setTimeout(initQuestMap5, 200);
      prepareAudioGuide5();
    } else if (stage === 12) {
      if (questPoint5TaskView) questPoint5TaskView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 5: Завдання';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      if (questAudio5) questAudio5.pause();
      startCamera5();
    } else if (stage === 13) {
      if (questPoint5ResultView) questPoint5ResultView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 5: Результат';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (stage5GeneratedPosterDataUrl && stage5PosterPreviewImg) {
        stage5PosterPreviewImg.src = stage5GeneratedPosterDataUrl;
      }
    } else if (stage === 14) {
      if (questPoint6View) questPoint6View.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Маршрут до Точки 6';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (questAudio5) questAudio5.pause();
      setTimeout(initQuestMap6, 200);
      prepareAudioGuide6();
    } else if (stage === 15) {
      if (questPoint6TaskView) questPoint6TaskView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 6: Завдання';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (questAudio6) questAudio6.pause();
      initPoint6Quiz(true);
    } else if (stage === 16) {
      if (questPoint7View) questPoint7View.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Маршрут до Точки 7';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (questAudio6) questAudio6.pause();
      setTimeout(initQuestMap7, 200);
      prepareAudioGuide7();
    } else if (stage === 17) {
      if (questPoint7TaskView) questPoint7TaskView.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 7: Завдання';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      if (questAudio7) questAudio7.pause();
      startCamera7();
    } else if (stage === 18) {
      if (questPoint8View) questPoint8View.style.display = 'block';
      if (navbarTitle) navbarTitle.textContent = 'Точка 8: Сквер ім. С. Виноградського';
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      stopCamera7();
      if (questAudio7) questAudio7.pause();
      setTimeout(initQuestMap8, 200);
      prepareAudioGuide8();
    }
  }

    // Welcome modal "Start Quest" click
  if (questStartBtn) {
    questStartBtn.addEventListener('click', () => {
      document.getElementById('quest-welcome-modal').style.display = 'none';
      document.getElementById('quest-active-content').style.display = 'block';
      isQuestStarted = true;
      setQuestStage(1);
      
      // Initialize map
      setTimeout(initQuestMap, 200);

      // Pre-fetch / check cached audio and server photo in background
      prepareQuestAssets();
    });
  }

  // Pre-fetch Audio & Server Quest Assets (vega.jpg, audio guides, transparent PNG overlays)
  function prepareQuestAssets() {
    prepareAudioGuide();
    prepareAudioGuide2();
    
    const serverBase = API_URL.replace(/\/api\/?$/, '');

    // Pre-cache Point 1 photo (prefer offline bundled asset to ensure clean non-tainted canvas)
    if (vintageGuideImg) {
      vintageGuideImg.src = 'assets/vega.jpg';
    }

    // Pre-load Stage 2 transparent PNGs
    const p1 = new Image();
    p1.src = `${serverBase}/uploads/quest/stage2_1.png`;
    const p2 = new Image();
    p2.src = `${serverBase}/uploads/quest/stage2_2.png`;

    prepareAudioGuide3();
  }

  // Audio Guide Initialization with Server URL & Cache for Point 1
  // Audio Guide Initialization for Point 1
  function prepareAudioGuide() {
    if (isAudioLoaded) return;
    questAudio.src = 'assets/home-f.mp3';
    questAudio.load();
    isAudioLoaded = true;
    if (audioTitleStatus) audioTitleStatus.textContent = 'Прослухати гід під час руху до точки';
  }

  // Audio Guide Initialization for Point 2
  function prepareAudioGuide2() {
    if (isAudio2Loaded) return;
    questAudio2.src = 'assets/sofiya.mp3';
    questAudio2.load();
    isAudio2Loaded = true;
    if (audio2TitleStatus) audio2TitleStatus.textContent = 'Прослухати гід під час руху до точки';
  }

  // Audio Guide Initialization with Server URL & Cache for Point 3
  function prepareAudioGuide3() {
    if (isAudio3Loaded) return;
    questAudio3.src = 'assets/altanka.mp3';
    questAudio3.load();
    isAudio3Loaded = true;
    if (audio3TitleStatus) audio3TitleStatus.textContent = 'Прослухати гід під час руху до точки';
  }
  // Audio Guide Initialization for Point 4
  function prepareAudioGuide4() {
    if (isAudio4Loaded) return;
    questAudio4.src = 'assets/volodymyr.mp3';
    questAudio4.load();
    isAudio4Loaded = true;
    if (audio4TitleStatus) audio4TitleStatus.textContent = 'Прослухати гід під час руху до точки';
  }

  // Audio Guide Initialization with Server URL & Cache for Point 5
  function prepareAudioGuide5() {
    if (isAudio5Loaded) return;
    questAudio5.src = 'assets/filarmonia.mp3';
    questAudio5.load();
    isAudio5Loaded = true;
    if (audio5TitleStatus) audio5TitleStatus.textContent = 'Прослухати гід під час руху до точки';
  }

  // Audio Guide Initialization with Server URL & Cache for Point 6
  function prepareAudioGuide6() {
    if (isAudio6Loaded) return;
    questAudio6.src = 'assets/gimnaziya.mp3';
    questAudio6.load();
    isAudio6Loaded = true;
    if (audio6TitleStatus) audio6TitleStatus.textContent = 'Прослухати гід під час руху до точки';
  }

  // Audio Guide Initialization with Server URL & Cache for Point 7
  function prepareAudioGuide7() {
    if (isAudio7Loaded) return;
    questAudio7.src = 'assets/university.mp3';
    questAudio7.load();
    isAudio7Loaded = true;
    if (audio7TitleStatus) audio7TitleStatus.textContent = 'Прослухати гід під час руху до точки';
  }

  // --- POINT 7 TASK: UNIVERSITY PORTRAIT & POINT 8 TRANSITION ---
  async function startCamera7() {
    if (isStage7Completed && stage7CapturedDataUrl) {
      if (stage7CapturedPreview) {
        stage7CapturedPreview.src = stage7CapturedDataUrl;
        stage7CapturedPreview.style.display = 'block';
      }
      if (stage7CameraVideo) stage7CameraVideo.style.display = 'none';
      if (stage7FrameGuide) stage7FrameGuide.style.display = 'none';
      if (stage7ShutterBar) stage7ShutterBar.style.display = 'none';
      if (stage7ResultArea) stage7ResultArea.style.display = 'block';
      if (stage7CameraLoading) stage7CameraLoading.style.display = 'none';
      return;
    }

    if (stage7CameraLoading) {
      stage7CameraLoading.innerHTML = '<div class="loading-spinner"></div><span>Підключення камери...</span>';
      stage7CameraLoading.style.display = 'flex';
    }
    if (stage7CapturedPreview) stage7CapturedPreview.style.display = 'none';
    if (stage7CameraVideo) stage7CameraVideo.style.display = 'block';
    if (stage7FrameGuide) stage7FrameGuide.style.display = 'flex';
    if (stage7ShutterBar) stage7ShutterBar.style.display = 'flex';
    if (stage7ResultArea) stage7ResultArea.style.display = 'none';

    try {
      stopCamera7();
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      stage7Stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stage7CameraVideo) {
        stage7CameraVideo.srcObject = stage7Stream;
        await stage7CameraVideo.play();
        if (stage7CameraLoading) stage7CameraLoading.style.display = 'none';
      }
    } catch (err) {
      console.warn('Point 7 camera error / fallback:', err);
      if (stage7CameraLoading) {
        stage7CameraLoading.innerHTML = `
          <div style="padding: 12px; text-align: center;">
            <p style="font-size: 13px; margin-bottom: 8px; color: #fff;">Камера недоступна або симуляція</p>
            <button type="button" id="stage7-sample-photo-btn" style="background: #1e3d2f; color: white; border: 1px solid #4a6b3e; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">Зразок портрета</button>
            <button type="button" id="stage7-pick-file-btn" style="background: transparent; color: #ffffff; border: 1px solid #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 600; margin-left: 6px; cursor: pointer; font-size: 12px;">Обрати файл</button>
          </div>
        `;
        const sampleBtn = document.getElementById('stage7-sample-photo-btn');
        if (sampleBtn) {
          sampleBtn.addEventListener('click', () => {
            displayStage7PhotoResult('assets/portrait_winogradsky.jpg');
          });
        }
        const pickBtn = document.getElementById('stage7-pick-file-btn');
        if (pickBtn && stage7FileInput) {
          pickBtn.addEventListener('click', () => stage7FileInput.click());
        }
      }
    }
  }

  function stopCamera7() {
    if (stage7Stream) {
      stage7Stream.getTracks().forEach(t => t.stop());
      stage7Stream = null;
    }
    if (stage7CameraVideo) {
      stage7CameraVideo.srcObject = null;
    }
  }

  function displayStage7PhotoResult(imgSrc) {
    stopCamera7();
    stage7CapturedDataUrl = imgSrc;
    if (stage7CapturedPreview) {
      stage7CapturedPreview.src = imgSrc;
      stage7CapturedPreview.style.display = 'block';
    }
    if (stage7CameraVideo) stage7CameraVideo.style.display = 'none';
    if (stage7FrameGuide) stage7FrameGuide.style.display = 'none';
    if (stage7ShutterBar) stage7ShutterBar.style.display = 'none';
    if (stage7ResultArea) stage7ResultArea.style.display = 'block';
    if (stage7CameraLoading) stage7CameraLoading.style.display = 'none';

    if (!isStage7Completed) {
      isStage7Completed = true;
      saveQuestProgress();
    }
  }

  if (stage7CaptureBtn) {
    stage7CaptureBtn.addEventListener('click', () => {
      const box = document.getElementById('stage7-camera-box');
      if (box) {
        box.classList.add('shutter-flash');
        setTimeout(() => box.classList.remove('shutter-flash'), 300);
      }

      const canvas = stage7CaptureCanvas;
      const video = stage7CameraVideo;
      if (canvas && video && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          displayStage7PhotoResult(dataUrl);
        } catch (e) {
          displayStage7PhotoResult('assets/portrait_winogradsky.jpg');
        }
      } else {
        displayStage7PhotoResult('assets/portrait_winogradsky.jpg');
      }
    });
  }

  if (stage7FileInput) {
    stage7FileInput.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = evt => {
          displayStage7PhotoResult(evt.target.result);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (stage7RetakeBtn) {
    stage7RetakeBtn.addEventListener('click', () => {
      isStage7Completed = false;
      stage7CapturedDataUrl = null;
      saveQuestProgress();
      startCamera7();
    });
  }

  if (proceedPoint8Btn) {
    proceedPoint8Btn.addEventListener('click', () => {
      setQuestStage(18);
    });
  }

  if (returnFromPoint8Btn) {
    returnFromPoint8Btn.addEventListener('click', () => {
      switchScreen('quests-screen');
    });
  }

  // --- POINT 8 AUDIO GUIDE & MAP HANDLERS ---
  function prepareAudioGuide8() {
    if (isAudio8Loaded) return;
    questAudio8.src = 'assets/skver.mp3';
    questAudio8.load();
    isAudio8Loaded = true;
    if (audio8TitleStatus) audio8TitleStatus.textContent = 'Прослухати гід під час руху до точки';
  }

  if (audio8PlayBtn) {
    audio8PlayBtn.addEventListener('click', async () => {
      if (!isAudio8Loaded) {
        await prepareAudioGuide8();
      }

      if (questAudio8.paused) {
        pauseQuestBackgroundActivity();
        questAudio8.play().catch(e => console.warn('Audio 8 play error:', e));
        if (play8Icon) play8Icon.style.display = 'none';
        if (pause8Icon) pause8Icon.style.display = 'block';
      } else {
        questAudio8.pause();
        if (play8Icon) play8Icon.style.display = 'block';
        if (pause8Icon) pause8Icon.style.display = 'none';
      }
    });
  }

  if (questAudio8) {
    questAudio8.addEventListener('timeupdate', () => {
      const cur = questAudio8.currentTime;
      const dur = questAudio8.duration || 0;
      if (dur > 0 && audio8Progress) {
        audio8Progress.value = (cur / dur) * 100;
      }
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      if (audio8Time) {
        audio8Time.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    questAudio8.addEventListener('ended', () => {
      if (play8Icon) play8Icon.style.display = 'block';
      if (pause8Icon) pause8Icon.style.display = 'none';
      if (audio8Progress) audio8Progress.value = 0;
    });
  }

  if (audio8Progress) {
    audio8Progress.addEventListener('input', () => {
      const dur = questAudio8.duration || 0;
      if (dur > 0) {
        questAudio8.currentTime = (audio8Progress.value / 100) * dur;
      }
    });
  }

  // Toggle Navigation Mode for Point 8
  if (nav8StartBtn) {
    nav8StartBtn.addEventListener('click', () => {
      isNavigating8 = !isNavigating8;
      if (isNavigating8) {
        nav8StartBtn.querySelector('span').textContent = 'Стоп';
        nav8StartBtn.style.background = '#c0392b';
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            if (leafletMap8) leafletMap8.setView([latitude, longitude], 17);
          });
        }
      } else {
        nav8StartBtn.querySelector('span').textContent = 'Старт';
        nav8StartBtn.style.background = '#1e3d2f';
      }
    });
  }

  function initQuestMap8() {
    if (leafletMap8 !== null) {
      leafletMap8.invalidateSize();
      return;
    }

    const mapElem = document.getElementById('quest-map-8');
    if (!mapElem) return;

    let userLat = (lastLat !== null) ? lastLat : 50.441989; // from Point 7 (KNU Red Building)
    let userLng = (lastLng !== null) ? lastLng : 30.511549;

    setupMap8();
    setTimeout(() => { if (leafletMap8) leafletMap8.invalidateSize(); }, 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          lastLat = userLat;
          lastLng = userLng;
          if (userMarker8) userMarker8.setLatLng([userLat, userLng]);
          if (routingControl8) routingControl8.setWaypoints([L.latLng(userLat, userLng), L.latLng(destLat8, destLng8)]);
        },
        (error) => {
          console.warn('Geolocation fallback for Point 8 map:', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    function setupMap8() {
      try {
        leafletMap8 = L.map('quest-map-8', {
          zoomControl: false
        }).setView([destLat8, destLng8], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(leafletMap8);

        const destIcon = L.divIcon({
          className: 'quest-destination-marker',
          html: '<div style="background: #1e3d2f; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">8</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const destMarker = L.marker([destLat8, destLng8], { icon: destIcon }).addTo(leafletMap8);
        destMarker.bindPopup("<b>Точка 8</b><br>Сквер ім. Сергія Виноградського<br>Олеся Гончара, 76");

        const userIcon = L.divIcon({
          className: 'quest-user-marker',
          html: '<div style="background: #3498db; color: white; border-radius: 50%; width: 22px; height: 22px; border: 3px solid white; box-shadow: 0 0 10px rgba(52, 152, 219, 0.8);"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        userMarker8 = L.marker([userLat, userLng], { icon: userIcon }).addTo(leafletMap8);

        if (typeof L.Routing !== 'undefined') {
          routingControl8 = L.Routing.control({
            waypoints: [
              L.latLng(userLat, userLng),
              L.latLng(destLat8, destLng8)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            show: false,
            lineOptions: {
              styles: [{ color: '#1e3d2f', weight: 5, opacity: 0.85 }]
            },
            createMarker: function() { return null; }
          }).addTo(leafletMap8);
        }

        setTimeout(() => {
          if (leafletMap8) leafletMap8.invalidateSize();
        }, 300);
      } catch (err) {
        console.error("Leaflet Map 8 init error:", err);
      }
    }
  }

  // Quest Finish Button Click
  if (questFinishBtn) {
    questFinishBtn.addEventListener('click', () => {
      if (questAudio8 && !questAudio8.paused) {
        questAudio8.pause();
        if (play8Icon) play8Icon.style.display = 'block';
        if (pause8Icon) pause8Icon.style.display = 'none';
      }

      if (isNavigating8 && nav8StartBtn) {
        nav8StartBtn.click();
      }

      // Award final 5 points for quest completion
      if (!isQuestCompletedAwarded) {
        isQuestCompletedAwarded = true;
        addCoins(5, 'Квест: Завершення квесту (Точка 8 - Сквер ім. С. Виноградського)');
      }

      // Mark quest as completed
      state.completedQuests.add('kyiv-vinogradsky');
      localStorage.setItem('quest_kyiv_completed', 'true');
      localStorage.setItem('quest_kyiv_p8_awarded', 'true');
      localStorage.setItem('quest_kyiv_quiz_score', (quizScore || 0).toString());
      saveQuestProgress();
      updateQuestListUI();
      saveCompletedQuestToServer('kyiv-vinogradsky');

      // Show completion summary
      const finalTotalScore = Math.min(10, (quizScore || 0) + 5);
      if (questTotalSummaryText) {
        questTotalSummaryText.textContent = `Ваш загальний результат: ${finalTotalScore} з 10 WinCoins (${quizScore || 0} за іспит + 5 за завершення квесту)`;
      }

      questFinishBtn.style.display = 'none';
      if (questFinishResult) {
        questFinishResult.style.display = 'block';
      }
    });
  }

  if (finishToRewardsBtn) {
    finishToRewardsBtn.addEventListener('click', () => {
      switchScreen('community-screen');
    });
  }

  // Quest Screen Back Button
  if (questBackBtn) {
    questBackBtn.addEventListener('click', () => {
      // Stop Point 1 audio
      if (questAudio) {
        questAudio.pause();
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
      }
      // Stop Point 2 audio
      if (questAudio2) {
        questAudio2.pause();
        if (play2Icon) play2Icon.style.display = 'block';
        if (pause2Icon) pause2Icon.style.display = 'none';
      }
      // Stop Point 3 audio
      if (questAudio3) {
        questAudio3.pause();
        if (play3Icon) play3Icon.style.display = 'block';
        if (pause3Icon) pause3Icon.style.display = 'none';
      }
      // Stop Wagner music
      if (wagnerAudio) {
        wagnerAudio.pause();
        if (stage3VinylIcon) stage3VinylIcon.classList.remove('spinning');
        if (stage3WaveBars) stage3WaveBars.classList.remove('active');
      }
      // Stop Point 1 navigation if active
      if (isNavigating && navStartBtn) {
        navStartBtn.click();
      }
      // Stop Point 2 navigation if active
      if (isNavigating2 && nav2StartBtn) {
        nav2StartBtn.click();
      }
      // Stop Point 3 navigation if active
      if (isNavigating3 && nav3StartBtn) {
        nav3StartBtn.click();
      }
      // Stop Point 4 audio
      if (questAudio4) {
        questAudio4.pause();
        if (play4Icon) play4Icon.style.display = 'block';
        if (pause4Icon) pause4Icon.style.display = 'none';
      }
      // Stop Point 4 navigation if active
      if (isNavigating4 && nav4StartBtn) {
        nav4StartBtn.click();
      }
      // Stop Point 5 audio
      if (questAudio5) {
        questAudio5.pause();
        if (play5Icon) play5Icon.style.display = 'block';
        if (pause5Icon) pause5Icon.style.display = 'none';
      }
      // Stop Point 5 navigation if active
      if (isNavigating5 && nav5StartBtn) {
        nav5StartBtn.click();
      }
      // Stop Point 6 audio
      if (questAudio6) {
        questAudio6.pause();
        if (play6Icon) play6Icon.style.display = 'block';
        if (pause6Icon) pause6Icon.style.display = 'none';
      }
      // Stop Point 6 navigation if active
      if (isNavigating6 && nav6StartBtn) {
        nav6StartBtn.click();
      }
      // Stop Point 7 audio
      if (questAudio7) {
        questAudio7.pause();
        if (play7Icon) play7Icon.style.display = 'block';
        if (pause7Icon) pause7Icon.style.display = 'none';
      }
      // Stop Point 7 navigation if active
      if (isNavigating7 && nav7StartBtn) {
        nav7StartBtn.click();
      }
      stopCamera();
      stopCamera2();
      stopCamera3QR();
      stopCamera5();
      switchScreen('quests-screen');
    });
  }

  // Audio 1 Play/Pause Toggle
  if (audioPlayBtn) {
    audioPlayBtn.addEventListener('click', async () => {
      if (!isAudioLoaded) {
        await prepareAudioGuide();
      }

      if (questAudio.paused) {
        // Pause audio 2 if playing
        if (questAudio2 && !questAudio2.paused) {
          questAudio2.pause();
          if (play2Icon) play2Icon.style.display = 'block';
          if (pause2Icon) pause2Icon.style.display = 'none';
        }

        questAudio.play().then(() => {
          if (playIcon) playIcon.style.display = 'none';
          if (pauseIcon) pauseIcon.style.display = 'block';
        }).catch(err => {
          console.error("Audio 1 playback error:", err);
        });
      } else {
        questAudio.pause();
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
      }
    });
  }

  // Audio 1 Time update & slider progress
  if (questAudio) {
    questAudio.addEventListener('timeupdate', () => {
      const cur = questAudio.currentTime;
      const dur = questAudio.duration || 0;
      
      if (dur > 0 && audioProgress) {
        audioProgress.value = (cur / dur) * 100;
      }
      
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      
      if (audioTime) {
        audioTime.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    // Reset UI when audio reaches the end
    questAudio.addEventListener('ended', () => {
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (audioProgress) audioProgress.value = 0;
    });
  }

  // Audio 1 Slider scrubbing handler
  if (audioProgress) {
    audioProgress.addEventListener('input', () => {
      const dur = questAudio.duration || 0;
      if (dur > 0) {
        questAudio.currentTime = (audioProgress.value / 100) * dur;
      }
    });
  }

  // Audio 2 Play/Pause Toggle
  if (audio2PlayBtn) {
    audio2PlayBtn.addEventListener('click', async () => {
      if (!isAudio2Loaded) {
        await prepareAudioGuide2();
      }

      if (questAudio2.paused) {
        // Pause audio 1 if playing
        if (questAudio && !questAudio.paused) {
          questAudio.pause();
          if (playIcon) playIcon.style.display = 'block';
          if (pauseIcon) pauseIcon.style.display = 'none';
        }

        questAudio2.play().then(() => {
          if (play2Icon) play2Icon.style.display = 'none';
          if (pause2Icon) pause2Icon.style.display = 'block';
        }).catch(err => {
          console.error("Audio 2 playback error:", err);
        });
      } else {
        questAudio2.pause();
        if (play2Icon) play2Icon.style.display = 'block';
        if (pause2Icon) pause2Icon.style.display = 'none';
      }
    });
  }

  // Audio 2 Time update & slider progress
  if (questAudio2) {
    questAudio2.addEventListener('timeupdate', () => {
      const cur = questAudio2.currentTime;
      const dur = questAudio2.duration || 0;
      
      if (dur > 0 && audio2Progress) {
        audio2Progress.value = (cur / dur) * 100;
      }
      
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      
      if (audio2Time) {
        audio2Time.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    // Reset UI when audio 2 reaches the end
    questAudio2.addEventListener('ended', () => {
      if (play2Icon) play2Icon.style.display = 'block';
      if (pause2Icon) pause2Icon.style.display = 'none';
      if (audio2Progress) audio2Progress.value = 0;
    });
  }

  // Audio 2 Slider scrubbing handler
  if (audio2Progress) {
    audio2Progress.addEventListener('input', () => {
      const dur = questAudio2.duration || 0;
      if (dur > 0) {
        questAudio2.currentTime = (audio2Progress.value / 100) * dur;
      }
    });
  }

  // Bearing calculator between two coordinates
  function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  // Toggle Navigation Mode for Point 1
  if (navStartBtn) {
    navStartBtn.addEventListener('click', () => {
      isNavigating = !isNavigating;
      if (isNavigating) {
        // Start Navigation
        navStartBtn.querySelector('span').textContent = 'Стоп';
        navStartBtn.style.background = '#d97706';
        navStartBtn.querySelector('svg').innerHTML = '<rect x="4" y="4" width="16" height="16" fill="currentColor"></rect>';

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const bearing = calculateBearing(lat, lng, destLat, destLng);

            if (userMarker) {
              userMarker.setLatLng([lat, lng]);
              userMarker.setIcon(createArrowIcon(bearing));
            }

            if (leafletMap) {
              leafletMap.setView([lat, lng], 18);
            }

            if (routingControl) {
              routingControl.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat, destLng)
              ]);
            }

            lastLat = lat;
            lastLng = lng;
          });
        }
      } else {
        // Stop Navigation
        navStartBtn.querySelector('span').textContent = 'Старт';
        navStartBtn.style.background = '#1e3d2f';
        navStartBtn.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

        if (userMarker) {
          userMarker.setIcon(blueDotIcon);
        }

        if (userMarker && leafletMap) {
          const bounds = L.latLngBounds(
            [userMarker.getLatLng().lat, userMarker.getLatLng().lng],
            [destLat, destLng]
          );
          leafletMap.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    });
  }

  // Toggle Navigation Mode for Point 2
  if (nav2StartBtn) {
    nav2StartBtn.addEventListener('click', () => {
      isNavigating2 = !isNavigating2;
      if (isNavigating2) {
        // Start Navigation
        nav2StartBtn.querySelector('span').textContent = 'Стоп';
        nav2StartBtn.style.background = '#d97706';
        nav2StartBtn.querySelector('svg').innerHTML = '<rect x="4" y="4" width="16" height="16" fill="currentColor"></rect>';

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const bearing = calculateBearing(lat, lng, destLat2, destLng2);

            if (userMarker2) {
              userMarker2.setLatLng([lat, lng]);
              userMarker2.setIcon(createArrowIcon(bearing));
            }

            if (leafletMap2) {
              leafletMap2.setView([lat, lng], 18);
            }

            if (routingControl2) {
              routingControl2.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat2, destLng2)
              ]);
            }

            lastLat2 = lat;
            lastLng2 = lng;
          });
        }
      } else {
        // Stop Navigation
        nav2StartBtn.querySelector('span').textContent = 'Старт';
        nav2StartBtn.style.background = '#1e3d2f';
        nav2StartBtn.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

        if (userMarker2) {
          userMarker2.setIcon(blueDotIcon);
        }

        if (userMarker2 && leafletMap2) {
          const bounds = L.latLngBounds(
            [userMarker2.getLatLng().lat, userMarker2.getLatLng().lng],
            [destLat2, destLng2]
          );
          leafletMap2.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    });
  }

  // "Вже на місці" Button Click Handler for Point 1
  if (questArrivedBtn) {
    questArrivedBtn.addEventListener('click', () => {
      if (questAudio && !questAudio.paused) {
        questAudio.pause();
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
      }

      if (isNavigating && navStartBtn) {
        navStartBtn.click();
      }

      // Transition to Task Stage 1 (Split Camera & Photo Match)
      setQuestStage(2);
    });
  }

  // "Вже на місці" Button Click Handler for Point 2 -> Transition to Stage 5: Point 2 Task
  if (questArrivedBtn2) {
    questArrivedBtn2.addEventListener('click', () => {
      // 1. Pause Point 2 audio
      if (questAudio2 && !questAudio2.paused) {
        questAudio2.pause();
        if (play2Icon) play2Icon.style.display = 'block';
        if (pause2Icon) pause2Icon.style.display = 'none';
      }

      // 2. Stop GPS navigation 2 if running
      if (isNavigating2 && nav2StartBtn) {
        nav2StartBtn.click();
      }

      // 3. Reset relief index to 1 and transition to Stage 5 (Point 2 Task View)
      currentReliefIndex = 1;
      setQuestStage(5);
    });
  }

  // Audio 3 Play/Pause Toggle
  if (audio3PlayBtn) {
    audio3PlayBtn.addEventListener('click', async () => {
      if (!isAudio3Loaded) {
        await prepareAudioGuide3();
      }

      if (questAudio3.paused) {
        if (questAudio && !questAudio.paused) {
          questAudio.pause();
          if (playIcon) playIcon.style.display = 'block';
          if (pauseIcon) pauseIcon.style.display = 'none';
        }
        if (questAudio2 && !questAudio2.paused) {
          questAudio2.pause();
          if (play2Icon) play2Icon.style.display = 'block';
          if (pause2Icon) pause2Icon.style.display = 'none';
        }

        questAudio3.play().then(() => {
          if (play3Icon) play3Icon.style.display = 'none';
          if (pause3Icon) pause3Icon.style.display = 'block';
        }).catch(err => {
          console.error("Audio 3 playback error:", err);
        });
      } else {
        questAudio3.pause();
        if (play3Icon) play3Icon.style.display = 'block';
        if (pause3Icon) pause3Icon.style.display = 'none';
      }
    });
  }

  // Audio 3 Time update & slider progress
  if (questAudio3) {
    questAudio3.addEventListener('timeupdate', () => {
      const cur = questAudio3.currentTime;
      const dur = questAudio3.duration || 0;
      
      if (dur > 0 && audio3Progress) {
        audio3Progress.value = (cur / dur) * 100;
      }
      
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      
      if (audio3Time) {
        audio3Time.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    questAudio3.addEventListener('ended', () => {
      if (play3Icon) play3Icon.style.display = 'block';
      if (pause3Icon) pause3Icon.style.display = 'none';
      if (audio3Progress) audio3Progress.value = 0;
    });
  }

  // Audio 3 Slider scrubbing handler
  if (audio3Progress) {
    audio3Progress.addEventListener('input', () => {
      const dur = questAudio3.duration || 0;
      if (dur > 0) {
        questAudio3.currentTime = (audio3Progress.value / 100) * dur;
      }
    });
  }

  // Toggle Navigation Mode for Point 3
  if (nav3StartBtn) {
    nav3StartBtn.addEventListener('click', () => {
      isNavigating3 = !isNavigating3;
      if (isNavigating3) {
        nav3StartBtn.querySelector('span').textContent = 'Стоп';
        nav3StartBtn.style.background = '#d97706';
        nav3StartBtn.querySelector('svg').innerHTML = '<rect x="4" y="4" width="16" height="16" fill="currentColor"></rect>';

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const bearing = calculateBearing(lat, lng, destLat3, destLng3);

            if (userMarker3) {
              userMarker3.setLatLng([lat, lng]);
              userMarker3.setIcon(createArrowIcon(bearing));
            }

            if (leafletMap3) {
              leafletMap3.setView([lat, lng], 18);
            }

            if (routingControl3) {
              routingControl3.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat3, destLng3)
              ]);
            }

            lastLat3 = lat;
            lastLng3 = lng;
          });
        }
      } else {
        nav3StartBtn.querySelector('span').textContent = 'Старт';
        nav3StartBtn.style.background = '#1e3d2f';
        nav3StartBtn.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

        if (userMarker3) {
          userMarker3.setIcon(blueDotIcon);
        }

        if (userMarker3 && leafletMap3) {
          const bounds = L.latLngBounds(
            [userMarker3.getLatLng().lat, userMarker3.getLatLng().lng],
            [destLat3, destLng3]
          );
          leafletMap3.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    });
  }

  // "Вже на місці" Button Click Handler for Point 3 -> Transition to Stage 8: Point 3 Task Placeholder
  if (questArrivedBtn3) {
    questArrivedBtn3.addEventListener('click', () => {
      if (questAudio3 && !questAudio3.paused) {
        questAudio3.pause();
        if (play3Icon) play3Icon.style.display = 'block';
        if (pause3Icon) pause3Icon.style.display = 'none';
      }

      if (isNavigating3 && nav3StartBtn) {
        nav3StartBtn.click();
      }

      setQuestStage(8);
    });
  }

  // Return to Quests from Point 3 Task Placeholder
  if (returnFromPoint3Btn) {
    returnFromPoint3Btn.addEventListener('click', () => {
      switchScreen('quests-screen');
    });
  }

  // --- POINT 3: QR CAMERA SCANNER & WAGNER AUDIO LOGIC ---
  async function startCamera3QR() {
    if (stage3CameraLoading) stage3CameraLoading.style.display = 'flex';
    stopCamera3QR();

    const constraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      stage3QrStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('Could not get environment camera for QR, trying default:', err);
      try {
        stage3QrStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (fallbackErr) {
        console.error('Camera access failed for QR scanner:', fallbackErr);
        if (stage3CameraLoading) {
          stage3CameraLoading.innerHTML = '<span style="color: #ffcdd2;">Не вдалося увімкнути камеру. Скористайтеся кнопкою тесту нижче.</span>';
        }
        return;
      }
    }

    if (stage3QrVideo && stage3QrStream) {
      stage3QrVideo.srcObject = stage3QrStream;
      stage3QrVideo.setAttribute('playsinline', 'true');
      try {
        await stage3QrVideo.play();
      } catch (e) {
        console.warn('QR video play exception:', e);
      }
      if (stage3CameraLoading) stage3CameraLoading.style.display = 'none';

      stage3QrScanning = true;
      startQrDetectionLoop();
    }
  }

  function stopCamera3QR() {
    stage3QrScanning = false;
    if (stage3QrTimer) {
      clearTimeout(stage3QrTimer);
      stage3QrTimer = null;
    }
    if (stage3QrStream) {
      stage3QrStream.getTracks().forEach(track => track.stop());
      stage3QrStream = null;
    }
    if (stage3QrVideo) {
      stage3QrVideo.srcObject = null;
    }
  }

  async function startQrDetectionLoop() {
    if (!stage3QrScanning || isStage3Completed) return;

    if (stage3QrVideo && stage3QrVideo.readyState >= 2 && stage3QrVideo.videoWidth > 0) {
      let foundText = null;

      // 1. Try Native BarcodeDetector
      if ('BarcodeDetector' in window) {
        try {
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(stage3QrVideo);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            foundText = barcodes[0].rawValue;
          }
        } catch (e) {
          // Fallback to jsQR
        }
      }

      // 2. Fallback to jsQR
      if (!foundText && typeof jsQR === 'function' && stage3QrCanvas) {
        const vw = stage3QrVideo.videoWidth;
        const vh = stage3QrVideo.videoHeight;
        stage3QrCanvas.width = vw;
        stage3QrCanvas.height = vh;
        const ctx = stage3QrCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(stage3QrVideo, 0, 0, vw, vh);
        const imgData = ctx.getImageData(0, 0, vw, vh);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert'
        });
        if (code && code.data) {
          foundText = code.data;
        }
      }

      if (foundText) {
        handleQrDetected(foundText);
        return;
      }
    }

    if (stage3QrScanning) {
      stage3QrTimer = setTimeout(startQrDetectionLoop, 250);
    }
  }

  function handleQrDetected(text) {
    console.log('[QR Scanner] Detected text:', text);
    const cleaned = (text || '').trim();
    const TARGET_CODE = 'fnl43errlnvfvdnl4252';

    if (cleaned === TARGET_CODE || cleaned.includes(TARGET_CODE)) {
      isStage3Completed = true;
      stopCamera3QR();

      if (navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }

      if (stage3QrStatus) {
        stage3QrStatus.className = 'qr-status-pill success';
        stage3QrStatus.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Замок розпізнано!</span>';
      }

      const laser = document.getElementById('stage3-qr-laser');
      if (laser) laser.style.display = 'none';

      // Show Wagner music card & Proceed button
      if (stage3MusicCard) stage3MusicCard.style.display = 'block';
      if (proceedPoint4Btn) proceedPoint4Btn.style.display = 'flex';

      isStage3Completed = true;
      saveQuestProgress();

      // Award WinCoins
      // Intermediate point: no coins awarded

      // Start Wagner Music
      playWagnerMusic();
    } else {
      if (stage3QrStatus) {
        stage3QrStatus.textContent = 'Зчитано інший код. Шукайте замок квесту';
        setTimeout(() => {
          if (stage3QrStatus && !isStage3Completed) {
            stage3QrStatus.textContent = 'Наведіть на QR-код замка';
          }
        }, 2000);
      }
    }
  }

  // Wagner Audio Setup & Controls
  async function playWagnerMusic() {
    const serverBase = API_URL.replace(/\/api\/?$/, '');
    const remoteWagnerUrl = `${serverBase}/uploads/quest/wagner.mp3`;
    const cacheKey = 'quest_point_3_wagner_music_v1';

    try {
      const audioSrc = await AudioCacheManager.getOrFetchAudioUrl(
        remoteWagnerUrl,
        cacheKey,
        (statusText) => {
          if (wagnerStatusText) wagnerStatusText.textContent = statusText;
        }
      );
      wagnerAudio.src = audioSrc;
    } catch (e) {
      wagnerAudio.src = 'assets/wagner.mp3';
    }

    wagnerAudio.play().then(() => {
      isWagnerPlaying = true;
      if (wagnerPlayIcon) wagnerPlayIcon.style.display = 'none';
      if (wagnerPauseIcon) wagnerPauseIcon.style.display = 'block';
      if (stage3VinylIcon) stage3VinylIcon.classList.add('spinning');
      if (stage3WaveBars) stage3WaveBars.classList.add('active');
      if (wagnerStatusText) wagnerStatusText.textContent = 'Відтворюється...';
    }).catch(err => {
      console.warn('Wagner audio play error:', err);
    });
  }

  if (wagnerPlayBtn) {
    wagnerPlayBtn.addEventListener('click', () => {
      if (wagnerAudio.paused) {
        wagnerAudio.play().then(() => {
          isWagnerPlaying = true;
          if (wagnerPlayIcon) wagnerPlayIcon.style.display = 'none';
          if (wagnerPauseIcon) wagnerPauseIcon.style.display = 'block';
          if (stage3VinylIcon) stage3VinylIcon.classList.add('spinning');
          if (stage3WaveBars) stage3WaveBars.classList.add('active');
          if (wagnerStatusText) wagnerStatusText.textContent = 'Відтворюється...';
        });
      } else {
        wagnerAudio.pause();
        isWagnerPlaying = false;
        if (wagnerPlayIcon) wagnerPlayIcon.style.display = 'block';
        if (wagnerPauseIcon) wagnerPauseIcon.style.display = 'none';
        if (stage3VinylIcon) stage3VinylIcon.classList.remove('spinning');
        if (stage3WaveBars) stage3WaveBars.classList.remove('active');
        if (wagnerStatusText) wagnerStatusText.textContent = 'Пауза';
      }
    });
  }

  if (wagnerAudio) {
    wagnerAudio.addEventListener('timeupdate', () => {
      const cur = wagnerAudio.currentTime;
      const dur = wagnerAudio.duration || 0;
      if (dur > 0 && wagnerProgress) {
        wagnerProgress.value = (cur / dur) * 100;
      }
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      if (wagnerTime) {
        wagnerTime.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    wagnerAudio.addEventListener('ended', () => {
      if (wagnerPlayIcon) wagnerPlayIcon.style.display = 'block';
      if (wagnerPauseIcon) wagnerPauseIcon.style.display = 'none';
      if (stage3VinylIcon) stage3VinylIcon.classList.remove('spinning');
      if (stage3WaveBars) stage3WaveBars.classList.remove('active');
      if (wagnerProgress) wagnerProgress.value = 0;
      if (wagnerStatusText) wagnerStatusText.textContent = 'Завершено';
    });
  }

  if (wagnerProgress) {
    wagnerProgress.addEventListener('input', () => {
      const dur = wagnerAudio.duration || 0;
      if (dur > 0) {
        wagnerAudio.currentTime = (wagnerProgress.value / 100) * dur;
      }
    });
  }

  // Simulation Button for testing
  if (stage3MockScanBtn) {
    stage3MockScanBtn.addEventListener('click', () => {
      handleQrDetected('fnl43errlnvfvdnl4252');
    });
  }

  // Proceed to Point 4 Click
  if (proceedPoint4Btn) {
    proceedPoint4Btn.addEventListener('click', () => {
      if (wagnerAudio) wagnerAudio.pause();
      setQuestStage(9);
    });
  }

  // Return from Point 4 Click
  if (returnFromPoint4Btn) {
    returnFromPoint4Btn.addEventListener('click', () => {
      switchScreen('quests-screen');
    });
  }

  // --- POINT 4 AUDIO GUIDE HANDLERS ---
  if (audio4PlayBtn) {
    audio4PlayBtn.addEventListener('click', async () => {
      if (!isAudio4Loaded) {
        await prepareAudioGuide4();
      }

      if (questAudio4.paused) {
        if (questAudio && !questAudio.paused) questAudio.pause();
        if (questAudio2 && !questAudio2.paused) questAudio2.pause();
        if (questAudio3 && !questAudio3.paused) questAudio3.pause();
        if (wagnerAudio && !wagnerAudio.paused) wagnerAudio.pause();

        questAudio4.play().then(() => {
          if (play4Icon) play4Icon.style.display = 'none';
          if (pause4Icon) pause4Icon.style.display = 'block';
        }).catch(err => {
          console.error('Audio 4 playback error:', err);
        });
      } else {
        questAudio4.pause();
        if (play4Icon) play4Icon.style.display = 'block';
        if (pause4Icon) pause4Icon.style.display = 'none';
      }
    });
  }

  if (questAudio4) {
    questAudio4.addEventListener('timeupdate', () => {
      const cur = questAudio4.currentTime;
      const dur = questAudio4.duration || 0;
      if (dur > 0 && audio4Progress) {
        audio4Progress.value = (cur / dur) * 100;
      }
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      if (audio4Time) {
        audio4Time.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    questAudio4.addEventListener('ended', () => {
      if (play4Icon) play4Icon.style.display = 'block';
      if (pause4Icon) pause4Icon.style.display = 'none';
      if (audio4Progress) audio4Progress.value = 0;
    });
  }

  if (audio4Progress) {
    audio4Progress.addEventListener('input', () => {
      const dur = questAudio4.duration || 0;
      if (dur > 0) {
        questAudio4.currentTime = (audio4Progress.value / 100) * dur;
      }
    });
  }

  // Toggle Navigation Mode for Point 4
  if (nav4StartBtn) {
    nav4StartBtn.addEventListener('click', () => {
      isNavigating4 = !isNavigating4;
      if (isNavigating4) {
        nav4StartBtn.querySelector('span').textContent = 'Стоп';
        nav4StartBtn.style.background = '#d97706';
        nav4StartBtn.querySelector('svg').innerHTML = '<rect x="4" y="4" width="16" height="16" fill="currentColor"></rect>';

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const bearing = calculateBearing(lat, lng, destLat4, destLng4);

            if (userMarker4) {
              userMarker4.setLatLng([lat, lng]);
              userMarker4.setIcon(createArrowIcon(bearing));
            }

            if (leafletMap4) {
              leafletMap4.setView([lat, lng], 18);
            }

            if (routingControl4) {
              routingControl4.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat4, destLng4)
              ]);
            }

            lastLat4 = lat;
            lastLng4 = lng;
          });
        }
      } else {
        nav4StartBtn.querySelector('span').textContent = 'Старт';
        nav4StartBtn.style.background = '#1e3d2f';
        nav4StartBtn.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

        if (userMarker4) {
          userMarker4.setIcon(blueDotIcon);
        }

        if (userMarker4 && leafletMap4) {
          const bounds = L.latLngBounds(
            [userMarker4.getLatLng().lat, userMarker4.getLatLng().lng],
            [destLat4, destLng4]
          );
          leafletMap4.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    });
  }

  // "Вже на місці" Button Click Handler for Point 4 -> Transition to Stage 10: Point 4 Task
  if (questArrivedBtn4) {
    questArrivedBtn4.addEventListener('click', () => {
      if (questAudio4 && !questAudio4.paused) {
        questAudio4.pause();
        if (play4Icon) play4Icon.style.display = 'block';
        if (pause4Icon) pause4Icon.style.display = 'none';
      }

      if (isNavigating4 && nav4StartBtn) {
        nav4StartBtn.click();
      }

      setQuestStage(10);
    });
  }

  // Point 4 Coin Throw Handler
  if (stage4ThrowCoinBtn) {
    stage4ThrowCoinBtn.addEventListener('click', () => {
      if (isCoinThrown) return;
      isCoinThrown = true;

      if (stage4CoinVisual) {
        stage4CoinVisual.classList.add('flipped');
      }

      if (navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }

      setTimeout(() => {
        if (stage4WishResult) {
          stage4WishResult.style.display = 'block';
        }
        stage4ThrowCoinBtn.style.background = '#2e7d32';
        stage4ThrowCoinBtn.innerHTML = '<span>Монетку кинуто ✓ Бажання загадано</span>';
        stage4ThrowCoinBtn.disabled = true;

        isCoinThrown = true;
        saveQuestProgress();

        // Award WinCoins
        // Point 4: no coins awarded for coin throw
      }, 700);
    });
  }

  // Proceed to Point 5 Click
  if (proceedPoint5Btn) {
    proceedPoint5Btn.addEventListener('click', () => {
      setQuestStage(11);
    });
  }

  // --- POINT 5 AUDIO GUIDE HANDLERS ---
  if (audio5PlayBtn) {
    audio5PlayBtn.addEventListener('click', async () => {
      if (!isAudio5Loaded) {
        await prepareAudioGuide5();
      }

      if (questAudio5.paused) {
        if (questAudio && !questAudio.paused) questAudio.pause();
        if (questAudio2 && !questAudio2.paused) questAudio2.pause();
        if (questAudio3 && !questAudio3.paused) questAudio3.pause();
        if (questAudio4 && !questAudio4.paused) questAudio4.pause();
        if (wagnerAudio && !wagnerAudio.paused) wagnerAudio.pause();

        questAudio5.play().then(() => {
          if (play5Icon) play5Icon.style.display = 'none';
          if (pause5Icon) pause5Icon.style.display = 'block';
        }).catch(err => {
          console.error('Audio 5 playback error:', err);
        });
      } else {
        questAudio5.pause();
        if (play5Icon) play5Icon.style.display = 'block';
        if (pause5Icon) pause5Icon.style.display = 'none';
      }
    });
  }

  if (questAudio5) {
    questAudio5.addEventListener('timeupdate', () => {
      const cur = questAudio5.currentTime;
      const dur = questAudio5.duration || 0;
      if (dur > 0 && audio5Progress) {
        audio5Progress.value = (cur / dur) * 100;
      }
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      if (audio5Time) {
        audio5Time.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    questAudio5.addEventListener('ended', () => {
      if (play5Icon) play5Icon.style.display = 'block';
      if (pause5Icon) pause5Icon.style.display = 'none';
      if (audio5Progress) audio5Progress.value = 0;
    });
  }

  if (audio5Progress) {
    audio5Progress.addEventListener('input', () => {
      const dur = questAudio5.duration || 0;
      if (dur > 0) {
        questAudio5.currentTime = (audio5Progress.value / 100) * dur;
      }
    });
  }

  // Toggle Navigation Mode for Point 5
  if (nav5StartBtn) {
    nav5StartBtn.addEventListener('click', () => {
      isNavigating5 = !isNavigating5;
      if (isNavigating5) {
        nav5StartBtn.querySelector('span').textContent = 'Стоп';
        nav5StartBtn.style.background = '#d97706';
        nav5StartBtn.querySelector('svg').innerHTML = '<rect x="4" y="4" width="16" height="16" fill="currentColor"></rect>';

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const bearing = calculateBearing(lat, lng, destLat5, destLng5);

            if (userMarker5) {
              userMarker5.setLatLng([lat, lng]);
              userMarker5.setIcon(createArrowIcon(bearing));
            }

            if (leafletMap5) {
              leafletMap5.setView([lat, lng], 18);
            }

            if (routingControl5) {
              routingControl5.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat5, destLng5)
              ]);
            }

            lastLat5 = lat;
            lastLng5 = lng;
          });
        }
      } else {
        nav5StartBtn.querySelector('span').textContent = 'Старт';
        nav5StartBtn.style.background = '#1e3d2f';
        nav5StartBtn.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

        if (userMarker5) {
          userMarker5.setIcon(blueDotIcon);
        }

        if (userMarker5 && leafletMap5) {
          const bounds = L.latLngBounds(
            [userMarker5.getLatLng().lat, userMarker5.getLatLng().lng],
            [destLat5, destLng5]
          );
          leafletMap5.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    });
  }

  // "Вже на місці" Button Click Handler for Point 5 -> Transition to Stage 12: Point 5 Task
  if (questArrivedBtn5) {
    questArrivedBtn5.addEventListener('click', () => {
      if (questAudio5 && !questAudio5.paused) {
        questAudio5.pause();
        if (play5Icon) play5Icon.style.display = 'block';
        if (pause5Icon) pause5Icon.style.display = 'none';
      }

      if (isNavigating5 && nav5StartBtn) {
        nav5StartBtn.click();
      }

      setQuestStage(12);
    });
  }

  // Initialize Point 5 Map
  function initQuestMap5() {
    if (leafletMap5 !== null) {
      leafletMap5.invalidateSize();
      return;
    }

    const mapElem = document.getElementById('quest-map-5');
    if (!mapElem) return;

    let userLat = (lastLat !== null) ? lastLat : 50.455497;
    let userLng = (lastLng !== null) ? lastLng : 30.526762;

    setupMap5();
    setTimeout(() => { if (leafletMap5) leafletMap5.invalidateSize(); }, 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          lastLat = userLat;
          lastLng = userLng;
          if (userMarker5) userMarker5.setLatLng([userLat, userLng]);
          if (routingControl5) routingControl5.setWaypoints([L.latLng(userLat, userLng), L.latLng(destLat5, destLng5)]);
        },
        (error) => {
          console.log('Geolocation access failed, using default coordinates.', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    function setupMap5() {
      try {
        leafletMap5 = L.map('quest-map-5').setView([destLat5, destLng5], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(leafletMap5);

        const destIcon = L.divIcon({
          className: 'quest-destination-marker',
          html: `<div style="background: #1e3d2f; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">5</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const destMarker = L.marker([destLat5, destLng5], { icon: destIcon }).addTo(leafletMap5);
        destMarker.bindPopup("<b>Точка 5</b><br>Національна філармонія України<br>Володимирський узвіз, 2");

        const userIcon = L.divIcon({
          className: 'quest-user-marker',
          html: `<div style="background: #3498db; color: white; border-radius: 50%; width: 22px; height: 22px; border: 3px solid white; box-shadow: 0 0 10px rgba(52, 152, 219, 0.8);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        userMarker5 = L.marker([userLat, userLng], { icon: userIcon }).addTo(leafletMap5);

        if (typeof L.Routing !== 'undefined') {
          routingControl5 = L.Routing.control({
            waypoints: [
              L.latLng(userLat, userLng),
              L.latLng(destLat5, destLng5)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            show: false,
            lineOptions: {
              styles: [{ color: '#1e3d2f', opacity: 0.8, weight: 5 }]
            },
            createMarker: () => null
          }).addTo(leafletMap5);
        }

        setTimeout(() => {
          if (leafletMap5) leafletMap5.invalidateSize();
        }, 300);
      } catch (e) {
        console.warn('Error setting up Point 5 map:', e);
      }
    }
  }

  // --- POINT 5 CAMERA & POSTER MANAGEMENT ---
  async function startCamera5() {
    if (stage5CameraLoading) stage5CameraLoading.style.display = 'flex';
    try {
      stopCamera5();
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      stage5Stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stage5CameraVideo) {
        stage5CameraVideo.srcObject = stage5Stream;
        await stage5CameraVideo.play();
        if (stage5CameraLoading) stage5CameraLoading.style.display = 'none';
      }
    } catch (err) {
      console.warn('Point 5 camera error / fallback:', err);
      if (stage5CameraLoading) {
        stage5CameraLoading.innerHTML = `
          <div style="padding: 12px; text-align: center;">
            <p style="font-size: 13px; margin-bottom: 8px;">Не вдалося увімкнути камеру.</p>
            <button type="button" id="stage5-retry-camera-btn" style="background: #4a6b3e; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Спробувати ще раз</button>
            <button type="button" id="stage5-pick-file-btn" style="background: transparent; color: #ffffff; border: 1px solid #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 600; margin-left: 6px; cursor: pointer;">Обрати фото</button>
          </div>
        `;
        const retryBtn = document.getElementById('stage5-retry-camera-btn');
        if (retryBtn) retryBtn.addEventListener('click', startCamera5);
        const pickBtn = document.getElementById('stage5-pick-file-btn');
        if (pickBtn && stage5FileInput) pickBtn.addEventListener('click', () => stage5FileInput.click());
      }
    }
  }

  function stopCamera5() {
    if (stage5Stream) {
      stage5Stream.getTracks().forEach(t => t.stop());
      stage5Stream = null;
    }
    if (stage5CameraVideo) {
      stage5CameraVideo.srcObject = null;
    }
  }

  // Format today's date in classical Ukrainian
  function getFormattedCurrentDate() {
    const today = new Date();
    const day = today.getDate();
    const months = [
      'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
      'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
    ];
    return `${day} ${months[today.getMonth()]} ${today.getFullYear()} року`;
  }

  // Shutter button click for Point 5
  if (stage5CaptureBtn) {
    stage5CaptureBtn.addEventListener('click', () => {
      // Trigger camera flash visual feedback
      const viewport = document.querySelector('.app-viewport') || document.body;
      const flashEl = document.createElement('div');
      flashEl.className = 'camera-flash-overlay camera-flash-active';
      flashEl.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #ffffff; z-index: 9999; pointer-events: none;';
      viewport.appendChild(flashEl);
      setTimeout(() => flashEl.remove(), 400);

      // Capture frame from video
      const canvas = document.createElement('canvas');
      const w = stage5CameraVideo && stage5CameraVideo.videoWidth > 0 ? stage5CameraVideo.videoWidth : 800;
      const h = stage5CameraVideo && stage5CameraVideo.videoHeight > 0 ? stage5CameraVideo.videoHeight : 600;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      if (stage5CameraVideo && stage5CameraVideo.videoWidth > 0) {
        ctx.drawImage(stage5CameraVideo, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#1e3d2f';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Афіша Національної філармонії', w / 2, h / 2);
      }

      stage5CapturedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      stopCamera5();
      proceedToPosterAnalysis(stage5CapturedDataUrl);
    });
  }

  // Fallback file input handling
  if (stage5FileInput) {
    stage5FileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          stage5CapturedDataUrl = evt.target.result;
          stopCamera5();
          proceedToPosterAnalysis(stage5CapturedDataUrl);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Transition from camera to scanning/analysis
  function proceedToPosterAnalysis(photoDataUrl) {
    if (stage5CameraBox) stage5CameraBox.style.display = 'none';
    if (stage5AnalysisCard) stage5AnalysisCard.style.display = 'block';
    if (stage5CapturedPreview) stage5CapturedPreview.src = photoDataUrl;
    if (stage5LaserLine) stage5LaserLine.style.display = 'block';
    if (stage5ExtractedInfo) stage5ExtractedInfo.style.display = 'none';
    if (stage5ScanStatusText) stage5ScanStatusText.textContent = 'Аналіз афіші... Розпізнавання заголовка';

    const currentDateStr = getFormattedCurrentDate();
    if (stage5CurrentDateBadge) {
      stage5CurrentDateBadge.textContent = currentDateStr;
    }

    // Simulate smart OCR detection delay
    setTimeout(() => {
      if (stage5LaserLine) stage5LaserLine.style.display = 'none';
      if (stage5ScanStatusText) stage5ScanStatusText.textContent = '✓ Афішу проаналізовано! Назву та дату визначено:';
      if (stage5ExtractedInfo) {
        stage5ExtractedInfo.style.display = 'flex';
      }
    }, 1600);
  }

  // Suggestion chips selection
  const suggestionChips = document.querySelectorAll('.suggestion-chip');
  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      suggestionChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const title = chip.getAttribute('data-title');
      if (stage5PosterTitleInput && title) {
        stage5PosterTitleInput.value = title;
      }
    });
  });

  if (stage5EditTitleBtn && stage5PosterTitleInput) {
    stage5EditTitleBtn.addEventListener('click', () => {
      stage5PosterTitleInput.focus();
      stage5PosterTitleInput.select();
    });
  }

  // Generate Vintage Poster click handler
  if (stage5GeneratePosterBtn) {
    stage5GeneratePosterBtn.addEventListener('click', () => {
      generateHistoricalPoster();
    });
  }

  // --- VINTAGE POSTER COMPOSITING ---
  function generateHistoricalPoster() {
    const canvas = stage5CompositeCanvas || document.createElement('canvas');
    const targetWidth = 1024;
    const targetHeight = 1536;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const concertTitle = (stage5PosterTitleInput && stage5PosterTitleInput.value.trim()) || 'Симфонія №5 Бетховена';

    // Load template image safely
    const templateImg = new Image();
    templateImg.onload = () => {
      renderPoster(templateImg);
    };
    templateImg.onerror = () => {
      console.warn('Template image load error, rendering procedural vintage poster');
      renderPoster(null);
    };
    // Prefer offline bundled asset
    templateImg.src = 'assets/shablon_filarmonia.png';

    function renderPoster(bgImg) {
      try {
        if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
          ctx.drawImage(bgImg, 0, 0, targetWidth, targetHeight);
        } else {
          // Vintage parchment fallback background
          ctx.fillStyle = '#f4ede1';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.strokeStyle = '#b89865';
          ctx.lineWidth = 14;
          ctx.strokeRect(30, 30, targetWidth - 60, targetHeight - 60);

          ctx.fillStyle = '#1e1a16';
          ctx.font = 'bold 44px Outfit, serif';
          ctx.textAlign = 'center';
          ctx.fillText('КИЇВСЬКЕ КУПЕЦЬКЕ ЗІБРАННЯ', targetWidth / 2, 140);
        }

        // 1. Draw photographed playbill in program rectangle over lines 1. 2. 3. 4. 5.
        if (stage5CapturedDataUrl) {
          const userImg = new Image();
          userImg.onload = () => {
            drawUserVignette(userImg);
            finishAndSavePoster();
          };
          userImg.onerror = () => {
            finishAndSavePoster();
          };
          userImg.src = stage5CapturedDataUrl;
        } else {
          finishAndSavePoster();
        }

        function drawUserVignette(uImg) {
          ctx.save();
          // Rectangle covering rows 1, 2, 3, 4, 5 under "ВЪ ПРОГРАММЂ:"
          const rx = 135;
          const ry = 885;
          const rw = 746;
          const rh = 325;

          // Aspect ratio cover calculation
          const imgW = uImg.naturalWidth || uImg.width || rw;
          const imgH = uImg.naturalHeight || uImg.height || rh;
          const imgRatio = imgW / imgH;
          const targetRatio = rw / rh;
          let sx = 0, sy = 0, sWidth = imgW, sHeight = imgH;

          if (imgRatio > targetRatio) {
            sHeight = imgH;
            sWidth = sHeight * targetRatio;
            sx = (imgW - sWidth) / 2;
            sy = 0;
          } else {
            sWidth = imgW;
            sHeight = sWidth / targetRatio;
            sx = 0;
            sy = (imgH - sHeight) / 2;
          }

          // Draw cropped photo in the rectangle
          ctx.drawImage(uImg, sx, sy, sWidth, sHeight, rx, ry, rw, rh);

          // Subtle sepia tint overlay to harmonize with vintage poster
          ctx.fillStyle = 'rgba(120, 80, 40, 0.12)';
          ctx.fillRect(rx, ry, rw, rh);

          // Outer vintage border
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#644b2d';
          ctx.strokeRect(rx, ry, rw, rh);

          // Inner gold hairline border
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(190, 160, 110, 0.75)';
          ctx.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);

          ctx.restore();
        }

        function finishAndSavePoster() {
          ctx.save();
          ctx.fillStyle = '#19140f';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // 2. Draw Concert Title below КОНЦЕРТЪ in Box 1 after first ВЪ (center X=385, Y=692)
          let titleFontSize = 22;
          if (concertTitle.length > 34) titleFontSize = 18;
          else if (concertTitle.length > 26) titleFontSize = 20;

          ctx.font = `bold ${titleFontSize}px "Playfair Display", "Georgia", serif`;

          const words = concertTitle.split(' ');
          let line1 = '';
          let line2 = '';

          if (concertTitle.length > 28) {
            words.forEach(w => {
              if ((line1 + ' ' + w).trim().length <= 24) {
                line1 += (line1 ? ' ' : '') + w;
              } else {
                line2 += (line2 ? ' ' : '') + w;
              }
            });
          } else {
            line1 = concertTitle;
          }

          // Line 1 in Box 1 after ВЪ
          ctx.fillText(line1, 385, 692);

          // Line 2 (or Hall description) in Box 2 after second ВЪ (center X=385, Y=757)
          if (line2) {
            ctx.fillText(line2, 385, 757);
          } else {
            ctx.font = `italic 18px "Playfair Display", "Georgia", serif`;
            ctx.fillStyle = '#3a2e22';
            ctx.fillText('Колонна зала Філармонії', 385, 757);
          }

          // 3. Draw day number in Box after ЧИСЛА (center X=835, Y=692)
          const now = new Date();
          const dayNum = now.getDate().toString();
          ctx.font = `bold 26px "Playfair Display", "Georgia", serif`;
          ctx.fillStyle = '#19140f';
          ctx.fillText(dayNum, 835, 692);

          // 4. Draw hour in Box after ЧАСОВЪ (center X=835, Y=757)
          ctx.font = `bold 24px "Playfair Display", "Georgia", serif`;
          ctx.fillText('19:00', 835, 757);

          ctx.restore();

          // Export final poster to JPEG
          try {
            stage5GeneratedPosterDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          } catch (expErr) {
            console.warn('Poster export error:', expErr);
            stage5GeneratedPosterDataUrl = stage5CapturedDataUrl;
          }

          if (stage5PosterPreviewImg && stage5GeneratedPosterDataUrl) {
            stage5PosterPreviewImg.src = stage5GeneratedPosterDataUrl;
          }

          // Save to device gallery
          const filename = `winogradsky_quest_point5_afisha_${Date.now()}.jpg`;
          if (window.AndroidGallery && typeof window.AndroidGallery.saveImageToGallery === 'function') {
            try {
              window.AndroidGallery.saveImageToGallery(stage5GeneratedPosterDataUrl, filename);
            } catch (galErr) {
              console.error('Error saving poster to gallery:', galErr);
            }
          }

          // Award WinCoins
          // Intermediate point: no coins awarded

          // Transition to Stage 13 (Result)
          setQuestStage(13);
        }
      } catch (genErr) {
        console.error('Error generating poster:', genErr);
        setQuestStage(13);
      }
    }
  }

  // Point 5 Result Handlers
  if (stage5RetakeBtn) {
    stage5RetakeBtn.addEventListener('click', () => {
      if (stage5CameraBox) stage5CameraBox.style.display = 'block';
      if (stage5AnalysisCard) stage5AnalysisCard.style.display = 'none';
      setQuestStage(12);
    });
  }

  if (stage5FullscreenBtn) {
    stage5FullscreenBtn.addEventListener('click', () => {
      if (fullscreenPhotoModal && stage5GeneratedPosterDataUrl) {
        if (fullscreenMergedImg) fullscreenMergedImg.src = stage5GeneratedPosterDataUrl;
        fullscreenPhotoModal.classList.add('active');
      }
    });
  }

  // Proceed to Point 6 Button Click
  if (proceedPoint6Btn) {
    proceedPoint6Btn.addEventListener('click', () => {
      setQuestStage(14);
    });
  }

  // Return from Point 6 Button Click
  if (returnFromPoint6Btn) {
    returnFromPoint6Btn.addEventListener('click', () => {
      switchScreen('quests-screen');
    });
  }

  // --- POINT 6 AUDIO GUIDE HANDLERS ---
  if (audio6PlayBtn) {
    audio6PlayBtn.addEventListener('click', async () => {
      if (!isAudio6Loaded) {
        await prepareAudioGuide6();
      }

      if (questAudio6.paused) {
        if (questAudio && !questAudio.paused) questAudio.pause();
        if (questAudio2 && !questAudio2.paused) questAudio2.pause();
        if (questAudio3 && !questAudio3.paused) questAudio3.pause();
        if (questAudio4 && !questAudio4.paused) questAudio4.pause();
        if (questAudio5 && !questAudio5.paused) questAudio5.pause();
        if (wagnerAudio && !wagnerAudio.paused) wagnerAudio.pause();

        questAudio6.play().then(() => {
          if (play6Icon) play6Icon.style.display = 'none';
          if (pause6Icon) pause6Icon.style.display = 'block';
        }).catch(err => {
          console.error('Audio 6 playback error:', err);
        });
      } else {
        questAudio6.pause();
        if (play6Icon) play6Icon.style.display = 'block';
        if (pause6Icon) pause6Icon.style.display = 'none';
      }
    });
  }

  if (questAudio6) {
    questAudio6.addEventListener('timeupdate', () => {
      const cur = questAudio6.currentTime;
      const dur = questAudio6.duration || 0;
      if (dur > 0 && audio6Progress) {
        audio6Progress.value = (cur / dur) * 100;
      }
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      if (audio6Time) {
        audio6Time.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    questAudio6.addEventListener('ended', () => {
      if (play6Icon) play6Icon.style.display = 'block';
      if (pause6Icon) pause6Icon.style.display = 'none';
      if (audio6Progress) audio6Progress.value = 0;
    });
  }

  if (audio6Progress) {
    audio6Progress.addEventListener('input', () => {
      const dur = questAudio6.duration || 0;
      if (dur > 0) {
        questAudio6.currentTime = (audio6Progress.value / 100) * dur;
      }
    });
  }

  // Toggle Navigation Mode for Point 6
  if (nav6StartBtn) {
    nav6StartBtn.addEventListener('click', () => {
      isNavigating6 = !isNavigating6;
      if (isNavigating6) {
        nav6StartBtn.querySelector('span').textContent = 'Стоп';
        nav6StartBtn.style.background = '#d97706';
        nav6StartBtn.querySelector('svg').innerHTML = '<rect x="4" y="4" width="16" height="16" fill="currentColor"></rect>';

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const bearing = calculateBearing(lat, lng, destLat6, destLng6);

            if (userMarker6) {
              userMarker6.setLatLng([lat, lng]);
              userMarker6.setIcon(createArrowIcon(bearing));
            }

            if (leafletMap6) {
              leafletMap6.setView([lat, lng], 18);
            }

            if (routingControl6) {
              routingControl6.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat6, destLng6)
              ]);
            }

            lastLat6 = lat;
            lastLng6 = lng;
          });
        }
      } else {
        nav6StartBtn.querySelector('span').textContent = 'Старт';
        nav6StartBtn.style.background = '#1e3d2f';
        nav6StartBtn.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

        if (userMarker6) {
          userMarker6.setIcon(blueDotIcon);
        }

        if (userMarker6 && leafletMap6) {
          const bounds = L.latLngBounds(
            [userMarker6.getLatLng().lat, userMarker6.getLatLng().lng],
            [destLat6, destLng6]
          );
          leafletMap6.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    });
  }

  // "Вже на місці" Button Click Handler for Point 6 -> Transition to Stage 15: Point 6 Task
  if (questArrivedBtn6) {
    questArrivedBtn6.addEventListener('click', () => {
      if (questAudio6 && !questAudio6.paused) {
        questAudio6.pause();
        if (play6Icon) play6Icon.style.display = 'block';
        if (pause6Icon) pause6Icon.style.display = 'none';
      }

      if (isNavigating6 && nav6StartBtn) {
        nav6StartBtn.click();
      }

      setQuestStage(15);
    });
  }

  // Initialize Point 6 Map
  function initQuestMap6() {
    if (leafletMap6 !== null) {
      leafletMap6.invalidateSize();
      return;
    }

    const mapElem = document.getElementById('quest-map-6');
    if (!mapElem) return;

    let userLat = (lastLat !== null) ? lastLat : 50.453113; // from Point 5 (Philharmonic)
    let userLng = (lastLng !== null) ? lastLng : 30.528007;

    setupMap6();
    setTimeout(() => { if (leafletMap6) leafletMap6.invalidateSize(); }, 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          lastLat = userLat;
          lastLng = userLng;
          if (userMarker6) userMarker6.setLatLng([userLat, userLng]);
          if (routingControl6) routingControl6.setWaypoints([L.latLng(userLat, userLng), L.latLng(destLat6, destLng6)]);
        },
        (error) => {
          console.log('Geolocation access failed, using default coordinates.', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    function setupMap6() {
      try {
        leafletMap6 = L.map('quest-map-6').setView([destLat6, destLng6], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(leafletMap6);

        const destIcon = L.divIcon({
          className: 'quest-destination-marker',
          html: `<div style="background: #1e3d2f; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">6</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const destMarker = L.marker([destLat6, destLng6], { icon: destIcon }).addTo(leafletMap6);
        destMarker.bindPopup("<b>Точка 6</b><br>Друга київська гімназія<br>бульвар Тараса Шевченка, 18");

        const userIcon = L.divIcon({
          className: 'quest-user-marker',
          html: `<div style="background: #3498db; color: white; border-radius: 50%; width: 22px; height: 22px; border: 3px solid white; box-shadow: 0 0 10px rgba(52, 152, 219, 0.8);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        userMarker6 = L.marker([userLat, userLng], { icon: userIcon }).addTo(leafletMap6);

        if (typeof L.Routing !== 'undefined') {
          routingControl6 = L.Routing.control({
            waypoints: [
              L.latLng(userLat, userLng),
              L.latLng(destLat6, destLng6)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            show: false,
            lineOptions: {
              styles: [{ color: '#1e3d2f', opacity: 0.8, weight: 5 }]
            },
            createMarker: () => null
          }).addTo(leafletMap6);
        }

        setTimeout(() => {
          if (leafletMap6) leafletMap6.invalidateSize();
        }, 300);
      } catch (e) {
        console.warn('Error setting up Point 6 map:', e);
      }
    }
  }

  // --- POINT 6 QUIZ SYSTEM (1910 SEVRUK NATURAL SCIENCE TEXTBOOK) ---
  const quizQuestions = [
    {
      question: "Тепліше чи холодніше стає повітря від випарювання води?",
      options: [
        { label: "а. Тепліше", text: "Тепліше", isCorrect: false },
        { label: "б. Холодніше", text: "Холодніше", isCorrect: true }
      ],
      correctText: "Холодніше",
      explanation: "Під час випарювання вода забирає тепло з навколишнього середовища. Через це повітря або поверхня, з якої випаровується вода, охолоджується, втрачаючи частину теплоти."
    },
    {
      question: "Від чого захищає ящірку луска на її тілі?",
      options: [
        { label: "а. Від холоду та вологи", text: "Від холоду та вологи", isCorrect: false },
        { label: "б. Від висихання та ушкоджень", text: "Від висихання та ушкоджень", isCorrect: true },
        { label: "в. Від отрути та шкідливих речовин", text: "Від отрути та шкідливих речовин", isCorrect: false }
      ],
      correctText: "Від висихання та ушкоджень",
      explanation: "Луска покриває тіло ящірки щільним захисним шаром, що допомагає зменшити втрату вологи, тобто захищає від висихання, а також оберігає шкіру від дрібних механічних ушкоджень."
    },
    {
      question: "Чи зручно змії повзати по гладкому склу?",
      options: [
        { label: "а. Так", text: "Так", isCorrect: false },
        { label: "б. Ні", text: "Ні", isCorrect: true }
      ],
      correctText: "Ні",
      explanation: "Змія пересувається, чіпляючись поверхнею за нерівності, а гладке скло не дає достатнього зчеплення, тому змії на ньому повзати незручно."
    },
    {
      question: "Чи можна дізнатися вік кожної гілки дерева?",
      options: [
        { label: "а. Так", text: "Так", isCorrect: true },
        { label: "б. Ні", text: "Ні", isCorrect: false }
      ],
      correctText: "Так",
      explanation: "За кільцями можна визначити вік не тільки стовбура, але й кожної гілки."
    },
    {
      question: "Що спільного у вуглекислого газу з азотом?",
      options: [
        { label: "а. Обидва мають солодкий смак", text: "Обидва мають солодкий смак", isCorrect: false },
        { label: "б. Обидва підтримують горіння", text: "Обидва підтримують горіння", isCorrect: false },
        { label: "в. Обидва є газами", text: "Обидва є газами", isCorrect: true }
      ],
      correctText: "Обидва є газами",
      explanation: "Як вуглекислий газ, так і азот за звичайних умов є газами, це їхня спільна фізична ознака. Інших вищеперерахованих характеристик ці гази не мають."
    }
  ];

  function initPoint6Quiz(resume = false) {
    if (!resume) {
      currentQuizIndex = 0;
      quizScore = 0;
      quizAnswered = false;
    }

    if (currentQuizIndex >= quizQuestions.length) {
      finishQuiz();
      return;
    }

    if (point6QuestionCard) point6QuestionCard.style.display = 'block';
    if (point6QuizResult) point6QuizResult.style.display = 'none';

    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    quizAnswered = false;
    const q = quizQuestions[currentQuizIndex];
    if (!q) {
      finishQuiz();
      return;
    }

    // Progress updates
    const totalQ = quizQuestions.length;
    if (point6QuizStepTitle) point6QuizStepTitle.textContent = `Питання ${currentQuizIndex + 1} з ${totalQ}`;
    if (point6QuizScoreBadge) point6QuizScoreBadge.textContent = `Рахунок: ${quizScore}`;
    if (point6QuizProgressFill) {
      point6QuizProgressFill.style.width = `${((currentQuizIndex + 1) / totalQ) * 100}%`;
    }

    // Question title
    if (point6QuestionTitle) {
      point6QuestionTitle.textContent = `${currentQuizIndex + 1}. ${q.question}`;
    }

    // Reset and hide explanation
    if (point6ExplanationCard) {
      point6ExplanationCard.style.display = 'none';
    }

    // Options rendering
    if (point6OptionsContainer) {
      point6OptionsContainer.innerHTML = '';
      q.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-option-btn';
        btn.innerHTML = `
          <span>${opt.label}</span>
          <span class="option-indicator"></span>
        `;

        btn.addEventListener('click', () => {
          if (quizAnswered) return;
          handleQuizAnswer(opt, btn, q);
        });

        point6OptionsContainer.appendChild(btn);
      });
    }
  }

  function handleQuizAnswer(selectedOpt, selectedBtn, questionData) {
    quizAnswered = true;

    // Disable all option buttons
    const allBtns = point6OptionsContainer.querySelectorAll('.quiz-option-btn');
    allBtns.forEach(b => {
      b.disabled = true;
    });

    if (selectedOpt.isCorrect) {
      selectedBtn.classList.add('correct');
      const ind = selectedBtn.querySelector('.option-indicator');
      if (ind) ind.textContent = '✓';
      quizScore++;
      if (point6QuizScoreBadge) point6QuizScoreBadge.textContent = `Рахунок: ${quizScore}`;

      if (navigator.vibrate) {
        try { navigator.vibrate(60); } catch (e) {}
      }
    } else {
      selectedBtn.classList.add('incorrect');
      const ind = selectedBtn.querySelector('.option-indicator');
      if (ind) ind.textContent = '✕';

      // Highlight the correct answer in green
      allBtns.forEach(b => {
        if (b.textContent.includes(questionData.correctText)) {
          b.classList.add('correct');
          const cInd = b.querySelector('.option-indicator');
          if (cInd) cInd.textContent = '✓';
        }
      });

      if (navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }
    }

    // Show explanation card
    if (point6ExplanationCard && point6ExplanationText) {
      point6ExplanationText.textContent = questionData.explanation;
      point6ExplanationCard.style.display = 'block';

      // Scroll smoothly to explanation
      setTimeout(() => {
        point6ExplanationCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }

  // Next Question Button Click
  if (point6NextBtn) {
    point6NextBtn.addEventListener('click', () => {
      if (currentQuizIndex < quizQuestions.length - 1) {
        currentQuizIndex++;
        saveQuestProgress();
        renderQuizQuestion();
      } else {
        currentQuizIndex = quizQuestions.length;
        saveQuestProgress();
        finishQuiz();
      }
    });
  }

  // Finish Quiz and show result card
  function finishQuiz() {
    if (point6QuestionCard) point6QuestionCard.style.display = 'none';
    if (point6QuizResult) point6QuizResult.style.display = 'block';

    const totalQ = quizQuestions.length;
    if (point6FinalScoreText) {
      point6FinalScoreText.textContent = `Ви дали ${quizScore} з ${totalQ} правильних відповідей.`;
    }

    // Award WinCoins: 1 coin per correct answer (up to 5 coins)
    if (!isPoint6QuizCompleted) {
      isPoint6QuizCompleted = true;
      if (quizScore > 0) {
        addCoins(quizScore, `Квест: Точка 6 (Іспит у гімназії 1910 р., ${quizScore} з 5)`);
      }
      saveQuestProgress();
    }

    const rewardBadge = point6QuizResult.querySelector('.point2-reward-badge');
    if (rewardBadge) {
      rewardBadge.textContent = `🪙 +${quizScore} WinCoins (${quizScore} з 5 правильних відповідей)`;
    }
  }

  // Proceed to Point 7 Button Click
  if (proceedPoint7Btn) {
    proceedPoint7Btn.addEventListener('click', () => {
      setQuestStage(16);
    });
  }

  // Return from Point 7 Button Click
  if (returnFromPoint7Btn) {
    returnFromPoint7Btn.addEventListener('click', () => {
      switchScreen('quests-screen');
    });
  }

  // --- POINT 7 AUDIO GUIDE HANDLERS ---
  if (audio7PlayBtn) {
    audio7PlayBtn.addEventListener('click', async () => {
      if (!isAudio7Loaded) {
        await prepareAudioGuide7();
      }

      if (questAudio7.paused) {
        if (questAudio && !questAudio.paused) questAudio.pause();
        if (questAudio2 && !questAudio2.paused) questAudio2.pause();
        if (questAudio3 && !questAudio3.paused) questAudio3.pause();
        if (questAudio4 && !questAudio4.paused) questAudio4.pause();
        if (questAudio5 && !questAudio5.paused) questAudio5.pause();
        if (questAudio6 && !questAudio6.paused) questAudio6.pause();
        if (wagnerAudio && !wagnerAudio.paused) wagnerAudio.pause();

        questAudio7.play().then(() => {
          if (play7Icon) play7Icon.style.display = 'none';
          if (pause7Icon) pause7Icon.style.display = 'block';
        }).catch(err => {
          console.error('Audio 7 playback error:', err);
        });
      } else {
        questAudio7.pause();
        if (play7Icon) play7Icon.style.display = 'block';
        if (pause7Icon) pause7Icon.style.display = 'none';
      }
    });
  }

  if (questAudio7) {
    questAudio7.addEventListener('timeupdate', () => {
      const cur = questAudio7.currentTime;
      const dur = questAudio7.duration || 0;
      if (dur > 0 && audio7Progress) {
        audio7Progress.value = (cur / dur) * 100;
      }
      const formatTime = (time) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      if (audio7Time) {
        audio7Time.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    questAudio7.addEventListener('ended', () => {
      if (play7Icon) play7Icon.style.display = 'block';
      if (pause7Icon) pause7Icon.style.display = 'none';
      if (audio7Progress) audio7Progress.value = 0;
    });
  }

  if (audio7Progress) {
    audio7Progress.addEventListener('input', () => {
      const dur = questAudio7.duration || 0;
      if (dur > 0) {
        questAudio7.currentTime = (audio7Progress.value / 100) * dur;
      }
    });
  }

  // Toggle Navigation Mode for Point 7
  if (nav7StartBtn) {
    nav7StartBtn.addEventListener('click', () => {
      isNavigating7 = !isNavigating7;
      if (isNavigating7) {
        nav7StartBtn.querySelector('span').textContent = 'Стоп';
        nav7StartBtn.style.background = '#d97706';
        nav7StartBtn.querySelector('svg').innerHTML = '<rect x="4" y="4" width="16" height="16" fill="currentColor"></rect>';

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const bearing = calculateBearing(lat, lng, destLat7, destLng7);

            if (userMarker7) {
              userMarker7.setLatLng([lat, lng]);
              userMarker7.setIcon(createArrowIcon(bearing));
            }

            if (leafletMap7) {
              leafletMap7.setView([lat, lng], 17);
            }

            if (routingControl7) {
              routingControl7.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat7, destLng7)
              ]);
            }
          }, null, { enableHighAccuracy: true });
        }
      } else {
        nav7StartBtn.querySelector('span').textContent = 'Старт';
        nav7StartBtn.style.background = '#1e3d2f';
        nav7StartBtn.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

        if (userMarker7) {
          const defaultIcon = L.divIcon({
            className: 'quest-user-marker',
            html: `<div style="background: #3498db; color: white; border-radius: 50%; width: 22px; height: 22px; border: 3px solid white; box-shadow: 0 0 10px rgba(52, 152, 219, 0.8);"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });
          userMarker7.setIcon(defaultIcon);
        }

        if (leafletMap7) {
          leafletMap7.setView([destLat7, destLng7], 16);
        }
      }
    });
  }

  // "Вже на місці" Button Click Handler for Point 7 -> Transition to Stage 17: Point 7 Task / In Development
  if (questArrivedBtn7) {
    questArrivedBtn7.addEventListener('click', () => {
      if (questAudio7 && !questAudio7.paused) {
        questAudio7.pause();
        if (play7Icon) play7Icon.style.display = 'block';
        if (pause7Icon) pause7Icon.style.display = 'none';
      }

      if (isNavigating7 && nav7StartBtn) {
        nav7StartBtn.click();
      }

      setQuestStage(17);
    });
  }

  // Initialize Point 7 Map
  function initQuestMap7() {
    if (leafletMap7 !== null) {
      leafletMap7.invalidateSize();
      return;
    }

    const mapElem = document.getElementById('quest-map-7');
    if (!mapElem) return;

    let userLat = (lastLat !== null) ? lastLat : 50.444081; // from Point 6 (Gymnasium)
    let userLng = (lastLng !== null) ? lastLng : 30.510751;

    setupMap7();
    setTimeout(() => { if (leafletMap7) leafletMap7.invalidateSize(); }, 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          lastLat = userLat;
          lastLng = userLng;
          if (userMarker7) userMarker7.setLatLng([userLat, userLng]);
          if (routingControl7) routingControl7.setWaypoints([L.latLng(userLat, userLng), L.latLng(destLat7, destLng7)]);
        },
        (error) => {
          console.log('Geolocation access failed, using default coordinates.', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    function setupMap7() {
      try {
        leafletMap7 = L.map('quest-map-7').setView([destLat7, destLng7], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(leafletMap7);

        const destIcon = L.divIcon({
          className: 'quest-destination-marker',
          html: `<div style="background: #1e3d2f; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">7</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const destMarker = L.marker([destLat7, destLng7], { icon: destIcon }).addTo(leafletMap7);
        destMarker.bindPopup("<b>Точка 7</b><br>Університет Святого Володимира<br>Володимирська, 60");

        const userIcon = L.divIcon({
          className: 'quest-user-marker',
          html: `<div style="background: #3498db; color: white; border-radius: 50%; width: 22px; height: 22px; border: 3px solid white; box-shadow: 0 0 10px rgba(52, 152, 219, 0.8);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        userMarker7 = L.marker([userLat, userLng], { icon: userIcon }).addTo(leafletMap7);

        if (typeof L.Routing !== 'undefined') {
          routingControl7 = L.Routing.control({
            waypoints: [
              L.latLng(userLat, userLng),
              L.latLng(destLat7, destLng7)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            show: false,
            lineOptions: {
              styles: [{ color: '#1e3d2f', opacity: 0.8, weight: 5 }]
            },
            createMarker: () => null
          }).addTo(leafletMap7);
        }

        setTimeout(() => {
          if (leafletMap7) leafletMap7.invalidateSize();
        }, 300);
      } catch (e) {
        console.warn('Error setting up Point 7 map:', e);
      }
    }
  }



  // --- POINT 1 CAMERA MANAGEMENT ---
  async function startCamera() {
    if (cameraLoadingOverlay) cameraLoadingOverlay.style.display = 'flex';
    
    try {
      stopCamera();
      
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (cameraVideo) {
        cameraVideo.srcObject = cameraStream;
        await cameraVideo.play();
        if (cameraLoadingOverlay) cameraLoadingOverlay.style.display = 'none';
      }
    } catch (err) {
      console.warn('Camera stream error / fallback:', err);
      if (cameraLoadingOverlay) {
        cameraLoadingOverlay.innerHTML = `
          <div style="padding: 12px; text-align: center;">
            <p style="font-size: 13px; margin-bottom: 8px;">Не вдалося отримати доступ до камери.</p>
            <button id="retry-camera-btn" style="background: #4a6b3e; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Спробувати ще раз</button>
          </div>
        `;
        const retryBtn = document.getElementById('retry-camera-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', startCamera);
        }
      }
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
  }

  // --- POINT 2 CAMERA & ZOOM MANAGEMENT ---
  async function startCamera2() {
    if (stage2CameraLoading) stage2CameraLoading.style.display = 'flex';
    
    try {
      stopCamera2();
      
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      stage2CameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stage2Video) {
        stage2Video.srcObject = stage2CameraStream;
        await stage2Video.play();
        if (stage2CameraLoading) stage2CameraLoading.style.display = 'none';
        applyZoom(stage2CurrentZoom || 1.0);
      }
    } catch (err) {
      console.warn('Stage 2 Camera error / fallback:', err);
      if (stage2CameraLoading) {
        stage2CameraLoading.innerHTML = `
          <div style="padding: 12px; text-align: center;">
            <p style="font-size: 13px; margin-bottom: 8px;">Не вдалося отримати доступ до камери.</p>
            <button id="retry-camera2-btn" style="background: #4a6b3e; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Спробувати ще раз</button>
          </div>
        `;
        const retryBtn = document.getElementById('retry-camera2-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', startCamera2);
        }
      }
    }
  }

  function stopCamera2() {
    if (stage2CameraStream) {
      stage2CameraStream.getTracks().forEach(track => track.stop());
      stage2CameraStream = null;
    }
    if (stage2Video) {
      stage2Video.srcObject = null;
    }
  }

  function applyZoom(zoomVal) {
    stage2CurrentZoom = Math.min(Math.max(parseFloat(zoomVal), 1.0), 5.0);
    if (stage2ZoomSlider) stage2ZoomSlider.value = stage2CurrentZoom.toFixed(1);
    if (stage2ZoomLabel) stage2ZoomLabel.textContent = `${stage2CurrentZoom.toFixed(1)}x`;

    // 1. Digital CSS zoom on video element
    if (stage2Video) {
      stage2Video.style.transform = `scale(${stage2CurrentZoom})`;
    }

    // 2. Hardware optical/digital camera track zoom if supported by Android browser
    if (stage2CameraStream) {
      const track = stage2CameraStream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities();
        if (capabilities.zoom) {
          track.applyConstraints({
            advanced: [{ zoom: stage2CurrentZoom }]
          }).catch(e => console.log('Hardware zoom not applied:', e));
        }
      }
    }

    // Update preset chips active state
    if (stage2ZoomChips) {
      stage2ZoomChips.forEach(chip => {
        const chipVal = parseFloat(chip.getAttribute('data-zoom'));
        if (Math.abs(chipVal - stage2CurrentZoom) < 0.1) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }
  }

  // Zoom controls event listeners
  if (stage2ZoomSlider) {
    stage2ZoomSlider.addEventListener('input', (e) => {
      applyZoom(e.target.value);
    });
  }

  if (stage2ZoomMinus) {
    stage2ZoomMinus.addEventListener('click', () => {
      applyZoom(stage2CurrentZoom - 0.5);
    });
  }

  if (stage2ZoomPlus) {
    stage2ZoomPlus.addEventListener('click', () => {
      applyZoom(stage2CurrentZoom + 0.5);
    });
  }

  if (stage2ZoomChips) {
    stage2ZoomChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const z = parseFloat(chip.getAttribute('data-zoom'));
        applyZoom(z);
      });
    });
  }

  // Setup Relief step (1 or 2) with transparent overlay PNG from server
  function setupReliefStep(step) {
    currentReliefIndex = step;
    const serverBase = API_URL.replace(/\/api\/?$/, '');
    const remotePng = `${serverBase}/uploads/quest/stage2_${step}.png`;
    const localPng = `assets/stage2_${step}.png`;

    if (stage2OverlayImg) {
      stage2OverlayImg.style.opacity = '0.2';
      const imgTest = new Image();
      imgTest.onload = () => {
        stage2OverlayImg.src = remotePng;
        stage2OverlayImg.style.opacity = '0.5';
      };
      imgTest.onerror = () => {
        stage2OverlayImg.src = localPng;
        stage2OverlayImg.style.opacity = '0.5';
      };
      imgTest.src = remotePng;
    }

    if (stage2StepPill) {
      stage2StepPill.textContent = `Барельєф ${step} з 2`;
    }

    if (stage2CaptureText) {
      stage2CaptureText.textContent = `Сфотографувати барельєф ${step}`;
    }

    if (stage2GuideHint) {
      stage2GuideHint.textContent = (step === 1)
        ? 'Сумістіть розетку з ліпниною на дзвінниці'
        : 'Сумістіть арку з ліпниною на дзвінниці';
    }
  }

  // Stage 2 Capture Relief Photo Click
  if (stage2CaptureBtn) {
    stage2CaptureBtn.addEventListener('click', () => {
      captureStage2ReliefPhoto();
    });
  }

  function captureStage2ReliefPhoto() {
    // 1. Camera flash animation
    const viewport = document.querySelector('.app-viewport') || document.body;
    const flashEl = document.createElement('div');
    flashEl.className = 'camera-flash-overlay camera-flash-active';
    flashEl.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #ffffff; z-index: 9999; pointer-events: none;';
    viewport.appendChild(flashEl);
    setTimeout(() => flashEl.remove(), 400);

    // 2. High resolution canvas compositing with current zoom
    const canvas = hiddenMergeCanvas || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const canvasW = 900;
    const canvasH = 1200;
    canvas.width = canvasW;
    canvas.height = canvasH;

    // Draw zoomed video frame
    if (stage2Video && stage2Video.videoWidth > 0 && stage2Video.videoHeight > 0) {
      const vWidth = stage2Video.videoWidth;
      const vHeight = stage2Video.videoHeight;
      const zoom = stage2CurrentZoom || 1.0;

      const cropW = vWidth / zoom;
      const cropH = vHeight / zoom;
      const cropX = (vWidth - cropW) / 2;
      const cropY = (vHeight - cropH) / 2;

      ctx.drawImage(
        stage2Video,
        cropX, cropY, cropW, cropH,
        0, 0, canvasW, canvasH
      );
    } else {
      ctx.fillStyle = '#1e3d2f';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Софійська дзвіниця • Барельєф ${currentReliefIndex}`, canvasW / 2, canvasH / 2);
    }

    // Draw caption watermark at bottom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, canvasH - 70, canvasW, 70);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px Outfit, sans-serif';
    ctx.fillText(`С. М. Виноградський • Точка 2: Барельєф #${currentReliefIndex}`, 30, canvasH - 26);
    ctx.textAlign = 'right';
    ctx.font = '20px Outfit, sans-serif';
    ctx.fillText('Софія Київська, 2026', canvasW - 30, canvasH - 26);

    const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Save to phone gallery
    const filename = `winogradsky_quest_point2_relief${currentReliefIndex}_${Date.now()}.jpg`;
    if (window.AndroidGallery && typeof window.AndroidGallery.saveImageToGallery === 'function') {
      try {
        window.AndroidGallery.saveImageToGallery(capturedDataUrl, filename);
        console.log('[GalleryBridge] Saved relief photo to gallery:', filename);
      } catch (e) {
        console.error('[GalleryBridge] Error saving relief photo to gallery:', e);
      }
    }

    if (currentReliefIndex === 1) {
      stage2CapturedImg1Data = capturedDataUrl;
      if (stage2ResultImg1) stage2ResultImg1.src = capturedDataUrl;
      currentReliefIndex = 2;
      saveQuestProgress();
      // addCoins(2, 'Квест: Точка 2 (Барельєф 1 - Ліпнина)'); // Awarded upon final quest completion
      // Transition to Relief 2
      setupReliefStep(2);
    } else {
      stage2CapturedImg2Data = capturedDataUrl;
      if (stage2ResultImg2) stage2ResultImg2.src = capturedDataUrl;
      // addCoins(3, 'Квест: Точка 2 (Барельєф 2 - Ліпнина)'); // Awarded upon final quest completion
      
      // Point 2 completed, continuing to Point 3
      
      // Transition to Stage 6 (Point 2 Completion View)
      setQuestStage(6);
    }
  }

  // Proceed to Point 3 button click
  if (proceedPoint3Btn) {
    proceedPoint3Btn.addEventListener('click', () => {
      // Transition to Stage 7 (Point 3 Navigation)
      setQuestStage(7);
    });
  }

  // --- PHOTO MERGING & SAVING (POINT 1) ---
  if (capturePhotoBtn) {
    capturePhotoBtn.addEventListener('click', () => {
      // Trigger camera flash visual feedback
      const viewport = document.querySelector('.app-viewport') || document.body;
      const flashEl = document.createElement('div');
      flashEl.className = 'camera-flash-overlay camera-flash-active';
      flashEl.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #ffffff; z-index: 9999; pointer-events: none;';
      viewport.appendChild(flashEl);
      setTimeout(() => flashEl.remove(), 400);

      // Perform Canvas Compositing
      mergeAndSavePhotos();
    });
  }

  function mergeAndSavePhotos() {
    try {
      const canvas = hiddenMergeCanvas || document.getElementById('hidden-merge-canvas') || document.createElement('canvas');
      if (!canvas) {
        setQuestStage(3);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setQuestStage(3);
        return;
      }

      const vintageImg = vintageGuideImg || document.getElementById('vintage-guide-img');

      // Base dimensions from historical photo (vega.jpg from server: 336x567)
      const imgW = (vintageImg && vintageImg.naturalWidth > 0) ? vintageImg.naturalWidth : 336;
      const imgH = (vintageImg && vintageImg.naturalHeight > 0) ? vintageImg.naturalHeight : 567;

      // High resolution canvas target matching exact 2x aspect ratio of the 2 photos side by side
      const canvasHeight = 1134; // 2x height
      const halfWidth = Math.round(canvasHeight * (imgW / imgH)); // 868px (exact aspect ratio)
      const totalWidth = halfWidth * 2; // 1736px

      canvas.width = totalWidth;
      canvas.height = canvasHeight;

      // 1. Draw modern camera frame on the LEFT half with PROPORTIONAL crop (NO horizontal/vertical stretching!)
      if (cameraVideo && cameraVideo.videoWidth > 0 && cameraVideo.videoHeight > 0) {
        const vWidth = cameraVideo.videoWidth;
        const vHeight = cameraVideo.videoHeight;
        const targetRatio = halfWidth / canvasHeight; // exact ratio of half photo (0.7654)
        const videoRatio = vWidth / vHeight;

        let sx, sy, sWidth, sHeight;
        if (videoRatio > targetRatio) {
          // Video is wider than target: crop left & right sides, keep full vertical height
          sHeight = vHeight;
          sWidth = sHeight * targetRatio;
          sx = (vWidth - sWidth) / 2;
          sy = 0;
        } else {
          // Video is taller than target: crop top & bottom, keep full horizontal width
          sWidth = vWidth;
          sHeight = sWidth / targetRatio;
          sx = 0;
          sy = (vHeight - sHeight) / 2;
        }

        ctx.drawImage(
          cameraVideo,
          sx, sy, sWidth, sHeight,
          0, 0, halfWidth, canvasHeight
        );
      } else {
        ctx.fillStyle = '#2d382e';
        ctx.fillRect(0, 0, halfWidth, canvasHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Сучасний Київ (Точка 1)', halfWidth / 2, canvasHeight / 2);
      }

      // 2. Draw ENTIRE historical photo on the RIGHT half with ZERO cropping, ZERO distortion, and NO black gap!
      let drewVintage = false;
      if (vintageImg && vintageImg.naturalWidth > 0) {
        try {
          ctx.drawImage(
            vintageImg,
            0, 0, imgW, imgH,                      // Source: 100% of historical image
            halfWidth, 0, halfWidth, canvasHeight  // Dest: entire right half, touches left photo seamlessly
          );
          drewVintage = true;
        } catch (drawErr) {
          console.warn('Could not draw vintage image directly to canvas:', drawErr);
        }
      }

      if (!drewVintage) {
        ctx.fillStyle = '#1b261e';
        ctx.fillRect(halfWidth, 0, halfWidth, canvasHeight);
        ctx.fillStyle = '#c8a97e';
        ctx.font = 'bold 28px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Історична пам\'ятка 1890-х рр.', halfWidth + halfWidth / 2, canvasHeight / 2);
      }

      // Bottom caption bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, canvasHeight - 70, totalWidth, 70);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = 'bold 26px Outfit, sans-serif';
      ctx.fillText('С. М. Виноградський • Точка 1: Пожежна станція', 36, canvasHeight - 26);
      ctx.textAlign = 'right';
      ctx.font = '22px Outfit, sans-serif';
      ctx.fillText('Київ, 2026', totalWidth - 36, canvasHeight - 26);

      // Export as high-quality JPEG
      let capturedData = null;
      try {
        capturedData = canvas.toDataURL('image/jpeg', 0.95);
      } catch (canvasErr) {
        console.warn('Primary canvas.toDataURL failed, falling back to clean canvas:', canvasErr);
        try {
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = totalWidth;
          fallbackCanvas.height = canvasHeight;
          const fbCtx = fallbackCanvas.getContext('2d');
          if (cameraVideo && cameraVideo.videoWidth > 0 && cameraVideo.videoHeight > 0) {
            fbCtx.drawImage(cameraVideo, 0, 0, halfWidth, canvasHeight);
          } else {
            fbCtx.fillStyle = '#2d382e';
            fbCtx.fillRect(0, 0, halfWidth, canvasHeight);
          }
          fbCtx.fillStyle = '#1b261e';
          fbCtx.fillRect(halfWidth, 0, halfWidth, canvasHeight);
          fbCtx.fillStyle = '#c8a97e';
          fbCtx.font = 'bold 28px Outfit, sans-serif';
          fbCtx.textAlign = 'center';
          fbCtx.fillText('Історична пам\'ятка', halfWidth + halfWidth / 2, canvasHeight / 2);

          fbCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          fbCtx.fillRect(0, canvasHeight - 70, totalWidth, 70);
          fbCtx.fillStyle = '#ffffff';
          fbCtx.textAlign = 'left';
          fbCtx.font = 'bold 26px Outfit, sans-serif';
          fbCtx.fillText('С. М. Виноградський • Точка 1: Пожежна станція', 36, canvasHeight - 26);

          capturedData = fallbackCanvas.toDataURL('image/jpeg', 0.9);
        } catch (fbErr) {
          console.error('Fallback canvas export failed:', fbErr);
        }
      }

      if (capturedData) {
        capturedMergedDataUrl = capturedData;
        if (mergedResultImg) mergedResultImg.src = capturedData;
        if (fullscreenMergedImg) fullscreenMergedImg.src = capturedData;
        savePhotoToGallery(capturedData);
      }
    } catch (err) {
      console.error('Error during mergeAndSavePhotos:', err);
    } finally {
      // Transition to Stage 3 (Result Preview) is guaranteed to run
      setQuestStage(3);
    }
  }

  function savePhotoToGallery(dataUrl) {
    const filename = `winogradsky_quest_point1_${Date.now()}.jpg`;

    // 1. Android Native MediaStore Bridge
    if (window.AndroidGallery && typeof window.AndroidGallery.saveImageToGallery === 'function') {
      try {
        const saved = window.AndroidGallery.saveImageToGallery(dataUrl, filename);
        console.log('[GalleryBridge] Saved to native gallery:', saved);
      } catch (e) {
        console.error('[GalleryBridge] Error saving to native gallery:', e);
      }
    } else {
      // 2. Browser fallback (download file trigger for desktop preview)
      console.log('[GalleryBridge] Running in browser, photo ready for preview & download.');
    }
  }

  // Retake Photo button
  if (retakePhotoBtn) {
    retakePhotoBtn.addEventListener('click', () => {
      setQuestStage(2);
    });
  }

  // Fullscreen Preview button
  if (fullscreenViewBtn) {
    fullscreenViewBtn.addEventListener('click', () => {
      if (fullscreenPhotoModal) fullscreenPhotoModal.classList.add('active');
    });
  }

  if (closeFullscreenPhotoBtn) {
    closeFullscreenPhotoBtn.addEventListener('click', () => {
      if (fullscreenPhotoModal) fullscreenPhotoModal.classList.remove('active');
    });
  }

  // Proceed to Point 2 button
  if (proceedPoint2Btn) {
    proceedPoint2Btn.addEventListener('click', () => {
      // Award WinCoins for Point 1
      // addCoins(5, 'Квест: Точка 1 (Співставлення фото)'); // Awarded upon final quest completion

      // Transition to Stage 4 (Point 2 Navigation View)
      setQuestStage(4);
    });
  }

  // Return to quests list
  if (returnFromQuestBtn) {
    returnFromQuestBtn.addEventListener('click', () => {
      switchScreen('quests-screen');
    });
  }

  // Initialize Point 1 Map
  function initQuestMap() {
    if (leafletMap !== null) {
      leafletMap.invalidateSize();
      return;
    }

    let userLat = (lastLat !== null) ? lastLat : 50.4522;
    let userLng = (lastLng !== null) ? lastLng : 30.5165;

    setupMap();
    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          lastLat = userLat;
          lastLng = userLng;
          if (userMarker) userMarker.setLatLng([userLat, userLng]);
          if (routingControl) routingControl.setWaypoints([L.latLng(userLat, userLng), L.latLng(destLat, destLng)]);
        },
        (error) => {
          console.log('Geolocation access denied/failed. Using mock coordinates.', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    function setupMap() {
      const style = document.createElement('style');
      style.innerHTML = '.leaflet-routing-container { display: none !important; }';
      document.head.appendChild(style);

      const centerLat = (userLat + destLat) / 2;
      const centerLng = (userLng + destLng) / 2;

      leafletMap = L.map('quest-map').setView([centerLat, centerLng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(leafletMap);

      const targetMarker = L.marker([destLat, destLng]).addTo(leafletMap);
      targetMarker.bindPopup("<b>Велика Житомирська, 8/14</b><br>Точка 1: Будинок С. М. Виноградського").openPopup();

      userMarker = L.marker([userLat, userLng], { icon: blueDotIcon }).addTo(leafletMap);
      userMarker.bindPopup("<b>Ваше поточне положення</b>").openPopup();

      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(userLat, userLng),
          L.latLng(destLat, destLng)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false,
        createMarker: function() { return null; },
        lineOptions: {
          styles: [{ color: '#1e3d2f', opacity: 0.8, weight: 6 }]
        }
      }).addTo(leafletMap);

      const bounds = L.latLngBounds([userLat, userLng], [destLat, destLng]);
      leafletMap.fitBounds(bounds, { padding: [40, 40] });
      leafletMap.invalidateSize();

      if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            let bearing = 0;
            if (isNavigating) {
              if (position.coords.heading !== null && position.coords.heading !== undefined) {
                bearing = position.coords.heading;
              } else if (lastLat && lastLng) {
                bearing = calculateBearing(lastLat, lastLng, lat, lng);
              } else {
                bearing = calculateBearing(lat, lng, destLat, destLng);
              }
            }
            
            if (userMarker) {
              userMarker.setLatLng([lat, lng]);
              if (isNavigating) {
                userMarker.setIcon(createArrowIcon(bearing));
              } else {
                userMarker.setIcon(blueDotIcon);
              }
            }
            
            if (routingControl) {
              routingControl.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat, destLng)
              ]);
            }

            if (isNavigating && leafletMap) {
              leafletMap.setView([lat, lng], 18);
            }
            
            lastLat = lat;
            lastLng = lng;
          },
          (err) => {
            console.log("WatchPosition error:", err);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
          }
        );
      }
    }
  }

  // Initialize Point 2 Map
  function initQuestMap2() {
    if (leafletMap2 !== null) {
      leafletMap2.invalidateSize();
      return;
    }

    let userLat = (lastLat !== null) ? lastLat : 50.455543;
    let userLng = (lastLng !== null) ? lastLng : 30.516990;

    setupMap2();
    setTimeout(() => { if (leafletMap2) leafletMap2.invalidateSize(); }, 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          lastLat = userLat;
          lastLng = userLng;
          if (userMarker2) userMarker2.setLatLng([userLat, userLng]);
          if (routingControl2) routingControl2.setWaypoints([L.latLng(userLat, userLng), L.latLng(destLat2, destLng2)]);
        },
        (error) => {
          console.log('Geolocation access denied/failed for Point 2. Using previous/default coordinates.', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    function setupMap2() {
      const centerLat = (userLat + destLat2) / 2;
      const centerLng = (userLng + destLng2) / 2;

      leafletMap2 = L.map('quest-map-2').setView([centerLat, centerLng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(leafletMap2);

      const targetMarker2 = L.marker([destLat2, destLng2]).addTo(leafletMap2);
      targetMarker2.bindPopup("<b>Володимирська 24</b><br>Точка 2: Дзвінниця Софійського собору").openPopup();

      userMarker2 = L.marker([userLat, userLng], { icon: blueDotIcon }).addTo(leafletMap2);
      userMarker2.bindPopup("<b>Ваше поточне положення</b>").openPopup();

      routingControl2 = L.Routing.control({
        waypoints: [
          L.latLng(userLat, userLng),
          L.latLng(destLat2, destLng2)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false,
        createMarker: function() { return null; },
        lineOptions: {
          styles: [{ color: '#1e3d2f', opacity: 0.8, weight: 6 }]
        }
      }).addTo(leafletMap2);

      const bounds = L.latLngBounds([userLat, userLng], [destLat2, destLng2]);
      leafletMap2.fitBounds(bounds, { padding: [40, 40] });
      leafletMap2.invalidateSize();

      if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            let bearing = 0;
            if (isNavigating2) {
              if (position.coords.heading !== null && position.coords.heading !== undefined) {
                bearing = position.coords.heading;
              } else if (lastLat2 && lastLng2) {
                bearing = calculateBearing(lastLat2, lastLng2, lat, lng);
              } else {
                bearing = calculateBearing(lat, lng, destLat2, destLng2);
              }
            }
            
            if (userMarker2) {
              userMarker2.setLatLng([lat, lng]);
              if (isNavigating2) {
                userMarker2.setIcon(createArrowIcon(bearing));
              } else {
                userMarker2.setIcon(blueDotIcon);
              }
            }
            
            if (routingControl2) {
              routingControl2.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat2, destLng2)
              ]);
            }

            if (isNavigating2 && leafletMap2) {
              leafletMap2.setView([lat, lng], 18);
            }
            
            lastLat2 = lat;
            lastLng2 = lng;
          },
          (err) => {
            console.log("WatchPosition Point 2 error:", err);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
          }
        );
      }
    }
  }


  // Initialize Point 3 Map
  function initQuestMap3() {
    if (leafletMap3 !== null) {
      leafletMap3.invalidateSize();
      return;
    }

    let userLat = (lastLat !== null) ? lastLat : 50.452874;
    let userLng = (lastLng !== null) ? lastLng : 30.514450;

    setupMap3();
    setTimeout(() => { if (leafletMap3) leafletMap3.invalidateSize(); }, 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          lastLat = userLat;
          lastLng = userLng;
          if (userMarker3) userMarker3.setLatLng([userLat, userLng]);
          if (routingControl3) routingControl3.setWaypoints([L.latLng(userLat, userLng), L.latLng(destLat3, destLng3)]);
        },
        (error) => {
          console.log('Geolocation access denied/failed for Point 3. Using previous coordinates.', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    function setupMap3() {
      const centerLat = (userLat + destLat3) / 2;
      const centerLng = (userLng + destLng3) / 2;

      leafletMap3 = L.map('quest-map-3').setView([centerLat, centerLng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(leafletMap3);

      const targetMarker3 = L.marker([destLat3, destLng3]).addTo(leafletMap3);
      targetMarker3.bindPopup('<b>Володимирська гірка</b><br>Точка 3: Верхня альтанка').openPopup();

      userMarker3 = L.marker([userLat, userLng], { icon: blueDotIcon }).addTo(leafletMap3);
      userMarker3.bindPopup('<b>Ваше поточне положення</b>').openPopup();

      routingControl3 = L.Routing.control({
        waypoints: [
          L.latLng(userLat, userLng),
          L.latLng(destLat3, destLng3)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false,
        createMarker: function() { return null; },
        lineOptions: {
          styles: [{ color: '#1e3d2f', opacity: 0.8, weight: 6 }]
        }
      }).addTo(leafletMap3);

      const bounds = L.latLngBounds([userLat, userLng], [destLat3, destLng3]);
      leafletMap3.fitBounds(bounds, { padding: [40, 40] });
      leafletMap3.invalidateSize();

      if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            let bearing = 0;
            if (isNavigating3) {
              if (position.coords.heading !== null && position.coords.heading !== undefined) {
                bearing = position.coords.heading;
              } else if (lastLat3 && lastLng3) {
                bearing = calculateBearing(lastLat3, lastLng3, lat, lng);
              } else {
                bearing = calculateBearing(lat, lng, destLat3, destLng3);
              }
            }
            
            if (userMarker3) {
              userMarker3.setLatLng([lat, lng]);
              if (isNavigating3) {
                userMarker3.setIcon(createArrowIcon(bearing));
              } else {
                userMarker3.setIcon(blueDotIcon);
              }
            }
            
            if (routingControl3) {
              routingControl3.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat3, destLng3)
              ]);
            }

            if (isNavigating3 && leafletMap3) {
              leafletMap3.setView([lat, lng], 18);
            }
            
            lastLat3 = lat;
            lastLng3 = lng;
          },
          (err) => {
            console.log('WatchPosition Point 3 error:', err);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
          }
        );
      }
    }
  }


  // Initialize Point 4 Map
  function initQuestMap4() {
    if (leafletMap4 !== null) {
      leafletMap4.invalidateSize();
      return;
    }

    let userLat = (lastLat !== null) ? lastLat : 50.456370;
    let userLng = (lastLng !== null) ? lastLng : 30.526033;

    setupMap4();
    setTimeout(() => { if (leafletMap4) leafletMap4.invalidateSize(); }, 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          lastLat = userLat;
          lastLng = userLng;
          if (userMarker4) userMarker4.setLatLng([userLat, userLng]);
          if (routingControl4) routingControl4.setWaypoints([L.latLng(userLat, userLng), L.latLng(destLat4, destLng4)]);
        },
        (error) => {
          console.log('Geolocation access denied/failed for Point 4. Using previous coordinates.', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    function setupMap4() {
      const centerLat = (userLat + destLat4) / 2;
      const centerLng = (userLng + destLng4) / 2;

      leafletMap4 = L.map('quest-map-4').setView([centerLat, centerLng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(leafletMap4);

      const targetMarker4 = L.marker([destLat4, destLng4]).addTo(leafletMap4);
      targetMarker4.bindPopup('<b>Володимирська гірка</b><br>Точка 4: Пам\'ятник князю Володимиру').openPopup();

      userMarker4 = L.marker([userLat, userLng], { icon: blueDotIcon }).addTo(leafletMap4);
      userMarker4.bindPopup('<b>Ваше поточне положення</b>').openPopup();

      routingControl4 = L.Routing.control({
        waypoints: [
          L.latLng(userLat, userLng),
          L.latLng(destLat4, destLng4)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false,
        createMarker: function() { return null; },
        lineOptions: {
          styles: [{ color: '#1e3d2f', opacity: 0.8, weight: 6 }]
        }
      }).addTo(leafletMap4);

      const bounds = L.latLngBounds([userLat, userLng], [destLat4, destLng4]);
      leafletMap4.fitBounds(bounds, { padding: [40, 40] });
      leafletMap4.invalidateSize();

      if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            let bearing = 0;
            if (isNavigating4) {
              if (position.coords.heading !== null && position.coords.heading !== undefined) {
                bearing = position.coords.heading;
              } else if (lastLat4 && lastLng4) {
                bearing = calculateBearing(lastLat4, lastLng4, lat, lng);
              } else {
                bearing = calculateBearing(lat, lng, destLat4, destLng4);
              }
            }
            
            if (userMarker4) {
              userMarker4.setLatLng([lat, lng]);
              if (isNavigating4) {
                userMarker4.setIcon(createArrowIcon(bearing));
              } else {
                userMarker4.setIcon(blueDotIcon);
              }
            }
            
            if (routingControl4) {
              routingControl4.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(destLat4, destLng4)
              ]);
            }

            if (isNavigating4 && leafletMap4) {
              leafletMap4.setView([lat, lng], 18);
            }
            
            lastLat4 = lat;
            lastLng4 = lng;
          },
          (err) => {
            console.log('WatchPosition Point 4 error:', err);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
          }
        );
      }
    }
  }

  // Load saved quest progress on boot
  loadQuestProgress();

  // Initialize Auth Check
  checkAuthStatus();

  function checkAuthStatus() {
    if (!navigator.onLine) {
      updateNetworkStatus(false);
      restoreCachedProfileOrFallback();
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      if (localStorage.getItem('cached_profile_name')) {
        restoreCachedProfileOrFallback();
      } else {
        showAuthScreen();
      }
    } else {
      loadProfileFromServer();
    }
  }

});
