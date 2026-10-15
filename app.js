(() => {
  'use strict';

  const tasks = {
    translation: { title: 'Tarjima va matn tahriri', category: 'Matn va tarjima', description: 'O‘zbek, ingliz yoki rus tilidagi tarjima va proofreading buyurtmalarini qidiring.', keywords: 'Uzbek English Russian translation proofreading' },
    design: { title: 'Grafik va UI/UX dizayn', category: 'Dizayn', description: 'Logo, banner, Figma va interfeys dizayni bo‘yicha loyiha qidiruvini boshlang.', keywords: 'Figma UI UX graphic design logo' },
    development: { title: 'Sayt va dasturlash', category: 'Dasturlash', description: 'Frontend, backend, WordPress yoki avtomatlashtirish loyihalarini qidiring.', keywords: 'web development JavaScript Python WordPress' },
    assistant: { title: 'Virtual yordamchi va data entry', category: 'Yordamchi ishlar', description: 'Ma’lumot kiritish, internet tadqiqoti va virtual yordamchi buyurtmalarini izlang.', keywords: 'virtual assistant data entry research Excel' },
    writing: { title: 'Kontent va copywriting', category: 'Kontent', description: 'Blog, mahsulot tavsifi va ijtimoiy tarmoq matnlari bo‘yicha buyurtmalarni qidiring.', keywords: 'copywriting blog writing content' },
    video: { title: 'Video montaj va motion design', category: 'Video', description: 'Qisqa video, reels va animatsiya bo‘yicha loyihalarni qidiring.', keywords: 'video editing motion graphics reels' }
  };

  const taskCards = [...document.querySelectorAll('.task-card')];
  const filterButtons = [...document.querySelectorAll('.filter-chip[data-filter]')];
  const marketFilterButtons = [...document.querySelectorAll('[data-market-filter]')];
  const searchInput = document.getElementById('taskSearch');
  const taskCount = document.getElementById('taskCount');
  const emptyState = document.getElementById('emptyState');
  const taskGrid = document.getElementById('taskGrid');
  const liveJobGrid = document.getElementById('liveJobGrid');
  const liveEmptyState = document.getElementById('liveEmptyState');
  const liveJobCount = document.getElementById('liveJobCount');
  const feedStatus = document.getElementById('feedStatus');
  const feedSourceStatus = document.getElementById('feedSourceStatus');
  const refreshJobsButton = document.getElementById('refreshJobs');
  const skillControls = [...document.querySelectorAll('[data-skill]')];
  const skillPreferenceStatus = document.getElementById('skillPreferenceStatus');
  const skillStorageKey = 'vazify.skillPreferences';
  const favoritesStorageKey = 'vazify.savedListings';
  const marketFilterStorageKey = 'vazify.marketFilter';
  const notificationsStorageKey = 'vazify.notificationsEnabled';
  const seenListingsStorageKey = 'vazify.seenListings';
  const replyTemplateStorageKey = 'vazify.replyTemplate';
  const accountOwnerStorageKey = 'vazify.syncOwner';
  const notificationStatus = document.getElementById('notificationStatus');
  const notificationButton = document.getElementById('enableNotifications');
  const replyTemplate = document.getElementById('replyTemplate');
  const replyTemplateStatus = document.getElementById('replyTemplateStatus');
  const accountForm = document.getElementById('accountForm');
  const accountEmail = document.getElementById('accountEmail');
  const accountPassword = document.getElementById('accountPassword');
  const accountStatus = document.getElementById('accountStatus');
  const signInButton = document.getElementById('signIn');
  const signUpButton = document.getElementById('signUp');
  const googleSignInButton = document.getElementById('googleSignIn');
  const signOutButton = document.getElementById('signOut');
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const themeLabel = themeToggle.querySelector('.theme-label');
  const themeStorageKey = 'vazify.theme';
  const defaultReplyTemplate = replyTemplate.value;
  const defaultSkills = ['design', 'video', 'content', 'development', 'admin', 'sales', 'other'];
  const toast = document.getElementById('toast');
  let liveJobs = [];
  let savedListings = new Map();
  let selectedSkills = new Set(defaultSkills);
  let notificationsEnabled = false;
  let knownListingIds = null;
  let supabaseClient = null;
  let accountUser = null;
  let cloudSaveTimer = 0;
  let lastHandledUserId = '';
  let activeFilter = 'all';
  let activeMarketFilter = 'uzbekistan';
  let toastTimer;
  let lastFocusedElement = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = isDark ? '#111827' : '#12213E';
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Yorug‘ ko‘rinishni yoqish' : 'Tungi ko‘rinishni yoqish');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    themeLabel.textContent = isDark ? 'Yorug‘ rejim' : 'Tungi rejim';
  }

  function initializeTheme() {
    let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    try {
      const savedTheme = window.localStorage.getItem(themeStorageKey);
      if (savedTheme === 'dark' || savedTheme === 'light') theme = savedTheme;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      showToast(`Mavzu sozlamasini o‘qib bo‘lmadi: ${detail}`);
    }
    applyTheme(theme);
  }

  themeToggle.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      showToast(`Mavzu o‘zgardi, lekin saqlanmadi: ${detail}`);
    }
  });
  initializeTheme();

  function updateAccountControls() {
    const signedIn = Boolean(accountUser);
    accountForm.hidden = !supabaseClient || signedIn;
    googleSignInButton.hidden = !supabaseClient || signedIn;
    signOutButton.hidden = !signedIn;
  }

  function localPreferences() {
    return {
      user_id: accountUser.id,
      saved_listings: [...savedListings.values()].slice(-100),
      skill_preferences: [...selectedSkills],
      reply_template: replyTemplate.value.slice(0, 3000),
      updated_at: new Date().toISOString(),
    };
  }

  async function saveCloudPreferences() {
    if (!supabaseClient || !accountUser) return;
    const { error } = await supabaseClient
      .from('user_preferences')
      .upsert(localPreferences(), { onConflict: 'user_id' });
    if (error) throw error;
  }

  function scheduleCloudSave() {
    if (!supabaseClient || !accountUser) return;
    const userId = accountUser.id;
    window.clearTimeout(cloudSaveTimer);
    accountStatus.textContent = 'O‘zgarishlar akkauntingizga sinxronlanmoqda…';
    cloudSaveTimer = window.setTimeout(async () => {
      if (!accountUser || accountUser.id !== userId) return;
      try {
        await saveCloudPreferences();
        if (accountUser?.id === userId) {
          accountStatus.textContent = `Sinxronlandi: ${accountUser.email || 'akkaunt'}.`;
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Ma’lumotlar bazasi bilan aloqa xatosi.';
        if (accountUser?.id === userId) {
          accountStatus.textContent = `Bulutga saqlab bo‘lmadi: ${detail}. Shu qurilmadagi nusxa saqlanadi.`;
        }
      }
    }, 500);
  }

  function applyCloudPreferences(data) {
    if (!data || typeof data !== 'object') return false;
    if (Array.isArray(data.skill_preferences)
      && data.skill_preferences.every(skill => typeof skill === 'string' && defaultSkills.includes(skill))) {
      selectedSkills = new Set(data.skill_preferences);
      skillControls.forEach(control => {
        control.checked = selectedSkills.has(control.dataset.skill);
      });
      updateSkillLabelStates();
      window.localStorage.setItem(skillStorageKey, JSON.stringify([...selectedSkills]));
    }
    if (Array.isArray(data.saved_listings)) {
      const merged = new Map(savedListings);
      data.saved_listings.forEach(job => {
        if (job && typeof job.url === 'string' && safeJobUrl(job.url)
          && typeof job.title === 'string' && typeof job.description === 'string') {
          merged.set(job.url, job);
        }
      });
      savedListings = new Map([...merged.entries()].slice(-100));
      window.localStorage.setItem(favoritesStorageKey, JSON.stringify([...savedListings.values()]));
    }
    if (typeof data.reply_template === 'string' && data.reply_template.length <= 3000) {
      replyTemplate.value = data.reply_template;
      window.localStorage.setItem(replyTemplateStorageKey, replyTemplate.value);
    }
    return true;
  }

  async function handleAccountUser(user) {
    accountUser = user || null;
    updateAccountControls();
    if (!accountUser) {
      lastHandledUserId = '';
      accountStatus.textContent = supabaseClient
        ? 'Kirish orqali saqlangan e’lonlaringizni boshqa qurilmada ham ko‘ring.'
        : 'Akkaunt sozlanmagan; ma’lumotlar shu brauzerda saqlanadi.';
      return;
    }
    if (lastHandledUserId === accountUser.id) return;
    const userId = accountUser.id;
    lastHandledUserId = userId;
    accountStatus.textContent = 'Akkaunt ma’lumotlari yuklanmoqda…';
    try {
      const storedOwner = window.localStorage.getItem(accountOwnerStorageKey);
      if (storedOwner && storedOwner !== userId) {
        savedListings.clear();
        selectedSkills = new Set(defaultSkills);
        skillControls.forEach(control => { control.checked = true; });
        updateSkillLabelStates();
        replyTemplate.value = defaultReplyTemplate;
        window.localStorage.setItem(favoritesStorageKey, '[]');
        window.localStorage.setItem(skillStorageKey, JSON.stringify(defaultSkills));
        window.localStorage.setItem(replyTemplateStorageKey, defaultReplyTemplate);
      }
      const { data, error } = await supabaseClient
        .from('user_preferences')
        .select('saved_listings, skill_preferences, reply_template')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (accountUser?.id !== userId) return;
      if (data) {
        applyCloudPreferences(data);
        await saveCloudPreferences();
      } else {
        await saveCloudPreferences();
      }
      if (accountUser?.id !== userId) return;
      lastHandledUserId = userId;
      window.localStorage.setItem(accountOwnerStorageKey, userId);
      renderLiveJobs();
      accountStatus.textContent = `Kirdingiz: ${accountUser.email || 'akkaunt'}. E’lonlar va sozlamalar sinxronlanadi.`;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Akkaunt ma’lumotlarini yuklashda xato.';
      accountStatus.textContent = `Akkaunt bor, ammo sinxronlash muvaffaqiyatsiz: ${detail}. SQL sxemasi va RLS sozlamasini tekshiring.`;
    }
  }

  async function initializeAccount() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Server ${response.status} holatini qaytardi.`);
      const config = await response.json();
      if (config.error) {
        accountStatus.textContent = `Supabase konfiguratsiyasi yaroqsiz: ${config.error} Lokal saqlash davom etadi.`;
        updateAccountControls();
        return;
      }
      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        accountStatus.textContent = 'Supabase sozlanmagan. Hozircha e’lonlar shu brauzerda saqlanadi.';
        updateAccountControls();
        return;
      }
      await loadSupabaseLibrary();
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('Supabase JavaScript kutubxonasi yuklanmadi.');
      }
      supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      updateAccountControls();
      await handleAccountUser(data.session?.user || null);
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => {
          void handleAccountUser(session?.user || null);
        }, 0);
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Supabase bilan ulanishda xato.';
      accountStatus.textContent = `Akkauntni ishga tushirib bo‘lmadi: ${detail}. Lokal saqlash davom etadi.`;
      updateAccountControls();
    }
  }

  function loadSupabaseLibrary() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          resolve();
        } else {
          reject(new Error('Supabase JavaScript kutubxonasi yuklandi, lekin client topilmadi.'));
        }
      };
      script.onerror = () => reject(new Error('Supabase JavaScript kutubxonasini yuklab bo‘lmadi.'));
      document.head.append(script);
    });
  }

  async function submitAccount(mode) {
    if (!supabaseClient) return;
    const email = accountEmail.value.trim();
    const password = accountPassword.value;
    signInButton.disabled = true;
    signUpButton.disabled = true;
    accountStatus.textContent = mode === 'signup' ? 'Akkaunt yaratilmoqda…' : 'Kirilmoqda…';
    try {
      const result = mode === 'signup'
        ? await supabaseClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        : await supabaseClient.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      accountPassword.value = '';
      if (mode === 'signup' && !result.data.session) {
        accountStatus.textContent = 'Tasdiqlash havolasi emailingizga yuborildi. Tasdiqlagach shu yerda kiring.';
      } else {
        await handleAccountUser(result.data.user || result.data.session?.user || null);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Akkaunt so‘rovida xato.';
      accountStatus.textContent = `Akkaunt amali bajarilmadi: ${detail}`;
    } finally {
      signInButton.disabled = false;
      signUpButton.disabled = false;
    }
  }

  accountForm.addEventListener('submit', event => {
    event.preventDefault();
    void submitAccount('signin');
  });
  signUpButton.addEventListener('click', () => {
    if (accountForm.reportValidity()) void submitAccount('signup');
  });
  googleSignInButton.addEventListener('click', async () => {
    if (!supabaseClient) return;
    googleSignInButton.disabled = true;
    accountStatus.textContent = 'Google orqali kirish sahifasiga yo‘naltirilmoqda…';
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Google orqali kirishda xato.';
      accountStatus.textContent = `Google orqali kirib bo‘lmadi: ${detail}`;
      googleSignInButton.disabled = false;
    }
  });
  signOutButton.addEventListener('click', async () => {
    if (!supabaseClient) return;
    signOutButton.disabled = true;
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      accountUser = null;
      await handleAccountUser(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Akkauntdan chiqishda xato.';
      accountStatus.textContent = `Chiqib bo‘lmadi: ${detail}`;
    } finally {
      signOutButton.disabled = false;
    }
  });

  function readSkillPreferences() {
    try {
      const saved = window.localStorage.getItem(skillStorageKey);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        const allowedSkills = new Set(defaultSkills);
        if (!Array.isArray(parsed) || parsed.some(skill => typeof skill !== 'string' || !allowedSkills.has(skill))) {
          throw new Error('Saqlangan ko‘nikma sozlamasi noto‘g‘ri formatda.');
        }
        selectedSkills = new Set(parsed);
        skillControls.forEach(control => {
          control.checked = selectedSkills.has(control.dataset.skill);
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      skillPreferenceStatus.textContent = `Saqlangan ko‘nikma tanlovini o‘qib bo‘lmadi: ${detail}`;
    }
    updateSkillLabelStates();
  }

  function readSavedListings() {
    try {
      const saved = window.localStorage.getItem(favoritesStorageKey);
      if (saved === null) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error('Saqlangan e’lonlar ro‘yxati noto‘g‘ri formatda.');
      parsed.forEach(job => {
        if (job && typeof job.url === 'string' && safeJobUrl(job.url)
          && typeof job.title === 'string' && typeof job.description === 'string') {
          savedListings.set(job.url, job);
        }
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      showToast(`Saqlangan e’lonlarni o‘qib bo‘lmadi: ${detail}`);
    }
  }

  function readMarketFilter() {
    try {
      const saved = window.localStorage.getItem(marketFilterStorageKey);
      if (saved === 'uzbekistan' || saved === 'global') activeMarketFilter = saved;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      showToast(`Hudud filtri sozlamasini o‘qib bo‘lmadi: ${detail}`);
    }
    marketFilterButtons.forEach(button => {
      const selected = button.dataset.marketFilter === activeMarketFilter;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function readNotificationSettings() {
    try {
      notificationsEnabled = window.localStorage.getItem(notificationsStorageKey) === 'true'
        && 'Notification' in window
        && Notification.permission === 'granted';
      const storedSeen = window.localStorage.getItem(seenListingsStorageKey);
      if (storedSeen !== null) {
        const parsed = JSON.parse(storedSeen);
        if (!Array.isArray(parsed) || parsed.some(id => typeof id !== 'string')) {
          throw new Error('E’lonlar tarixi noto‘g‘ri formatda.');
        }
        knownListingIds = new Set(parsed);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      notificationStatus.textContent = `Bildirishnoma sozlamasini o‘qib bo‘lmadi: ${detail}`;
    }
    updateNotificationControls();
  }

  function updateNotificationControls() {
    const supported = 'Notification' in window;
    notificationButton.setAttribute('aria-pressed', String(notificationsEnabled));
    notificationButton.disabled = !supported;
    notificationButton.textContent = notificationsEnabled
      ? 'Bildirishnomani o‘chirish'
      : 'Bildirishnomani yoqish';
    if (notificationsEnabled) {
      notificationStatus.textContent = 'Yoqilgan. Yangi mos e’lonlar sahifa ochiq paytda bildiriladi.';
    } else if (!('Notification' in window)) {
      notificationStatus.textContent = 'Bu brauzer bildirishnomalarni qo‘llamaydi. Yangi e’lonlar sahifa ochiq bo‘lganda tekshiriladi.';
    } else if (Notification.permission === 'denied') {
      notificationStatus.textContent = 'Brauzer ruxsat bermadi. Ruxsatni brauzer sozlamalaridan o‘zgartiring.';
    } else {
      notificationStatus.textContent = 'Bildirishnoma o‘chiq. E’lonlar faqat sahifa ochiq paytda tekshiriladi.';
    }
  }

  function listingId(job) {
    return typeof job.url === 'string' ? job.url : job.id;
  }

  function detectNewListings(jobs) {
    const currentIds = jobs.map(listingId).filter(id => typeof id === 'string' && id);
    if (knownListingIds === null) {
      knownListingIds = new Set(currentIds);
    } else {
      const newMatches = jobs.filter(job =>
        !knownListingIds.has(listingId(job))
        && job.listingType !== 'unrelated'
        && matchesSelectedSkills(job)
      );
      if (newMatches.length && notificationsEnabled && Notification.permission === 'granted') {
        const firstTitle = newMatches[0].title || 'Yangi e’lon';
        try {
          new Notification('Vazify: yangi mos e’lon', {
            body: newMatches.length === 1
              ? firstTitle
              : `${newMatches.length} ta yangi mos e’lon. Birinchisi: ${firstTitle}`,
            tag: 'vazify-new-listings',
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Brauzer bildirishnomani ko‘rsata olmadi.';
          notificationStatus.textContent = `Yangi e’lon bor, lekin bildirishnoma ko‘rsatilmagan: ${detail}`;
        }
      }
      currentIds.forEach(id => knownListingIds.add(id));
    }
    try {
      window.localStorage.setItem(seenListingsStorageKey, JSON.stringify([...knownListingIds].slice(-500)));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      notificationStatus.textContent = `E’lonlar tarixini saqlab bo‘lmadi: ${detail}`;
    }
  }

  async function toggleNotifications() {
    if (notificationsEnabled) {
      notificationsEnabled = false;
      try {
        window.localStorage.setItem(notificationsStorageKey, 'false');
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
        updateNotificationControls();
        notificationStatus.textContent = `Bildirishnoma o‘chirildi, lekin sozlama saqlanmadi: ${detail}`;
        return;
      }
      updateNotificationControls();
      return;
    }
    if (!('Notification' in window)) {
      updateNotificationControls();
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        updateNotificationControls();
        return;
      }
      notificationsEnabled = true;
      try {
        window.localStorage.setItem(notificationsStorageKey, 'true');
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
        updateNotificationControls();
        notificationStatus.textContent = `Yoqildi, ammo keyingi safar uchun saqlanmadi: ${detail}`;
        return;
      }
      updateNotificationControls();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer ruxsat so‘rovi xatosi.';
      notificationStatus.textContent = `Bildirishnomani yoqib bo‘lmadi: ${detail}`;
    }
  }

  function saveReplyTemplate() {
    try {
      window.localStorage.setItem(replyTemplateStorageKey, replyTemplate.value);
      replyTemplateStatus.textContent = 'Javob matni shu brauzerda saqlandi.';
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      replyTemplateStatus.textContent = `Matn ishlaydi, ammo saqlanmadi: ${detail}`;
    }
    scheduleCloudSave();
  }

  function loadReplyTemplate() {
    try {
      const saved = window.localStorage.getItem(replyTemplateStorageKey);
      if (saved !== null) replyTemplate.value = saved;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      replyTemplateStatus.textContent = `Saqlangan matnni o‘qib bo‘lmadi: ${detail}`;
    }
  }

  function toggleSavedListing(job) {
    if (savedListings.has(job.url)) {
      savedListings.delete(job.url);
    } else {
      savedListings.set(job.url, job);
    }
    try {
      window.localStorage.setItem(favoritesStorageKey, JSON.stringify([...savedListings.values()].slice(-100)));
      savedListings = new Map([...savedListings.entries()].slice(-100));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      showToast(`E’lonni saqlab bo‘lmadi: ${detail}`);
    }
    scheduleCloudSave();
    renderLiveJobs();
  }

  function createReplyText(title) {
    return replyTemplate.value.replaceAll('{title}', title);
  }

  function updateSkillLabelStates() {
    skillControls.forEach(control => {
      control.closest('label').classList.toggle('is-selected', control.checked);
    });
  }

  function saveSkillPreferences() {
    selectedSkills = new Set(
      skillControls.filter(control => control.checked).map(control => control.dataset.skill)
    );
    updateSkillLabelStates();
    try {
      window.localStorage.setItem(skillStorageKey, JSON.stringify([...selectedSkills]));
      skillPreferenceStatus.textContent = selectedSkills.size
        ? 'Ko‘nikma tanlovingiz shu brauzerda saqlandi.'
        : 'Ko‘nikma tanlanmadi: barcha mos ish turlari ko‘rsatiladi.';
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      skillPreferenceStatus.textContent = `Tanlov shu sahifada ishlaydi, ammo saqlanmadi: ${detail}`;
    }
    scheduleCloudSave();
    renderLiveJobs();
  }

  readSkillPreferences();
  readSavedListings();
  readMarketFilter();
  readNotificationSettings();
  loadReplyTemplate();
  notificationButton.addEventListener('click', toggleNotifications);
  replyTemplate.addEventListener('input', saveReplyTemplate);
  skillControls.forEach(control => control.addEventListener('change', saveSkillPreferences));
  document.getElementById('resetSkills').addEventListener('click', () => {
    skillControls.forEach(control => { control.checked = true; });
    saveSkillPreferences();
  });

  function openMarketplace(source, query) {
    const normalizedQuery = query.trim() || 'freelance project';
    const url = source === 'fiverr'
      ? `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(normalizedQuery)}`
      : `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(normalizedQuery)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function safeJobUrl(value) {
    try {
      const url = new URL(value);
      const allowedHosts = new Set([
        't.me',
        'arbeitnow.com',
        'www.arbeitnow.com',
        'jobicy.com',
        'www.jobicy.com',
        'remoteok.com',
        'www.remoteok.com',
      ]);
      return url.protocol === 'https:' && allowedHosts.has(url.hostname) ? url.href : null;
    } catch {
      return null;
    }
  }

  function matchesSelectedSkills(job) {
    return selectedSkills.size === 0
      || selectedSkills.has(job.category)
      || (job.category === 'other' && selectedSkills.has('other'));
  }

  function renderLiveJobs() {
    liveJobGrid.replaceChildren();
    const jobs = [...(activeFilter === 'favorites' ? savedListings.values() : liveJobs)].sort((left, right) => {
      const matchDifference = Number(matchesSelectedSkills(right)) - Number(matchesSelectedSkills(left));
      if (matchDifference !== 0) return matchDifference;
      return Date.parse(right.publishedAt || '') - Date.parse(left.publishedAt || '');
    });
    jobs.forEach(job => {
      const href = safeJobUrl(job.url);
      if (!href || typeof job.title !== 'string' || typeof job.description !== 'string') return;

      const card = document.createElement('article');
      card.className = 'task-card live-job-card';
      card.dataset.jobUrl = job.url;
      card.dataset.search = `${job.title} ${job.description} ${job.source || ''} ${job.company || ''} ${job.location || ''} ${job.details || ''}`.toLocaleLowerCase('uz-UZ');
      card.dataset.listingType = job.listingType || 'unrelated';
      card.dataset.market = job.market || 'global';
      card.dataset.skillCategory = job.category || 'other';

      const top = document.createElement('div');
      top.className = 'task-card-top';
      const source = document.createElement('span');
      source.className = `category-tag listing-type-tag listing-${job.listingType || 'unrelated'}`;
      source.textContent = `${job.listingLabel || 'Ishga aloqasiz'} · ${job.source || 'Ochiq manba'}`;
      const skillTag = document.createElement('span');
      const isSkillMatch = matchesSelectedSkills(job);
      skillTag.className = `category-tag skill-match-tag${isSkillMatch ? ' is-match' : ''}`;
      skillTag.textContent = isSkillMatch
        ? `Siz tanlagan: ${job.skillLabel || 'Boshqa'}`
        : `Boshqa ko‘nikma: ${job.skillLabel || 'Aniqlanmagan'}`;
      top.append(source, skillTag);

      const title = document.createElement('h3');
      title.textContent = job.title;
      const description = document.createElement('p');
      description.textContent = job.description;

      const meta = document.createElement('div');
      meta.className = 'task-meta live-job-meta';
      const company = document.createElement('span');
      company.textContent = job.company || job.location || 'Manbadagi e’lon';
      const details = document.createElement('span');
      details.textContent = job.details || 'Manba e’loni';
      meta.append(company, details);

      const footer = document.createElement('div');
      footer.className = 'task-card-bottom';
      const attribution = document.createElement('div');
      const attributionLabel = document.createElement('small');
      attributionLabel.textContent = 'Asl e’lon';
      const sourceName = document.createElement('strong');
      sourceName.textContent = job.kind === 'telegram'
        ? 'Telegram kanalida'
        : job.source && job.source.includes('Remote OK') ? 'Remote OK’da'
          : job.source && job.source.includes('Jobicy') ? 'Jobicy’da'
            : job.source && job.source.includes('Arbeitnow') ? 'Arbeitnow’da' : 'Manba saytida';
      attribution.append(attributionLabel, sourceName);

      const link = document.createElement('a');
      link.className = 'btn btn-outline btn-open-task';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Manbada ko‘rish ↗';
      const actions = document.createElement('div');
      actions.className = 'live-job-actions';
      const favorite = document.createElement('button');
      favorite.className = 'btn btn-ghost btn-small favorite-listing';
      favorite.type = 'button';
      favorite.setAttribute('aria-pressed', String(savedListings.has(job.url)));
      favorite.textContent = savedListings.has(job.url) ? 'Saqlangan ♥' : 'Saqlash ♡';
      favorite.addEventListener('click', () => toggleSavedListing(job));
      const reply = document.createElement('button');
      reply.className = 'btn btn-secondary btn-small copy-reply';
      reply.type = 'button';
      reply.textContent = 'Javob matnini nusxalash';
      reply.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(createReplyText(job.title));
          showToast('Javob matni nusxalandi. Manbadagi e’lonni ochib, o‘zingiz yuboring.');
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Clipboard ruxsati berilmadi.';
          showToast(`Matnni nusxalab bo‘lmadi: ${detail}`);
        }
      });
      actions.append(favorite, reply, link);
      footer.append(attribution, actions);
      card.append(top, title, description, meta, footer);
      liveJobGrid.append(card);
    });
    applyFilters();
  }

  function renderSourceStatuses(sources) {
    if (!Array.isArray(sources)) {
      feedSourceStatus.textContent = 'Manba holatlari qaytmadi.';
      return;
    }
    feedSourceStatus.textContent = sources.map(source => {
      const label = `${source.name}: ${source.count} ta`;
      if (source.error) return `${label} — ${source.stale ? 'eski ma’lumot saqlandi; ' : ''}${source.error}`;
      return label;
    }).join(' · ');
  }

  async function loadLiveJobs(force = false) {
    refreshJobsButton.disabled = true;
    feedStatus.textContent = 'Ochiq manbalar tekshirilmoqda…';
    try {
      const response = await fetch(`/api/jobs${force ? '?refresh=1' : ''}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Server ${response.status} holatini qaytardi.`);
      const data = await response.json();
      if (!Array.isArray(data.jobs)) throw new Error('Serverdan e’lonlar ro‘yxati kelmadi.');
      liveJobs = data.jobs;
      detectNewListings(liveJobs);
      renderLiveJobs();
      renderSourceStatuses(data.sources);
      const summary = data.summary || {};
      feedStatus.textContent = data.refreshNote
        || `${summary.freelance || 0} zakaz · ${summary.employment || 0} ish · ${summary.unrelated || 0} aloqasiz alohida · ${summary.duplicates || 0} takror va ${summary.expired || 0} eskirgan yashirildi.`;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Noma’lum ulanish xatosi.';
      feedStatus.textContent = `Jonli e’lonlarni olishda xato: ${detail} Server kerak — README’dagi ishga tushirish yo‘riqnomasiga qarang.`;
      feedSourceStatus.textContent = 'Tashqi manbalar hozircha tekshirilmagan.';
    } finally {
      refreshJobsButton.disabled = false;
    }
  }

  refreshJobsButton.addEventListener('click', () => loadLiveJobs(true));

  document.getElementById('upworkSearch').addEventListener('click', () => {
    openMarketplace('upwork', searchInput.value);
  });
  document.getElementById('fiverrSearch').addEventListener('click', () => {
    openMarketplace('fiverr', searchInput.value);
  });

  function applyFilters() {
    const query = searchInput.value.trim().toLocaleLowerCase('uz-UZ');
    let visibleCount = 0;
    taskCards.forEach(card => {
      const categoryMatches = activeFilter === 'all';
      const textMatches = !query || `${card.dataset.search} ${card.textContent}`.toLocaleLowerCase('uz-UZ').includes(query);
      const visible = categoryMatches && textMatches;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    taskCount.textContent = `${visibleCount} ta`;
    emptyState.hidden = activeFilter !== 'all' || visibleCount > 0;
    taskGrid.hidden = activeFilter !== 'all' || visibleCount === 0;
    let visibleLiveCount = 0;
    liveJobGrid.querySelectorAll('.live-job-card').forEach(card => {
      const categoryMatches = activeFilter === 'all'
        ? card.dataset.listingType !== 'unrelated'
        : activeFilter === 'favorites'
          ? savedListings.has(card.dataset.jobUrl)
          : card.dataset.listingType === activeFilter;
      const skillMatches = activeFilter === 'favorites'
        || selectedSkills.size === 0
        || selectedSkills.has(card.dataset.skillCategory);
      const marketMatches = card.dataset.market === activeMarketFilter;
      const textMatches = !query || card.dataset.search.includes(query);
      card.hidden = !categoryMatches || !skillMatches || !marketMatches || !textMatches;
      if (!card.hidden) visibleLiveCount += 1;
    });
    liveJobCount.textContent = `${visibleLiveCount} ta ko‘rinmoqda`;
    liveEmptyState.textContent = activeFilter === 'favorites'
      ? savedListings.size === 0
        ? 'Hozircha saqlangan e’lon yo‘q.'
        : 'Qidiruvga mos saqlangan e’lon topilmadi.'
      : 'Bu qidiruv yoki tanlangan turga mos e’lon yo‘q.';
    liveEmptyState.hidden = visibleLiveCount > 0;
  }

  filterButtons.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    renderLiveJobs();
  }));
  marketFilterButtons.forEach(button => button.addEventListener('click', () => {
    activeMarketFilter = button.dataset.marketFilter;
    marketFilterButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    try {
      window.localStorage.setItem(marketFilterStorageKey, activeMarketFilter);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      showToast(`Hudud filtri ishlaydi, ammo saqlanmadi: ${detail}`);
    }
    renderLiveJobs();
  }));
  searchInput.addEventListener('input', applyFilters);
  document.getElementById('resetFilters').addEventListener('click', () => {
    activeFilter = 'all';
    searchInput.value = '';
    filterButtons.forEach(item => {
      const selected = item.dataset.filter === 'all';
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    activeMarketFilter = 'uzbekistan';
    marketFilterButtons.forEach(item => {
      const selected = item.dataset.marketFilter === activeMarketFilter;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    try {
      window.localStorage.setItem(marketFilterStorageKey, activeMarketFilter);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Brauzer saqlash xatosi.';
      showToast(`Filtrlar tozalandi, ammo hudud filtri saqlanmadi: ${detail}`);
    }
    renderLiveJobs();
  });

  document.querySelectorAll('.save-task').forEach(button => button.addEventListener('click', () => {
    const saved = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(saved));
    button.textContent = saved ? '♥' : '♡';
    showToast(saved ? 'Yo‘nalish shu sahifada tanlandi (demo).' : 'Yo‘nalish tanlanganlardan olib tashlandi.');
  }));

  function openModal(modal) {
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    const focusable = modal.querySelector('button:not([disabled]), a[href], input:not([disabled])');
    if (focusable) focusable.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    if (![...document.querySelectorAll('.modal-backdrop')].some(item => !item.hidden)) {
      document.body.classList.remove('modal-open');
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
  }

  document.querySelectorAll('[data-modal]').forEach(button => button.addEventListener('click', () => openModal(document.getElementById(button.dataset.modal))));
  document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const open = [...document.querySelectorAll('.modal-backdrop')].find(modal => !modal.hidden);
      if (open) closeModal(open);
    }
  });

  document.querySelectorAll('[data-task-open]').forEach(button => button.addEventListener('click', () => {
    const task = tasks[button.dataset.taskOpen];
    if (!task) return;
    document.getElementById('taskModalTitle').textContent = task.title;
    document.getElementById('taskModalDescription').textContent = task.description;
    document.getElementById('taskModalCategory').textContent = task.category;
    const query = searchInput.value.trim() || task.keywords;
    document.getElementById('taskModalReward').textContent = query;
    document.getElementById('taskModalTime').textContent = 'Manba sahifasida';
    document.getElementById('taskModalLevel').textContent = task.category;
    document.getElementById('startTaskBtn').dataset.query = query;
    document.getElementById('startTaskFiverrBtn').dataset.query = query;
    openModal(document.getElementById('taskModal'));
  }));

  document.getElementById('startTaskBtn').addEventListener('click', () => {
    openMarketplace('upwork', document.getElementById('startTaskBtn').dataset.query || searchInput.value);
    closeModal(document.getElementById('taskModal'));
  });

  document.getElementById('startTaskFiverrBtn').addEventListener('click', () => {
    openMarketplace('fiverr', document.getElementById('startTaskFiverrBtn').dataset.query || searchInput.value);
    closeModal(document.getElementById('taskModal'));
  });

  const menuToggle = document.getElementById('menuToggle');
  const primaryNav = document.getElementById('primaryNav');
  menuToggle.addEventListener('click', () => {
    const open = !primaryNav.classList.contains('open');
    primaryNav.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Menyuni yopish' : 'Menyuni ochish');
  });
  primaryNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    primaryNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Menyuni ochish');
  }));

  document.getElementById('year').textContent = new Date().getFullYear();
  loadLiveJobs();
  void initializeAccount();

  // Smooth motion enhancements: progressive reveal, scroll progress, and subtle hero parallax.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const siteHeader = document.querySelector('.site-header');
  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progressBar);

  let scrollFramePending = false;
  const updateScrollChrome = () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progressBar.style.setProperty('--progress', String(Math.min(1, Math.max(0, window.scrollY / maxScroll))));
    if (siteHeader) siteHeader.classList.toggle('is-scrolled', window.scrollY > 8);
    scrollFramePending = false;
  };
  const scheduleScrollChrome = () => {
    if (scrollFramePending) return;
    scrollFramePending = true;
    window.requestAnimationFrame(updateScrollChrome);
  };
  window.addEventListener('scroll', scheduleScrollChrome, { passive: true });
  window.addEventListener('resize', scheduleScrollChrome, { passive: true });
  updateScrollChrome();

  const revealTargets = document.querySelectorAll(
    '.proof-inner > div, .section-heading, .task-toolbar, .task-card, .step-card, .business-copy, .business-visual, .trust-grid > *, .trust-items article, .final-cta-inner, .footer-top, .footer-bottom'
  );
  revealTargets.forEach((element, index) => {
    element.classList.add('reveal-on-scroll');
    if (element.matches('.task-card, .proof-inner > div, .step-card')) {
      const localIndex = Array.from(element.parentElement.children).indexOf(element);
      element.style.setProperty('--reveal-delay', `${Math.min(localIndex, 3) * 70}ms`);
    } else {
      element.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 35}ms`);
    }
  });

  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    revealTargets.forEach(element => revealObserver.observe(element));
  } else {
    revealTargets.forEach(element => element.classList.add('is-visible'));
  }

  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    heroVisual.addEventListener('pointermove', event => {
      const bounds = heroVisual.getBoundingClientRect();
      const px = (event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5;
      const py = (event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5;
      heroVisual.style.setProperty('--glow-x', `${(px * 15).toFixed(1)}px`);
      heroVisual.style.setProperty('--glow-y', `${(py * 15).toFixed(1)}px`);
    }, { passive: true });
    heroVisual.addEventListener('pointerleave', () => {
      heroVisual.style.setProperty('--glow-x', '0px');
      heroVisual.style.setProperty('--glow-y', '0px');
    }, { passive: true });
  }

  document.body.classList.add('js-enabled');
  window.requestAnimationFrame(() => document.body.classList.add('page-ready'));

})();
