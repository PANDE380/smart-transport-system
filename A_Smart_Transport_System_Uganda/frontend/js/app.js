const API_BASE_URL = '/api';

// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
let currentUser = null;
let balance = 0;
let txns = [];
let selTopup = 0;
let selModeV = 'Standard Taxi';
let selModeM = 1.0;
let drvOnline = true;
let regRole = 'passenger';
let map, drvMap, admMap, routingControl;
let routeDistKm = 0;
let routeTimeMin = 0;
const RATE = 500;
const coords = {};
let currentBookingVehicle = null;
let lastTripId = null;
let ussdSessionStarted = false;
let driverMarkers = [];
let adminMarkers = [];
let liveTrackingInterval = null;
let passengerMarkers = [];
let homeMarkers = [];
let pendingProfilePhotoFile = null;
let pendingProfilePhotoPreviewUrl = null;
const MODE_TO_VEHICLE_TYPE = {
    'Standard Taxi': 'Taxi',
    'Boda Boda': 'Boda Boda',
    'Special Hire': 'Special Hire',
    'Mini Bus': 'Mini Bus',
    'Marine Transport': 'Marine',
    'Smart Bus': 'Bus'
};
const DRIVER_VEHICLE_CONFIG = {
    Taxi: {
        label: 'Standard Taxi',
        capacity: 4,
        platePlaceholder: 'UAA 123A'
    },
    'Boda Boda': {
        label: 'Boda Boda',
        capacity: 1,
        platePlaceholder: 'UFX 123B'
    },
    'Special Hire': {
        label: 'Special Hire',
        capacity: 4,
        platePlaceholder: 'UBA 777H'
    },
    'Mini Bus': {
        label: 'Mini Bus',
        capacity: 14,
        platePlaceholder: 'UBQ 234M'
    },
    Bus: {
        label: 'Smart Bus',
        capacity: 60,
        platePlaceholder: 'UBB 456B'
    },
    Marine: {
        label: 'Marine Transport',
        capacity: 100,
        platePlaceholder: 'MVA 789C'
    }
};
const PASSWORD_STRENGTH_META = {
    very_weak: {
        label: 'Very weak',
        width: '25%',
        color: '#ef4444'
    },
    weak: {
        label: 'Weak',
        width: '50%',
        color: '#f97316'
    },
    medium: {
        label: 'Medium',
        width: '75%',
        color: '#facc15'
    },
    strong: {
        label: 'Strong',
        width: '100%',
        color: '#10b981'
    }
};
const APP_PREFERENCE_KEY = 'asts_preferences';
const CURRENCY_OPTIONS = {
    UGX: {
        code: 'UGX',
        label: 'UGX',
        name: 'Ugandan Shilling',
        locale: 'en-UG',
        rateFromUgx: 1,
        fractionDigits: 0
    },
    USD: {
        code: 'USD',
        label: 'USD',
        name: 'US Dollar',
        locale: 'en-US',
        rateFromUgx: 0.00027,
        fractionDigits: 2
    },
    KES: {
        code: 'KES',
        label: 'KES',
        name: 'Kenyan Shilling',
        locale: 'en-KE',
        rateFromUgx: 0.035,
        fractionDigits: 2
    }
};
const LANGUAGE_OPTIONS = {
    en: {
        code: 'en',
        label: 'ENG',
        name: 'English',
        locale: 'en-UG',
        htmlLang: 'en'
    },
    sw: {
        code: 'sw',
        label: 'SWA',
        name: 'Kiswahili',
        locale: 'sw-KE',
        htmlLang: 'sw'
    },
    lg: {
        code: 'lg',
        label: 'LUG',
        name: 'Luganda',
        locale: 'en-UG',
        htmlLang: 'lg'
    }
};
const UI_COPY = {
    en: {
        nav_home: 'HOME',
        nav_booking: 'BOOK A RIDE',
        nav_services: 'SERVICES',
        nav_about: 'ABOUT US',
        nav_contact: 'CONTACT',
        nav_ussd: 'USSD',
        nav_history: 'HISTORY',
        nav_dashboard: 'DASHBOARD',
        btn_sign_in: 'Sign In',
        btn_register: 'Register',
        role_passenger: 'Passenger',
        role_driver: 'Driver',
        role_admin: 'Admin',
        role_traffic_officer: 'Traffic Officer',
        toast_signed_out: 'Signed out successfully.'
    },
    sw: {
        nav_home: 'MWANZO',
        nav_booking: 'WEKA SAFARI',
        nav_services: 'HUDUMA',
        nav_about: 'KUHUSU',
        nav_contact: 'WASILIANA',
        nav_ussd: 'USSD',
        nav_history: 'HISTORIA',
        nav_dashboard: 'DASHIBODI',
        btn_sign_in: 'Ingia',
        btn_register: 'Jisajili',
        role_passenger: 'Abiria',
        role_driver: 'Dereva',
        role_admin: 'Msimamizi',
        role_traffic_officer: 'Afisa wa Trafiki',
        toast_signed_out: 'Umetoka kwenye akaunti kwa mafanikio.'
    },
    lg: {
        nav_home: 'AWAKA',
        nav_booking: 'TEGEKA OLUGENDO',
        nav_services: 'OBUWEEREZA',
        nav_about: 'EBIKWATAKO',
        nav_contact: 'TWANDIKIRE',
        nav_ussd: 'USSD',
        nav_history: 'EBYAFAAYO',
        nav_dashboard: 'DAASHIBOODI',
        btn_sign_in: 'Yingira',
        btn_register: 'Wewandiise',
        role_passenger: 'Omutambuzi',
        role_driver: 'Omuvuuzi',
        role_admin: 'Omuddukanya',
        role_traffic_officer: 'Akulira Entambula',
        toast_signed_out: 'Ofulumye mu akawunti bulungi.'
    }
};
let appPrefs = {
    currency: 'UGX',
    language: 'en'
};

function getInitials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('') || 'U';
}

function getProfilePhotoSrc(user = currentUser) {
    const src = user?.profile_image_url;
    if (!src) return '';
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return src.startsWith('/') ? src : `/${src}`;
}

function renderUserAvatar(user = currentUser) {
    const src = getProfilePhotoSrc(user);
    if (src) {
        return `<img class="u-av-img" src="${escapeHtml(src)}" alt="${escapeHtml(user?.name || 'User')} profile photo"/>`;
    }
    return `<span>${escapeHtml(getInitials(user?.name || 'User'))}</span>`;
}

function getCurrencyConfig() {
    return CURRENCY_OPTIONS[appPrefs.currency] || CURRENCY_OPTIONS.UGX;
}

function getLanguageConfig() {
    return LANGUAGE_OPTIONS[appPrefs.language] || LANGUAGE_OPTIONS.en;
}

function t(key) {
    return UI_COPY[appPrefs.language]?.[key] || UI_COPY.en[key] || key;
}

function loadPreferences() {
    try {
        const saved = JSON.parse(localStorage.getItem(APP_PREFERENCE_KEY) || '{}');
        if (saved.currency && CURRENCY_OPTIONS[saved.currency]) {
            appPrefs.currency = saved.currency;
        }
        if (saved.language && LANGUAGE_OPTIONS[saved.language]) {
            appPrefs.language = saved.language;
        }
    } catch (error) {
        appPrefs = { currency: 'UGX', language: 'en' };
    }
}

function savePreferences() {
    localStorage.setItem(APP_PREFERENCE_KEY, JSON.stringify(appPrefs));
}

function updateTopShareLinks() {
    const currentUrl = encodeURIComponent(window.location.href);
    const message = encodeURIComponent('Explore ASTS Uganda transport services: ');
    const whatsapp = document.getElementById('top-whatsapp-link');
    const xLink = document.getElementById('top-x-link');
    if (whatsapp) {
        whatsapp.href = `https://wa.me/?text=${message}${currentUrl}`;
    }
    if (xLink) {
        xLink.href = `https://twitter.com/intent/tweet?url=${currentUrl}&text=${message}`;
    }
}

function closeTopPrefMenus() {
    document.querySelectorAll('.top-pref').forEach(menu => {
        menu.classList.remove('open');
    });
    document.querySelectorAll('.top-pref-btn').forEach(button => {
        button.setAttribute('aria-expanded', 'false');
    });
}

function toggleTopPrefMenu(type) {
    const menu = document.getElementById(`${type}-menu`);
    const wrapper = menu?.closest('.top-pref');
    const button = wrapper?.querySelector('.top-pref-btn');
    if (!wrapper) return;
    const isOpen = wrapper.classList.contains('open');
    closeTopPrefMenus();
    if (!isOpen) {
        wrapper.classList.add('open');
        button?.setAttribute('aria-expanded', 'true');
    }
}

function renderTopPreferenceMenus() {
    const currencyMenu = document.getElementById('currency-menu');
    const languageMenu = document.getElementById('language-menu');
    const currencyCurrent = document.getElementById('currency-current');
    const languageCurrent = document.getElementById('language-current');

    if (currencyCurrent) currencyCurrent.textContent = getCurrencyConfig().label;
    if (languageCurrent) languageCurrent.textContent = getLanguageConfig().label;

    if (currencyMenu) {
        currencyMenu.innerHTML = Object.values(CURRENCY_OPTIONS).map(option => `
            <button class="top-pref-item ${appPrefs.currency === option.code ? 'active' : ''}" type="button" onclick="setCurrencyPreference('${option.code}')">
                <span>${option.label}</span>
                <span class="top-pref-meta">${appPrefs.currency === option.code ? 'Selected' : option.name}</span>
            </button>
        `).join('');
    }

    if (languageMenu) {
        languageMenu.innerHTML = Object.values(LANGUAGE_OPTIONS).map(option => `
            <button class="top-pref-item ${appPrefs.language === option.code ? 'active' : ''}" type="button" onclick="setLanguagePreference('${option.code}')">
                <span>${option.label}</span>
                <span class="top-pref-meta">${appPrefs.language === option.code ? 'Selected' : option.name}</span>
            </button>
        `).join('');
    }
}

function refreshPreferenceSensitiveUI() {
    document.documentElement.lang = getLanguageConfig().htmlLang;
    renderTopPreferenceMenus();
    updateTopShareLinks();

    if (currentUser) {
        setLoggedInUI(currentUser);
    } else {
        setGuestUI();
    }

    if (routeDistKm > 0) {
        const fareText = formatUGX(getCurrentFare());
        if (document.getElementById('frt')) document.getElementById('frt').textContent = fareText;
    }

    if (currentUser?.role === 'passenger') {
        loadWallet();
        loadBookingSummary();
    }
    if (document.getElementById('history-page')?.classList.contains('active') && currentUser) {
        loadHistory();
    }
    if (document.getElementById('driver-page')?.classList.contains('active') && currentUser?.role === 'driver') {
        loadDriverDashboard();
    }
    if (document.getElementById('admin-page')?.classList.contains('active') && currentUser?.role === 'admin') {
        loadAdminDashboard();
    }
}

function setCurrencyPreference(currencyCode) {
    if (!CURRENCY_OPTIONS[currencyCode]) return;
    appPrefs.currency = currencyCode;
    savePreferences();
    closeTopPrefMenus();
    refreshPreferenceSensitiveUI();
}

function setLanguagePreference(languageCode) {
    if (!LANGUAGE_OPTIONS[languageCode]) return;
    appPrefs.language = languageCode;
    savePreferences();
    closeTopPrefMenus();
    refreshPreferenceSensitiveUI();
}

function formatUGX(amount) {
    const config = getCurrencyConfig();
    const converted = Number(amount || 0) * config.rateFromUgx;
    return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.code,
        minimumFractionDigits: config.fractionDigits,
        maximumFractionDigits: config.fractionDigits
    }).format(converted);
}

function formatDateTime(value) {
    if (!value) return 'Recent';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(getLanguageConfig().locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getCurrentFare() {
    const distance = Number(routeDistKm);
    return distance > 0 ? Math.round(distance * RATE * selModeM) : 0;
}

function getVehicleTypeForMode(mode) {
    return MODE_TO_VEHICLE_TYPE[mode] || 'Taxi';
}

function getDriverVehicleConfig(vehicleType = 'Taxi') {
    return DRIVER_VEHICLE_CONFIG[vehicleType] || DRIVER_VEHICLE_CONFIG.Taxi;
}

function evaluatePasswordStrength(password = '') {
    const value = String(password);
    const score = [
        value.length >= 8,
        /[a-z]/.test(value),
        /[A-Z]/.test(value),
        /\d/.test(value),
        /[^A-Za-z0-9]/.test(value)
    ].filter(Boolean).length;

    if (value.length < 6 || score <= 2) return 'very_weak';
    if (score === 3) return 'weak';
    if (score === 4) return 'medium';
    return 'strong';
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || payload.message || 'Request failed');
    }
    return payload;
}

// ══════════════════════════════════════════
// BOOT & SESSION
// ══════════════════════════════════════════
async function loadViews() {
    const views = ['home', 'services', 'driver', 'admin', 'history', 'ussd', 'taxi', 'boda', 'special', 'minibus', 'booking', 'marine', 'bus', 'about', 'contact', 'payment', 'safety', 'smart-tech'];
    await Promise.all(views.map(async (view) => {
        try {
            const res = await fetch(`/views/${view}.html`);
            if (res.ok) {
                const target = document.getElementById(`${view}-page`);
                if (target) target.innerHTML = await res.text();
            }
        } catch (e) { console.error('Failed to load view:', view); }
    }));
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        const btn = document.getElementById('theme-btn');
        if(btn) btn.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.classList.remove('light-theme');
        const btn = document.getElementById('theme-btn');
        if(btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

async function boot() {
    loadPreferences();
    document.title = 'A Smart Transport System Uganda - Premium Transport';
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    await loadViews();
    initReveal();
    handleRegisterPasswordInput();
    toggleRegisterTwoFactor();
    renderTopPreferenceMenus();
    updateTopShareLinks();
    document.documentElement.lang = getLanguageConfig().htmlLang;
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            const refreshed = await apiRequest(`/users/${currentUser.id}`);
            currentUser = refreshed.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            loginSuccess(currentUser);
        } catch (e) {
            console.error('Session restore failed', e);
            setGuestUI();
            showPg('home');
        }
    } else {
        setGuestUI();
        showPg('home');
    }
}

// ══════════════════════════════════════════
// AUTHENTICATION
// ══════════════════════════════════════════
function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-reg').classList.toggle('active', tab === 'register');
    document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('reg-form').style.display = tab === 'register' ? 'block' : 'none';
    showLoginErr('');
    showRegErr('');
}

function togglePW(id, btn) {
    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.innerHTML = inp.type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
}

function selRegRole(el, role) {
    regRole = role;
    document.querySelectorAll('.role-opt').forEach(r => r.classList.remove('sel'));
    el.classList.add('sel');
    const extra = document.getElementById('driver-extra');
    if (extra) extra.style.display = role === 'driver' ? 'block' : 'none';
    if (role === 'driver') {
        updateDriverVehicleFields();
        return;
    }
    clearDriverExtraFields();
}

function markVehicleCapacityManual() {
    const capacity = document.getElementById('r-vehicle-capacity');
    if (capacity) capacity.dataset.manual = 'true';
}

function clearDriverExtraFields() {
    const license = document.getElementById('r-license-number');
    const vehicleType = document.getElementById('r-vehicle-type');
    const numberPlate = document.getElementById('r-number-plate');
    const capacity = document.getElementById('r-vehicle-capacity');

    if (license) license.value = '';
    if (vehicleType) vehicleType.value = 'Taxi';
    if (numberPlate) numberPlate.value = '';
    if (capacity) {
        capacity.value = DRIVER_VEHICLE_CONFIG.Taxi.capacity;
        delete capacity.dataset.manual;
    }
    updateDriverVehicleFields();
}

function updateDriverVehicleFields() {
    const vehicleType = document.getElementById('r-vehicle-type');
    const numberPlate = document.getElementById('r-number-plate');
    const capacity = document.getElementById('r-vehicle-capacity');
    const hint = document.getElementById('driver-extra-hint');
    if (!vehicleType) return;

    const config = getDriverVehicleConfig(vehicleType.value);
    if (numberPlate) numberPlate.placeholder = config.platePlaceholder;
    if (capacity && !capacity.dataset.manual) capacity.value = config.capacity;
    if (hint) {
        hint.textContent = `Driver profile for ${config.label}. Default capacity is ${config.capacity}.`;
    }
}

function handleRegisterPasswordInput() {
    const password = document.getElementById('r-password')?.value || '';
    const strengthKey = evaluatePasswordStrength(password);
    const meta = PASSWORD_STRENGTH_META[strengthKey];
    const bar = document.getElementById('reg-pw-strength');
    const label = document.getElementById('reg-pw-strength-text');

    if (bar) {
        bar.style.width = password ? meta.width : '0';
        bar.style.background = meta.color;
    }
    if (label) {
        label.textContent = password
            ? `Password strength: ${meta.label}`
            : 'Password strength: Very weak';
        label.style.color = password ? meta.color : 'var(--text2)';
    }
}

function toggleRegisterTwoFactor() {
    const enabled = document.getElementById('r-two-factor')?.checked;
    const body = document.getElementById('r-two-factor-body');
    if (body) body.style.display = enabled ? 'block' : 'none';
}

function resetRegisterForm() {
    document.getElementById('r-name').value = '';
    document.getElementById('r-phone').value = '';
    document.getElementById('r-email').value = '';
    document.getElementById('r-password').value = '';
    const twoFactor = document.getElementById('r-two-factor');
    const twoFactorMethod = document.getElementById('r-two-factor-method');
    if (twoFactor) twoFactor.checked = false;
    if (twoFactorMethod) twoFactorMethod.value = 'sms';
    toggleRegisterTwoFactor();
    showRegErr('');
    clearDriverExtraFields();
    selRegRole(document.querySelector('.role-opt'), 'passenger');
    handleRegisterPasswordInput();
}

function showTwoFactorErr(msg) {
    const err = document.getElementById('two-factor-err');
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
}

function clearTwoFactorErr() {
    const err = document.getElementById('two-factor-err');
    if (!err) return;
    err.textContent = '';
    err.style.display = 'none';
}

function openTwoFactorPrompt(result) {
    pendingTwoFactor = {
        challengeId: result.challenge_id
    };

    const sub = document.getElementById('two-factor-sub');
    const demo = document.getElementById('two-factor-demo');
    const code = document.getElementById('two-factor-code');
    if (sub) {
        sub.textContent = `Enter the 6-digit code sent via ${result.two_factor?.channel || 'two-factor authentication'} to ${result.two_factor?.destination || 'your account'}.`;
    }
    if (demo) {
        demo.textContent = result.demo_code
            ? `Demo code: ${result.demo_code}`
            : '';
    }
    if (code) code.value = '';
    clearTwoFactorErr();
    closeM('auth-m');
    openM('two-factor-m');
}

function cancelTwoFactor() {
    pendingTwoFactor = null;
    clearTwoFactorErr();
    closeM('two-factor-m');
    openM('auth-m');
}

async function submitTwoFactor() {
    if (!pendingTwoFactor?.challengeId) {
        showTwoFactorErr('No verification challenge is active.');
        return;
    }

    const code = document.getElementById('two-factor-code')?.value.trim();
    if (!code) {
        showTwoFactorErr('Enter the verification code first.');
        return;
    }

    try {
        const result = await apiRequest('/users/verify-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challenge_id: pendingTwoFactor.challengeId,
                code
            })
        });
        pendingTwoFactor = null;
        clearTwoFactorErr();
        closeM('two-factor-m');
        loginSuccess(result.user);
        showT('ðŸ”’', 'Two-factor verification successful.', 'var(--teal)');
    } catch (err) {
        showTwoFactorErr(err.message || 'Verification failed.');
    }
}

async function doLogin() {
    const identifier = document.getElementById('l-identifier').value.trim();
    const password = document.getElementById('l-password').value;
    const errEl = document.getElementById('login-err');
    
    if (!identifier || !password) {
        showLoginErr('Please enter both identifier and password.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: identifier, password: password }) // Backend expects email
        });
        const result = await response.json();
        
        if (response.ok) {
            if (result.requires_two_factor) {
                openTwoFactorPrompt(result);
                showT('ðŸ”', result.message || 'Verification code sent.', 'var(--yellow)');
                return;
            }

            loginSuccess(result.user);
            closeM('auth-m');
            showT('👋', `Welcome back, ${result.user.name}!`, 'var(--orange)');
        } else {
            showLoginErr(result.error || 'Invalid credentials');
        }
    } catch (err) {
        showLoginErr('Network error. Is the backend running?');
    }
}


async function handleForgotPassword() {
    const email = document.getElementById('l-identifier').value.trim();
    if (!email) {
        showT('⚠️', 'Please enter your email/phone first so we know which account to reset.', 'var(--orange)');
        return;
    }

    try {
        const result = await apiRequest('/users/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        showT('🔑', result.message, 'var(--orange)');
    } catch (err) {
        showT('❌', err.message || 'Unable to process reset request.', 'var(--red)');
    }
}


async function doGoogleLogin() {
    try {
        const result = await apiRequest('/users/google-login', {
            method: 'POST'
        });
        loginSuccess(result.user);
        closeM('auth-m');
        showT('👋', `Welcome, ${result.user.name}! (Signed in via Google)`, 'var(--blue)');
    } catch (err) {
        showT('❌', err.message || 'Google Sign-In failed.', 'var(--red)');
    }
}

async function doRegister() {
    const name = document.getElementById('r-name').value.trim();
    const phone = document.getElementById('r-phone').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const password = document.getElementById('r-password').value;
    const payload = { name, email, phone, password, role: regRole };

    if (!name || !phone || !email || !password) {
        showRegErr('All fields are required.');
        return;
    }

    if (evaluatePasswordStrength(password) !== 'strong') {
        showRegErr('Please use a strong password with uppercase, lowercase, a number, and a symbol.');
        return;
    }

    Object.assign(payload, {
        two_factor_enabled: Boolean(document.getElementById('r-two-factor')?.checked),
        two_factor_method: document.getElementById('r-two-factor-method')?.value || 'sms'
    });

    if (regRole === 'driver') {
        const licenseNumber = document.getElementById('r-license-number').value.trim();
        const vehicleType = document.getElementById('r-vehicle-type').value;
        const numberPlate = document.getElementById('r-number-plate').value.trim();
        const vehicleCapacityValue = document.getElementById('r-vehicle-capacity').value.trim();
        const vehicleCapacity = Number(vehicleCapacityValue);

        if (!licenseNumber || !vehicleType || !numberPlate) {
            showRegErr('Driver accounts need a license number, vehicle type, and plate or registration number.');
            return;
        }

        if (!vehicleCapacityValue || !Number.isFinite(vehicleCapacity) || vehicleCapacity < 1) {
            showRegErr('Passenger capacity must be at least 1.');
            return;
        }

        Object.assign(payload, {
            license_number: licenseNumber,
            vehicle_type: vehicleType,
            number_plate: numberPlate,
            vehicle_capacity: Math.round(vehicleCapacity)
        });
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (response.ok) {
            showT('🎉', 'Account created! Please sign in.', 'var(--teal)');
            resetRegisterForm();
            switchAuthTab('login');
        } else {
            showRegErr(result.error || 'Registration failed');
        }
    } catch (err) {
        showRegErr('Network error during registration.');
    }
}

function loginSuccess(user) {
    currentUser = user;
    localStorage.setItem('user', JSON.stringify(user));
    setLoggedInUI(user);
    
    if (user.role === 'driver') {
        showPg('driver');
    } else if (user.role === 'admin') {
        showPg('admin');
    } else {
        showPg('home');
    }
    loadWallet();
}

// ══════════════════════════════════════════
// HOME SLIDER
// ══════════════════════════════════════════
let curSlide = 0;
let sliderTimer = null;

function moveSlide(dir) {
    const slides = document.querySelectorAll('.slide');
    if (!slides.length) return;
    curSlide = (curSlide + dir + slides.length) % slides.length;
    updateSliderUI();
    resetSliderTimer();
}

function jumpSlide(idx){
  clearInterval(sliderTimer);
  curSlide = idx;
  updateSliderUI();
  sliderTimer = setInterval(() => moveSlide(1), 5000);
}

function updateSliderUI() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.h-dot');
    if (!slides.length) return;
    
    slides.forEach((s, i) => {
        s.classList.toggle('active', i === curSlide);
    });
    dots.forEach((d, i) => {
        d.classList.toggle('active', i === curSlide);
    });
}

function resetSliderTimer() {
    if (sliderTimer) clearInterval(sliderTimer);
    sliderTimer = setInterval(() => moveSlide(1), 6000);
}

function initHomeSlider() {
    curSlide = 0;
    updateSliderUI();
    resetSliderTimer();
}

function signOut() {
    localStorage.removeItem('user');
    currentUser = null;
    setGuestUI();
    showPg('home');
    showT('👋', t('toast_signed_out'), 'var(--navy)');
}

function showLoginErr(msg) {
    const e = document.getElementById('login-err');
    e.textContent = msg || '';
    e.style.display = msg ? 'block' : 'none';
}
function showRegErr(msg) {
    const e = document.getElementById('reg-err');
    e.textContent = msg || '';
    e.style.display = msg ? 'block' : 'none';
}

function clearProfilePhotoSelection() {
    if (pendingProfilePhotoPreviewUrl) {
        URL.revokeObjectURL(pendingProfilePhotoPreviewUrl);
    }
    pendingProfilePhotoFile = null;
    pendingProfilePhotoPreviewUrl = null;
    const input = document.getElementById('profile-photo-input');
    if (input) input.value = '';
}

function showProfilePhotoErr(msg) {
    const err = document.getElementById('profile-photo-err');
    if (!err) return;
    err.textContent = msg || '';
    err.style.display = msg ? 'block' : 'none';
}

function renderProfilePhotoPreview() {
    const shell = document.getElementById('profile-photo-preview-shell');
    const removeBtn = document.getElementById('profile-photo-remove-btn');
    if (!shell) return;

    const previewSrc = pendingProfilePhotoPreviewUrl || getProfilePhotoSrc();
    if (previewSrc) {
        shell.innerHTML = `<img class="profile-photo-preview" src="${escapeHtml(previewSrc)}" alt="Profile photo preview"/>`;
    } else {
        shell.innerHTML = `
            <div class="profile-photo-placeholder">
                <i class="fas fa-user-circle"></i>
                <span>No photo yet. Choose an image to personalize your account.</span>
            </div>`;
    }

    if (removeBtn) {
        removeBtn.style.display = currentUser?.profile_image_url ? 'block' : 'none';
    }
}

function openProfilePhotoModal() {
    if (!currentUser) {
        openM('auth-m');
        return;
    }
    clearProfilePhotoSelection();
    showProfilePhotoErr('');
    renderProfilePhotoPreview();
    openM('profile-photo-m');
}

function closeProfilePhotoModal() {
    clearProfilePhotoSelection();
    showProfilePhotoErr('');
    closeM('profile-photo-m');
}

function chooseProfilePhoto() {
    document.getElementById('profile-photo-input')?.click();
}

function handleProfilePhotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showProfilePhotoErr('Please choose a JPG, PNG, or WEBP image.');
        clearProfilePhotoSelection();
        renderProfilePhotoPreview();
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showProfilePhotoErr('Profile photos must be 5 MB or smaller.');
        clearProfilePhotoSelection();
        renderProfilePhotoPreview();
        return;
    }

    if (pendingProfilePhotoPreviewUrl) {
        URL.revokeObjectURL(pendingProfilePhotoPreviewUrl);
    }

    pendingProfilePhotoFile = file;
    pendingProfilePhotoPreviewUrl = URL.createObjectURL(file);
    showProfilePhotoErr('');
    renderProfilePhotoPreview();
}

async function uploadProfilePhoto() {
    if (!currentUser) return;
    if (!pendingProfilePhotoFile) {
        showProfilePhotoErr('Choose a photo before saving.');
        return;
    }

    const formData = new FormData();
    formData.append('photo', pendingProfilePhotoFile);

    try {
        const response = await fetch(`${API_BASE_URL}/users/${currentUser.id}/profile-photo`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Unable to upload profile photo.');
        }

        currentUser = result.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        setLoggedInUI(currentUser);
        closeProfilePhotoModal();
        showT('📷', 'Profile photo updated successfully.', 'var(--teal)');
    } catch (err) {
        showProfilePhotoErr(err.message || 'Unable to upload profile photo.');
    }
}

async function removeProfilePhoto() {
    if (!currentUser?.profile_image_url) {
        showProfilePhotoErr('There is no profile photo to remove.');
        return;
    }

    try {
        const result = await apiRequest(`/users/${currentUser.id}/profile-photo`, {
            method: 'DELETE'
        });
        currentUser = result.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        setLoggedInUI(currentUser);
        renderProfilePhotoPreview();
        showProfilePhotoErr('');
        showT('🖼️', 'Profile photo removed.', 'var(--orange)');
    } catch (err) {
        showProfilePhotoErr(err.message || 'Unable to remove profile photo.');
    }
}

// ══════════════════════════════════════════
// UI BUILDERS
// ══════════════════════════════════════════
const PASS_NAV = [{key:'nav_home',p:'home'},{key:'nav_booking',p:'booking'},{key:'nav_services',p:'services'},{key:'nav_about',p:'about'},{key:'nav_contact',p:'contact'},{key:'nav_ussd',p:'ussd'},{key:'nav_history',p:'history'}];
const DRV_NAV = [{key:'nav_home',p:'home'},{key:'nav_dashboard',p:'driver'},{key:'nav_services',p:'services'},{key:'nav_about',p:'about'},{key:'nav_contact',p:'contact'},{key:'nav_history',p:'history'}];
const ADM_NAV = [{key:'nav_home',p:'home'},{key:'nav_dashboard',p:'admin'},{key:'nav_services',p:'services'},{key:'nav_about',p:'about'},{key:'nav_contact',p:'contact'},{key:'nav_history',p:'history'}];
const GUEST_NAV = [{key:'nav_home',p:'home'},{key:'nav_booking',p:'booking'},{key:'nav_services',p:'services'},{key:'nav_about',p:'about'},{key:'nav_contact',p:'contact'}];

function setGuestUI() {
    document.getElementById('nav-right').innerHTML = `
        <button class="nl" style="font-weight:700; color:#000;" onclick="openM('auth-m')">${t('btn_sign_in')}</button>
        <button class="btn-o" style="background:var(--yellow); color:#000; padding:8px 16px; border-radius:4px; font-weight:800; font-size:.74rem; box-shadow:none;" onclick="openM('auth-m');switchAuthTab('register')">${t('btn_register')}</button>`;
    buildNav(GUEST_NAV);
    const bui = document.getElementById('booking-ui');
    const gp = document.getElementById('guest-prompt');
    const sw = document.getElementById('sc-wrap');
    if (bui) bui.style.display = 'none';
    if (gp) gp.style.display = 'block';
    if (sw) sw.style.display = 'none';
}

function setLoggedInUI(user) {
    document.getElementById('nav-right').innerHTML = `
        <div class="user-chip">
            <button class="u-av-btn" type="button" title="Update profile photo" aria-label="Update profile photo" onclick="openProfilePhotoModal()">
                <div class="u-av">${renderUserAvatar(user)}</div>
                <span class="u-av-edit"><i class="fas fa-camera"></i></span>
            </button>
            <div class="user-chip-main" onclick="showPg('history')">
                <div class="u-info" style="margin:0 15px 0 2px; line-height:1.2;">
                    <div class="u-name" style="color:#000; font-size:.85rem; font-weight:700;">${escapeHtml(user.name)}</div>
                    <div class="u-role" style="color:#888; font-size:.65rem; text-transform:capitalize;">${escapeHtml(t(`role_${user.role}`))}</div>
                </div>
            </div>
        </div>
        <i class="fas fa-sign-out-alt" style="color:var(--navy); cursor:pointer; font-size:1.1rem; opacity:0.7;" onclick="signOut()"></i>`;
    const nav = user.role === 'driver'
        ? DRV_NAV
        : (user.role === 'admin' ? ADM_NAV : PASS_NAV);
    buildNav(nav);
    const bui = document.getElementById('booking-ui');
    const gp = document.getElementById('guest-prompt');
    const sw = document.getElementById('sc-wrap');
    if (bui) bui.style.display = user.role === 'passenger' ? 'block' : 'none';
    if (gp) gp.style.display = 'none';
    if (sw) sw.style.display = user.role === 'passenger' ? 'block' : 'none';
    if (user.role === 'passenger') loadBookingSummary();
}

function buildNav(cfg) {
    const mainEl = document.getElementById('navlinks-main');
    const dropEl = document.getElementById('navlinks-drop');
    const rightEl = document.getElementById('navlinks-right');
    if (!mainEl || !dropEl || !rightEl) return;

    mainEl.innerHTML = '';
    dropEl.innerHTML = '';
    if (rightEl) rightEl.innerHTML = '';

    cfg.forEach(n => {
        let style = "";
        if (n.p === 'home') style = 'background:var(--yellow); color:#000; border-radius:4px; font-weight:800; border:1px solid rgba(0,0,0,0.05);';
        
        const label = t(n.key);
        const btn = `<button class="nl" style="${style}" onclick="showPg('${n.p}', this)">${label}</button>`;
        const dropBtn = `<button class="nl" onclick="showPg('${n.p}', this)">${label}</button>`;

        if (n.p === 'home' || n.p === 'booking' || n.p === 'driver') {
            mainEl.innerHTML += btn;
        } else if (n.p === 'services' && rightEl) {
            rightEl.innerHTML += btn;
        } else {
            dropEl.innerHTML += dropBtn;
        }
    });
}

function showPg(name, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(name + '-page');
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.nl').forEach(l => l.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (name === 'booking' && currentUser?.role === 'passenger') {
        setTimeout(initHomeMap, 200);
        loadBookingSummary();
    }
    if (name === 'driver') {
        setTimeout(initDrvMap, 200);
        loadDriverDashboard();
    }
    if (name === 'admin') {
        setTimeout(initAdmMap, 200);
        loadAdminDashboard();
    }
    if (name === 'history') loadHistory();
    if (name === 'ussd') resetUSSDScreen();
    if (name === 'payment' && currentUser) {
        if (document.getElementById('pmt-bal')) {
            document.getElementById('pmt-bal').textContent = formatUGX(balance);
        }
        if (document.getElementById('pmt-card-num') && document.getElementById('sc-num-display')) {
            document.getElementById('pmt-card-num').textContent = document.getElementById('sc-num-display').textContent;
        }
        selTopup = 0;
        document.querySelectorAll('.ao').forEach(o => o.classList.remove('sel'));
        if (document.getElementById('custom-amt')) {
            document.getElementById('custom-amt').value = '';
        }
    }

    if (name === 'home') initHomeSlider();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showService(type) {
    const map = {
        'Standard Taxi': {m:'Standard Taxi', ml:1.0},
        'Boda Boda': {m:'Boda Boda', ml:0.7},
        'Special Hire': {m:'Special Hire', ml:2.0},
        'Mini Bus': {m:'Mini Bus', ml:0.5},
        'Marine Transport': {m:'Marine Transport', ml:3.0},
        'Smart Bus': {m:'Smart Bus', ml:0.3}
    };
    const s = map[type];
    if (s) bookService(s.m, s.ml);
}

function bookService(mode, mult) {
    if (!currentUser) {
        openM('auth-m');
        showT('🔒', `Sign in to book a ${mode}`, 'var(--navy)');
        return;
    }
    
    showPg('booking');
    setTimeout(() => {
        // Set the mode in the booking UI
        const modeMap = {
            'Standard Taxi': 0,
            'Boda Boda': 1,
            'Special Hire': 2,
            'Mini Bus': 3,
            'Marine Transport': 4,
            'Smart Bus': 5
        };
        const pills = document.querySelectorAll('.mpill');
        if (pills.length > modeMap[mode]) {
            selMode(pills[modeMap[mode]], mode, mult);
        }
    }, 500);
}

function needAuth(feature, cb) {
    if (!currentUser) {
        openM('auth-m');
        showT('🔒', `Sign in to access ${feature}`, 'var(--navy)');
        return;
    }
    cb();
}

// ══════════════════════════════════════════
// MAPS & ROUTING
// ══════════════════════════════════════════
const KLA = [0.3476, 32.5825];
const PROFESSIONAL_TILE_LAYER =
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const PROFESSIONAL_TILE_ATTRIBUTION =
    '&copy; OpenStreetMap contributors &copy; CARTO';


function addProfessionalTileLayer(targetMap) {
    L.tileLayer(PROFESSIONAL_TILE_LAYER, {
        attribution: PROFESSIONAL_TILE_ATTRIBUTION
    }).addTo(targetMap);
}

function initHomeMap() {
    if (!document.getElementById('map')) return;
    if (map) return;
    map = L.map('map').setView(KLA, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap drivers'
    }).addTo(map);
    
    const userIcon = L.divIcon({html:'<div style="width:14px;height:14px;background:#1a2b5e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(26,43,94,.2)"></div>',iconSize:[14,14],iconAnchor:[7,7],className:''});
    L.marker(KLA, {icon:userIcon}).addTo(map).bindPopup('<b>📍 Your Location</b>').openPopup();
}

function initDrvMap() {
    if (!document.getElementById('driver-map')) return;
    if (drvMap) return;
    drvMap = L.map('driver-map').setView(KLA, 14);
    addProfessionalTileLayer(drvMap);
}

function initAdmMap() {
    if (!document.getElementById('admin-map')) return;
    if (admMap) return;
    admMap = L.map('admin-map').setView(KLA, 12);
    addProfessionalTileLayer(admMap);
}

function getMarkerPoint(vehicle, index) {
    const lat = typeof vehicle.current_lat === 'number'
        ? vehicle.current_lat
        : KLA[0] + (index * 0.012);
    const lng = typeof vehicle.current_lng === 'number'
        ? vehicle.current_lng
        : KLA[1] + ((index % 3) * 0.015);
    return [lat, lng];
}

function clearMarkers(markers) {
    markers.forEach(marker => marker.remove());
    return [];
}

function renderHomeMarkersOnMap(vehicles) {
    if (!map) return;
    homeMarkers = clearMarkers(homeMarkers);
    vehicles.forEach((v, i) => {
        const point = getMarkerPoint(v, i);
        const icon = L.divIcon({
            html: `<div style="width:12px; height:12px; background:var(--orange); border:2px solid #fff; border-radius:50%; box-shadow:0 0 10px rgba(255,125,43,0.4);"></div>`,
            iconSize: [12, 12], className: ''
        });
        const marker = L.marker(point, { icon }).addTo(map);
        marker.bindPopup(`<b>${v.vehicle_type}</b><br>${v.number_plate}`);
        homeMarkers.push(marker);
    });
}

function renderPassengerMarkersOnMap(trips, targetMap = drvMap, markerArray = passengerMarkers) {
    if (!targetMap) return;
    markerArray.length = 0; // Clear locally if not passed from outside
    const icon = L.divIcon({
        html: `<div style="width:10px; height:10px; background:var(--teal); border:2px solid #fff; border-radius:50%; box-shadow:0 0 8px rgba(20,184,166,0.3);"></div>`,
        iconSize: [10, 10], className: ''
    });
    
    trips.forEach(trip => {
        // Mock current location for active trips based on start/end
        const point = [KLA[0] + (Math.random() - 0.5) * 0.02, KLA[1] + (Math.random() - 0.5) * 0.02];
        const marker = L.marker(point, { icon }).addTo(targetMap);
        marker.bindPopup(`<b>Passenger</b><br>${trip.start_location} -> ${trip.end_location}`);
        markerArray.push(marker);
    });
}

function renderDriverVehiclesOnMap(vehicles) {
    if (!drvMap) return;
    driverMarkers = clearMarkers(driverMarkers);
    vehicles.forEach((vehicle, index) => {
        const point = getMarkerPoint(vehicle, index);
        const marker = L.marker(point).addTo(drvMap);
        marker.bindPopup(`<b>${escapeHtml(vehicle.number_plate)}</b><br>${escapeHtml(vehicle.vehicle_type)}<br>${vehicle.available_seats} seats available`);
        driverMarkers.push(marker);
    });
}

function renderAdminVehiclesOnMap(vehicles) {
    if (!admMap) return;
    adminMarkers = clearMarkers(adminMarkers);
    if (!vehicles.length) return;

    vehicles.forEach((vehicle, index) => {
        const point = getMarkerPoint(vehicle, index);
        const marker = L.marker(point).addTo(admMap);
        marker.bindPopup(`<b>${escapeHtml(vehicle.number_plate)}</b><br>${escapeHtml(vehicle.driver_name || 'Assigned Driver')}<br>${escapeHtml(vehicle.vehicle_type)}`);
        adminMarkers.push(marker);
    });

    admMap.setView(getMarkerPoint(vehicles[0], 0), 11);
}

async function doGeocode(field) {
    const val = document.getElementById(field).value.trim();
    const sugDiv = document.getElementById(field + '-suggestions');
    if (val.length < 3) { sugDiv.innerHTML = ''; return; }
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val + ', Uganda')}&format=json&limit=4`);
        const data = await res.json();
        sugDiv.innerHTML = `<div style="position:absolute;width:100%;background:#fff;border:1.5px solid var(--border);border-radius:0 0 8px 8px;box-shadow:var(--shadow-md);z-index:100;">${
            data.map(d => `<div onclick="pickSuggestion('${field}','${d.display_name}',${d.lat},${d.lon})" style="padding:10px;cursor:pointer;font-size:.8rem;border-bottom:1px solid var(--border);">${d.display_name.split(',').slice(0,3).join(',')}</div>`).join('')
        }</div>`;
    } catch (e) { sugDiv.innerHTML = ''; }
}

let geocodeTimer;
function geocodeLive(field) {
    clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => doGeocode(field), 600);
}

function pickSuggestion(field, name, lat, lon) {
    document.getElementById(field).value = name.split(',')[0];
    document.getElementById(field + '-suggestions').innerHTML = '';
    coords[field] = [parseFloat(lat), parseFloat(lon)];
    if (coords.pickup && coords.dropoff) calcRoute();
}

function calcRoute() {
    if (!map) return;
    if (routingControl) map.removeControl(routingControl);
    routingControl = L.Routing.control({
        waypoints: [L.latLng(coords.pickup[0], coords.pickup[1]), L.latLng(coords.dropoff[0], coords.dropoff[1])],
        lineOptions: { styles: [{ color: '#f97316', weight: 5 }] },
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' })
    }).on('routesfound', e => {
        const r = e.routes[0].summary;
        routeDistKm = (r.totalDistance / 1000).toFixed(1);
        routeTimeMin = Math.ceil(r.totalTime / 60);
        document.getElementById('mi-dist').textContent = routeDistKm + ' km';
        document.getElementById('mi-time').textContent = routeTimeMin + ' min';
        document.getElementById('frd').textContent = routeDistKm + ' km';
        document.getElementById('frtime').textContent = routeTimeMin + ' min';
        document.getElementById('frt').textContent = formatUGX(getCurrentFare());
        document.getElementById('frm').textContent = selModeV;
        document.getElementById('farebox').classList.add('show');
    }).addTo(map);
}

// ══════════════════════════════════════════
// WALLET & PAYMENTS
// ══════════════════════════════════════════
function startTopupFlow() {
    if (!currentUser) { openM('auth-m'); return; }
    showPg('payment');
    
    // Auto-select a common top-up amount to make it "ready" for payment
    setTimeout(() => {
        const defaultAmtPill = document.querySelector('.amtg .ao:nth-child(3)'); // 50k
        if (defaultAmtPill) selAmtP(defaultAmtPill, 50000);
        showT('💳', 'Choose an amount and method to complete your top-up.', 'var(--cyan)');
    }, 500);
}

async function loadWallet() {
    if (!currentUser || currentUser.role === 'driver' || currentUser.role === 'admin') {
        const resetStr = '0 UGX';
        if (document.getElementById('baldis')) document.getElementById('baldis').textContent = resetStr;
        if (document.getElementById('sc-num-display')) document.getElementById('sc-num-display').textContent = 'N/A';
        return;
    }
    try {
        const wallet = await apiRequest(`/payments/wallet?user_id=${currentUser.id}`);
        balance = wallet.balance;
        const bStr = formatUGX(balance);
        if (document.getElementById('baldis')) document.getElementById('baldis').textContent = bStr;
        if (document.getElementById('sc-num-display')) document.getElementById('sc-num-display').textContent = wallet.card_number;
        if (document.getElementById('pmt-bal')) document.getElementById('pmt-bal').textContent = bStr;
        if (document.getElementById('pmt-card-num')) document.getElementById('pmt-card-num').textContent = wallet.card_number;
        if (document.getElementById('balbadge')) document.getElementById('balbadge').textContent = bStr;
        if (document.getElementById('d-bal')) document.getElementById('d-bal').textContent = bStr;
    } catch (e) {
        console.error('Wallet load failed', e);
    }
}

function selAmt(el, amt) {
    document.querySelectorAll('.ao').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    selTopup = amt;
}

async function confTopup() {
    if (!selTopup) { showT('⚠️', 'Select an amount', 'var(--orange)'); return; }
    await processPayment(selTopup, 'MTN Mobile Money');
}

let selMethodV = 'MTN';
function selMethod(el, m) {
    document.querySelectorAll('.pm-opt').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    selMethodV = m;
}

function selAmtP(el, amt) {
    document.querySelectorAll('.ao').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    selTopup = amt;
    document.getElementById('custom-amt').value = '';
}

function clearPills() {
    document.querySelectorAll('.ao').forEach(o => o.classList.remove('sel'));
    selTopup = 0;
}

async function processFinalPayment() {
    let amt = selTopup;
    const custom = document.getElementById('custom-amt').value;
    if (custom) amt = parseInt(custom);
    
    if (!amt || amt <= 0) { showT('⚠️', 'Please enter or select a valid amount', 'var(--yellow)'); return; }
    
    const btn = document.getElementById('pay-btn');
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    await processPayment(amt, selMethodV);
    
    btn.disabled = false;
    btn.textContent = oldText;
}

async function processPayment(amt, method) {
    try {
        await apiRequest('/payments/wallet/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, amount: amt, method: method })
        });
        showT('💰', `Successfully topped up ${formatUGX(amt)} via ${method}`, 'var(--yellow)');
        await loadWallet();
        if (document.getElementById('history-page')?.classList.contains('active')) {
            await loadHistory();
        }
        closeM('topup-m');
        if (document.getElementById('payment-page')?.classList.contains('active')) {
            setTimeout(() => showPg('booking'), 1500);
        }
    } catch(e) {
        showT('❌', e.message || 'Top-up failed. Please try again.', 'var(--red)');
    }
}

// ══════════════════════════════════════════
// RIDES
// ══════════════════════════════════════════
function selMode(el, mode, mult) {
    document.querySelectorAll('.mpill').forEach(c => c.classList.remove('sel'));
    el.classList.add('sel');
    selModeV = mode; selModeM = mult;
    document.getElementById('frm').textContent = mode;
    if (routeDistKm > 0) {
        document.getElementById('frt').textContent = formatUGX(getCurrentFare());
    }
}

async function calcFare() {
    if (!currentUser) { openM('auth-m'); return; }
    const fare = getCurrentFare();
    if (!fare || fare <= 0) { showT('📍', 'Please select locations first', 'var(--navy)'); return; }
    
    if (fare > balance) {
        showT('❌', 'Insufficient balance. Please top up.', 'var(--red)');
        return;
    }

    try {
        let vehicles = await apiRequest(`/vehicles/active?type=${encodeURIComponent(getVehicleTypeForMode(selModeV))}`).catch(() => []);

        const availableVehicles = vehicles.filter(vehicle => (
            (vehicle.available_seats ?? (vehicle.capacity - vehicle.current_passengers)) > 0
        ));

        if (!availableVehicles.length) {
            showT('🚫', `No active ${selModeV} vehicles are available right now.`, 'var(--red)');
            return;
        }

        currentBookingVehicle = availableVehicles.sort((left, right) => (
            (right.available_seats ?? 0) - (left.available_seats ?? 0)
        ))[0];

        document.getElementById('drvbox').classList.add('show');
        document.getElementById('drv-name').textContent = `${currentBookingVehicle.driver_name || 'Verified Driver'} ✓`;
        document.getElementById('drv-meta').textContent = `${currentBookingVehicle.number_plate} · ${currentBookingVehicle.vehicle_type} · ${currentBookingVehicle.available_seats} seats left`;
        document.getElementById('drv-eta').textContent = `~${Math.max(3, Math.min(8, currentBookingVehicle.id + 1))} min`;

        const cbb = document.getElementById('confirm-booking-box');
        if (cbb) {
            cbb.style.display = 'block';
            cbb.classList.add('reveal', 'active');
        }

        showT('🚕', 'Driver found from the live backend fleet. Confirm to book.', 'var(--yellow)');
    } catch (e) {
        showT('❌', e.message || 'Unable to fetch an active vehicle right now.', 'var(--red)');
    }
}

async function registerBooking() {
    if (!currentUser) { openM('auth-m'); return; }
    const fare = getCurrentFare();
    if (!currentBookingVehicle) {
        showT('🚕', 'Calculate fare first so we can match you to an active vehicle.', 'var(--navy)');
        return;
    }
    
    showT('🚕', 'Registering trip...', 'var(--yellow)');
    
    try {
        const data = await apiRequest('/trips/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                passenger_id: currentUser.id,
                vehicle_id: currentBookingVehicle.id,
                start_location: document.getElementById('pickup').value,
                end_location: document.getElementById('dropoff').value,
                fare: fare
            })
        });

        await apiRequest('/payments/pay_trip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trip_id: data.trip.id, user_id: currentUser.id })
        });
        
        lastTripId = data.trip.id;
        showT('✅', 'Ride registered and paid successfully. Enjoy your journey.', 'var(--yellow)');
        
        document.getElementById('confirm-booking-box').style.display = 'none';
        document.getElementById('farebox').classList.remove('show');
        document.getElementById('drvbox').classList.remove('show');
        document.getElementById('pickup').value = '';
        document.getElementById('dropoff').value = '';
        currentBookingVehicle = null;
        routeDistKm = 0;
        routeTimeMin = 0;
        coords.pickup = null;
        coords.dropoff = null;
        if (routingControl && map) map.removeControl(routingControl);
        routingControl = null;
        
        await loadWallet();
        await loadBookingSummary();
        if (document.getElementById('history-page')?.classList.contains('active')) {
            await loadHistory();
        }
    } catch(e) { 
        console.error(e);
        showT('❌', e.message || 'Network error during booking registration.', 'var(--red)');
    }
}

// ══════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════
async function legacyLoadHistory() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/trips/history?user_id=${currentUser.id}`);
        if (res.ok) {
            const data = await res.json();
            const list = document.getElementById('txlist');
            if (!list) return;
            list.innerHTML = data.trips.map(t => `
                <div class="txi">
                    <div class="txic ride"><i class="fas fa-taxi"></i></div>
                    <div class="txd">
                        <div class="txtt">${t.start_location} → ${t.end_location}</div>
                        <div class="txdt">${t.timestamp}</div>
                    </div>
                    <div class="txam debit">−${t.fare.toLocaleString()} UGX</div>
                </div>
            `).join('');
            
            // Stats
            document.getElementById('trides').textContent = data.trips.length;
            const total = data.trips.reduce((s, t) => s + t.fare, 0);
            document.getElementById('tspent').textContent = total.toLocaleString() + ' UGX';
        }
    } catch(e) {}
}

async function legacyLoadBookingSummary() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/trips/history?user_id=${currentUser.id}`);
        if (res.ok) {
            const data = await res.json();
            const sec = document.getElementById('booking-summary-sec');
            const list = document.getElementById('booking-summary-list');
            if (!sec || !list) return;
            
            if (data.trips.length > 0) {
                sec.style.display = 'block';
                list.innerHTML = data.trips.slice(0, 3).map(t => `
                    <div class="srv-card" style="padding:16px; border-left: 4px solid var(--yellow); background:rgba(255,194,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                            <span class="chip co" style="background:var(--yellow); color:#000; font-weight:800; border:none; padding:4px 10px;">Registered</span>
                            <span style="font-size: .7rem; color: var(--text3);">${t.timestamp}</span>
                        </div>
                        <h4 style="margin-bottom:6px; font-size:.9rem;">${t.start_location}</h4>
                        <div style="font-size: .8rem; color: var(--text3); margin-bottom:10px;">to ${t.end_location}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <b style="color: var(--yellow); font-size: .9rem;">${t.fare.toLocaleString()} UGX</b>
                            <button class="btn-ghost" style="padding: 4px 10px; font-size: .7rem; border-color:var(--yellow); color:var(--text);" onclick="rebook('${t.start_location}', '${t.end_location}')">Rebook</button>
                        </div>
                    </div>
                `).join('');
            } else {
                sec.style.display = 'none';
            }
        }
    } catch(e) {}
}

// ══════════════════════════════════════════
// USSD SIMULATOR (Professional Flow)
// ══════════════════════════════════════════
// Legacy USSD Simulator removed to fix redeclaration error and prevent conflict.

// ══════════════════════════════════════════
// SAFETY & UTILS
// ══════════════════════════════════════════
function legacySubmitRating() {
    showT('⭐', 'Thank you for your rating!', 'var(--orange)');
    closeM('rating-m');
}

function submitLostReport() {
    showT('🔍', 'Report submitted. Drivers notified.', 'var(--navy)');
    closeM('lost-m');
}

function legacyTrigSOS() {
    showT('🚨', 'SOS Alert Sent!', 'var(--red)');
    closeM('sos-m');
}

async function shareTrip() {
    if (!currentUser) { openM('auth-m'); return; }
    const shareData = {
        title: 'A Smart Transport System Uganda',
        text: `Track my ride: ${currentUser.name} is on their way!`,
        url: 'https://smarttaxi.ug/track/' + currentUser.id
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            navigator.clipboard.writeText(shareData.url);
            showT('📤', 'Tracking link copied!', 'var(--navy)');
        }
    } catch (e) { console.error('Share failed', e); }
}

function rebook(p, d) {
    document.getElementById('pickup').value = p;
    document.getElementById('dropoff').value = d;
    showT('📍', 'Route updated from recent trip.', 'var(--navy)');
    scrollToBook();
    // Simulate geocoding to trigger route
    setTimeout(() => {
        coords.pickup = KLA; // Mock coordinates for rebook demo
        coords.dropoff = [KLA[0]+0.02, KLA[1]+0.02];
        calcRoute();
    }, 500);
}

function scrollToBook() { showPg('booking'); }

function renderTransactions(filter = 'all') {
    const list = document.getElementById('txlist');
    if (!list) return;
    const filtered = txns.filter(txn => filter === 'all' || txn.type === filter);

    if (!filtered.length) {
        list.innerHTML = `
            <div class="txi">
                <div class="txic"><i class="fas fa-clock"></i></div>
                <div class="txd">
                    <div class="txtt">No ${filter === 'all' ? '' : filter + ' '}transactions yet</div>
                    <div class="txdt">Your backend transaction history will appear here.</div>
                </div>
            </div>`;
        return;
    }

    list.innerHTML = filtered.map(txn => `
        <div class="txi">
            <div class="txic ${txn.type}"><i class="fas ${txn.type === 'topup' ? 'fa-wallet' : 'fa-taxi'}"></i></div>
            <div class="txd">
                <div class="txtt">${escapeHtml(txn.title)}</div>
                <div class="txdt">${escapeHtml(txn.subtitle || 'ASTS transaction')} · ${formatDateTime(txn.created_at)}</div>
            </div>
            <div class="txam ${txn.direction === 'credit' ? 'credit' : 'debit'}">${txn.direction === 'credit' ? '+' : '-'}${formatUGX(txn.amount)}</div>
        </div>
    `).join('');
}

function filtTx(type, btn) {
    document.querySelectorAll('.fbtn').forEach(button => button.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTransactions(type);
}

async function loadHistory() {
    if (!currentUser) return;
    try {
        const data = await apiRequest(`/payments/history?user_id=${currentUser.id}`);
        txns = data.transactions || [];
        if (document.getElementById('trides')) document.getElementById('trides').textContent = data.totals?.rides ?? 0;
        if (document.getElementById('tspent')) document.getElementById('tspent').textContent = formatUGX(data.totals?.spent ?? 0);
        if (document.getElementById('ttopup')) document.getElementById('ttopup').textContent = formatUGX(data.totals?.topups ?? 0);
        const activeFilter = document.querySelector('.fbtn.active');
        const filter = activeFilter?.textContent?.toLowerCase().includes('top') ? 'topup'
            : activeFilter?.textContent?.toLowerCase().includes('ride') ? 'ride'
            : 'all';
        renderTransactions(filter);
    } catch (e) {
        console.error('History load failed', e);
    }
}

async function loadBookingSummary() {
    if (!currentUser) return;
    try {
        const data = await apiRequest(`/trips/history?user_id=${currentUser.id}`);
        const sec = document.getElementById('booking-summary-sec');
        const list = document.getElementById('booking-summary-list');
        if (!sec || !list) return;

        if (data.trips?.length) {
            lastTripId = data.trips[0].id;
            sec.style.display = 'block';
            list.innerHTML = data.trips.slice(0, 3).map(trip => `
                <div class="srv-card" style="padding:16px; border-left: 4px solid var(--yellow); background:rgba(255,194,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <span class="chip co" style="background:var(--yellow); color:#000; font-weight:800; border:none; padding:4px 10px;">${escapeHtml(trip.status || 'registered')}</span>
                        <span style="font-size: .7rem; color: var(--text3);">${formatDateTime(trip.created_at || trip.timestamp)}</span>
                    </div>
                    <h4 style="margin-bottom:6px; font-size:.9rem;">${escapeHtml(trip.start_location)}</h4>
                    <div style="font-size: .8rem; color: var(--text3); margin-bottom:10px;">to ${escapeHtml(trip.end_location)}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="color: var(--yellow); font-size: .9rem;">${formatUGX(trip.fare)}</b>
                        <button class="btn-ghost" style="padding: 4px 10px; font-size: .7rem; border-color:var(--yellow); color:var(--text);" onclick='rebook(${JSON.stringify(trip.start_location)}, ${JSON.stringify(trip.end_location)})'>Rebook</button>
                    </div>
                </div>
            `).join('');
        } else {
            sec.style.display = 'none';
        }
    } catch (e) {
        console.error('Booking summary load failed', e);
    }
}

function resetUSSDScreen() {
    ussdSessionStarted = false;
    const screen = document.getElementById('uscr');
    const input = document.getElementById('uinp');
    if (screen) screen.textContent = 'A Smart Transport System Uganda\nDial *123# to begin';
    if (input) input.value = '';
}

async function sendUSSD() {
    const input = document.getElementById('uinp');
    const value = input?.value.trim() || '';
    if (input) input.value = '';
    if (!ussdSessionStarted && !value) {
        await processUSSD('');
        return;
    }
    if (!value) return;
    await processUSSD(value);
}

async function processUSSD(v) {
    const screen = document.getElementById('uscr');
    if (!screen) return;

    try {
        const response = await fetch(`${API_BASE_URL}/ussd/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: currentUser?.phone || '0700000000',
                text: v,
                session_id: currentUser ? `web-${currentUser.id}` : 'web-guest'
            })
        });
        const data = await response.json();
        const message = (data.message || 'No response received')
            .replace(/^CON\s*/, '')
            .replace(/^END\s*/, '');
        screen.textContent = message;
        ussdSessionStarted = Boolean(data.message?.startsWith('CON'));
    } catch (e) {
        screen.textContent = 'Unable to reach the USSD service right now.';
    }
}

async function getLatestTripId() {
    if (lastTripId) return lastTripId;
    if (!currentUser) return null;
    try {
        const data = await apiRequest(`/trips/history?user_id=${currentUser.id}`);
        lastTripId = data.trips?.[0]?.id ?? null;
        return lastTripId;
    } catch (e) {
        return null;
    }
}

async function submitRating() {
    const tripId = await getLatestTripId();
    if (!tripId) {
        showT('⭐', 'Complete a trip first so we have something to rate.', 'var(--orange)');
        closeM('rating-m');
        return;
    }

    try {
        await apiRequest(`/trips/${tripId}/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: 5, feedback: 'Submitted from the web dashboard' })
        });
        showT('⭐', 'Thank you for your rating!', 'var(--orange)');
        closeM('rating-m');
    } catch (e) {
        showT('❌', e.message || 'Unable to submit rating right now.', 'var(--red)');
    }
}

async function trigSOS() {
    const tripId = await getLatestTripId();
    if (!tripId) {
        showT('🚨', 'No recent trip was found to attach the SOS alert to.', 'var(--red)');
        closeM('sos-m');
        return;
    }

    try {
        await apiRequest(`/trips/${tripId}/sos`, { method: 'POST' });
        showT('🚨', 'SOS alert sent to the backend monitoring center.', 'var(--red)');
        closeM('sos-m');
        if (currentUser?.role === 'admin') {
            loadAdminDashboard();
        }
    } catch (e) {
        showT('❌', e.message || 'Unable to send SOS right now.', 'var(--red)');
    }
}

function updateDriverPresence(isOnline) {
    drvOnline = Boolean(isOnline);
    const dot = document.getElementById('odot');
    const label = document.getElementById('olbl');
    if (dot) dot.style.background = drvOnline ? 'var(--yellow)' : '#9ca3af';
    if (label) label.textContent = drvOnline ? 'Online' : 'Offline';
}

function renderDriverCards(recentTrips = [], vehicles = [], pendingTrips = [], activeTrips = []) {
    const container = document.getElementById('rreqs');
    const chip = document.getElementById('driver-request-chip');
    if (!container) return;

    if (chip) {
        const total = pendingTrips.length + activeTrips.length + recentTrips.length;
        chip.textContent = `${total} Live Records`;
    }

    let html = '';

    // 1. Pending Approvals (Priority)
    if (pendingTrips.length > 0) {
        html += `<h3 style="font-size:1rem; margin-bottom:12px; color:var(--orange);">Pending Approvals (${pendingTrips.length})</h3>`;
        html += pendingTrips.map(trip => `
            <div class="rc" style="border: 1.5px solid var(--orange); border-radius:12px; padding:16px; background:rgba(255,194,0,0.02); margin-bottom:12px;">
                <div class="rct">
                    <div>
                        <div class="rr" style="font-weight:700; color:var(--navy); margin-bottom:4px;">${escapeHtml(trip.start_location)} -> ${escapeHtml(trip.end_location)}</div>
                        <div class="rm" style="display:flex; gap:12px; font-size:.74rem; color:var(--text3); flex-wrap:wrap;">
                            <span><i class="fas fa-user"></i> ${escapeHtml(trip.passenger_name || 'New Passenger')}</span>
                            <span><i class="fas fa-clock"></i> ${formatDateTime(trip.created_at)}</span>
                        </div>
                    </div>
                    <div class="rf" style="font-size:1.1rem; font-weight:800; color:var(--orange);">${formatUGX(trip.fare)}</div>
                </div>
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button class="btn-full" style="flex:1; padding:10px; font-size:.85rem; background:var(--orange);" onclick="approveBooking(${trip.id})">Approve</button>
                    <button class="btn-ghost" style="flex:1; padding:10px; font-size:.85rem; border-color:var(--red); color:var(--red);" onclick="rejectBooking(${trip.id})">Decline</button>
                </div>
            </div>
        `).join('');
    }

    // 2. Active Trips
    if (activeTrips.length > 0) {
        html += `<h3 style="font-size:1rem; margin:20px 0 12px; color:var(--teal);">Active Rides</h3>`;
        html += activeTrips.map(trip => `
            <div class="rc" style="border: 1.5px solid var(--teal); border-radius:12px; padding:16px; background:rgba(20,184,166,0.02); margin-bottom:12px;">
                <div class="rct">
                    <div>
                        <div class="rr" style="font-weight:700; color:var(--navy); margin-bottom:4px;">${escapeHtml(trip.start_location)} -> ${escapeHtml(trip.end_location)}</div>
                        <div class="rm" style="display:flex; gap:12px; font-size:.74rem; color:var(--text3); flex-wrap:wrap;">
                            <span><i class="fas fa-spinner fa-spin"></i> In Progress</span>
                            <span><i class="fas fa-car"></i> ${escapeHtml(trip.number_plate || 'Vehicle')}</span>
                        </div>
                    </div>
                    <div class="rf" style="font-size:1.1rem; font-weight:800; color:var(--teal);">${formatUGX(trip.fare)}</div>
                </div>
                <div style="margin-top:14px;">
                    <button class="btn-full" style="width:100%; padding:10px; font-size:.85rem; background:var(--teal);" onclick="completeBooking(${trip.id})">Complete & Charge</button>
                </div>
            </div>
        `).join('');
    }

    // 3. Recent History or Vehicles if nothing else
    if (html === '') {
        if (recentTrips.length) {
            html += recentTrips.map(trip => `
                <div class="rc" style="border: 1.5px solid var(--border); border-radius:12px; padding:16px; background:var(--white); box-shadow:var(--shadow-md); margin-bottom:12px;">
                    <div class="rct">
                        <div>
                            <div class="rr" style="font-weight:700; color:var(--navy); margin-bottom:4px;">${escapeHtml(trip.start_location)} -> ${escapeHtml(trip.end_location)}</div>
                            <div class="rm" style="display:flex; gap:12px; font-size:.74rem; color:var(--text3); flex-wrap:wrap;">
                                <span><i class="fas fa-check-circle"></i> Completed</span>
                                <span><i class="fas fa-clock"></i> ${formatDateTime(trip.created_at)}</span>
                            </div>
                        </div>
                        <div class="rf" style="font-size:1.1rem; font-weight:800; color:var(--text3);">${formatUGX(trip.fare)}</div>
                    </div>
                </div>
            `).join('');
        } else if (vehicles.length) {
            html += vehicles.map(vehicle => `
                <div class="rc" style="border: 1.5px solid var(--border); border-radius:12px; padding:16px; background:var(--white); box-shadow:var(--shadow-md); margin-bottom:12px;">
                    <div class="rct">
                        <div>
                            <div class="rr" style="font-weight:700; color:var(--navy); margin-bottom:4px;">${escapeHtml(vehicle.number_plate)}</div>
                            <div class="rm" style="display:flex; gap:12px; font-size:.74rem; color:var(--text3); flex-wrap:wrap;">
                                <span><i class="fas fa-car"></i> ${escapeHtml(vehicle.vehicle_type)}</span>
                                <span><i class="fas fa-users"></i> ${vehicle.current_passengers}/${vehicle.capacity} occupied</span>
                                <span><i class="fas fa-circle" style="color:${vehicle.is_active ? 'var(--yellow)' : '#9ca3af'}"></i> ${vehicle.is_active ? 'Online' : 'Offline'}</span>
                            </div>
                        </div>
                        <div class="rf" style="font-size:1rem; font-weight:800; color:var(--orange);">${vehicle.available_seats} seats free</div>
                    </div>
                </div>
            `).join('');
        } else {
            html = `
            <div class="rc" style="border: 1.5px solid var(--border); border-radius:12px; padding:16px; background:var(--white); box-shadow:var(--shadow-md); margin-bottom:12px;">
                <div class="rr" style="font-weight:700; color:var(--navy); margin-bottom:4px;">No activity yet</div>
                <div class="rm" style="display:flex; gap:12px; font-size:.74rem; color:var(--text3);">
                    <span><i class="fas fa-info-circle"></i> Waiting for new trip requests...</span>
                </div>
            </div>`;
        }
    }

    container.innerHTML = html;
}

async function togOnline() {
    if (currentUser?.role !== 'driver') return;

    try {
        const nextStatus = !drvOnline;
        const data = await apiRequest(`/users/${currentUser.id}/driver-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: nextStatus })
        });
        updateDriverPresence(data.online);
        renderDriverVehiclesOnMap(data.vehicles || []);
        renderDriverCards([], data.vehicles || []);
        showT('🚗', `Driver availability is now ${data.online ? 'online' : 'offline'}.`, 'var(--yellow)');
        loadDriverDashboard();
    } catch (e) {
        showT('❌', e.message || 'Unable to update driver availability.', 'var(--red)');
    }
}

function renderAdminAlerts(alerts = []) {
    const container = document.getElementById('admin-alerts');
    if (!container) return;

    if (!alerts.length) {
        container.innerHTML = `
            <div class="alert-c danger" style="border: 1.5px solid #ff4444; border-radius:12px; padding:20px; background:rgba(255,68,68,0.05); margin-bottom:16px;">
                <div class="at-t" style="color:#ff4444; font-weight:800; font-size:1rem; margin-bottom:4px;"><i class="fas fa-shield-heart"></i> No active SOS alerts</div>
                <div class="at-d" style="font-size:.8rem; color:var(--text2);">The backend has not reported any emergency trips right now.</div>
            </div>`;
        return;
    }

    container.innerHTML = alerts.map(alert => `
        <div class="alert-c danger" style="border: 1.5px solid #ff4444; border-radius:12px; padding:20px; background:rgba(255,68,68,0.05); margin-bottom:16px;">
            <div class="at-t" style="color:#ff4444; font-weight:800; font-size:1rem; margin-bottom:4px;"><i class="fas fa-triangle-exclamation"></i> SOS Trip #${alert.id}</div>
            <div class="at-d" style="font-size:.8rem; color:var(--text2);">${escapeHtml(alert.start_location)} -> ${escapeHtml(alert.end_location)} · ${formatDateTime(alert.created_at || alert.timestamp)}</div>
        </div>
    `).join('');
}

function renderPendingDrivers(drivers = []) {
    const body = document.getElementById('admin-queue-body');
    const chip = document.getElementById('admin-queue-chip');
    if (!body || !chip) return;

    chip.textContent = `${drivers.length} Applications Pending`;
    if (!drivers.length) {
        body.innerHTML = `
            <tr style="border-bottom:1px solid var(--border);">
                <td colspan="6" style="padding:18px; text-align:center; color:var(--text3);">No pending driver approvals are waiting in the backend queue.</td>
            </tr>`;
        return;
    }

    body.innerHTML = drivers.map(driver => {
        const vehicle = driver.vehicles?.[0];
        return `
            <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:14px;"><b style="font-size:1rem;">${escapeHtml(driver.name)}</b></td>
                <td style="padding:14px;">${escapeHtml(driver.license_number)}</td>
                <td style="padding:14px;">${escapeHtml(vehicle?.number_plate || 'No vehicle yet')}</td>
                <td style="padding:14px;">${escapeHtml(vehicle?.vehicle_type || 'Pending assignment')}</td>
                <td style="padding:14px;"><span class="chip cm" style="background:#e5e7eb; color:#4b5563;">Pending</span></td>
                <td style="padding:14px; text-align:center;"><span style="color:var(--text3); font-size:.8rem;">Review workflow is ready</span></td>
            </tr>`;
    }).join('');
}

async function loadAdminDashboard() {
    if (currentUser?.role !== 'admin') return;

    try {
        const data = await apiRequest('/admin/dashboard');
        const stats = data.stats || {};
        const vehicles = data.active_vehicles || [];

        if (document.getElementById('admin-active-vehicles')) document.getElementById('admin-active-vehicles').textContent = vehicles.length;
        if (document.getElementById('admin-total-passengers')) document.getElementById('admin-total-passengers').textContent = stats.total_passengers ?? 0;
        if (document.getElementById('admin-pending-count')) document.getElementById('admin-pending-count').textContent = stats.pending_drivers_count ?? 0;
        if (document.getElementById('admin-revenue')) document.getElementById('admin-revenue').textContent = formatUGX(stats.total_revenue ?? 0);
        if (document.getElementById('admin-demand-forecast')) {
            document.getElementById('admin-demand-forecast').textContent = `${vehicles.length} active vehicles are being monitored across the network right now.`;
        }
        if (document.getElementById('admin-routing-note')) {
            document.getElementById('admin-routing-note').textContent = stats.sos_alerts_count
                ? `${stats.sos_alerts_count} SOS alerts need attention on the live map.`
                : 'No emergency routing conflicts are currently flagged by the backend.';
        }
        if (document.getElementById('admin-revenue-note')) {
            document.getElementById('admin-revenue-note').textContent = `${formatUGX(stats.total_revenue ?? 0)} has been collected from completed rides.`;
        }

        initAdmMap();
        renderAdminVehiclesOnMap(vehicles);
        renderAdminAlerts(data.sos_alerts || []);
        renderPendingDrivers(data.pending_drivers || []);
    } catch (e) {
        showT('❌', e.message || 'Unable to load admin dashboard.', 'var(--red)');
    }
}

function legacyOpenM(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show');
}

function legacyCloseM(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
}

function appDrv() {
    showT('ℹ️', 'Pending-driver review is now fed from the backend queue.', 'var(--yellow)');
}

function rejDrv() {
    showT('ℹ️', 'Pending-driver review is now fed from the backend queue.', 'var(--yellow)');
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function openM(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show');
}
function closeM(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
}
function showT(icon, msg, bc) {
    const t = document.getElementById('toast');
    document.getElementById('ticon').innerHTML = icon.startsWith('<') ? icon : `<span>${icon}</span>`;
    document.getElementById('tmsg').textContent = msg;
    t.style.borderLeft = `4px solid ${bc || 'var(--orange)'}`;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 4000);
}

// ══════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════

function initReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.top-pref')) {
        closeTopPrefMenus();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeTopPrefMenus();
    }
});

async function approveBooking(tripId) {
    try {
        const result = await apiRequest(`/trips/${tripId}/approve`, { method: 'POST' });
        showT('✅', result.message, 'var(--teal)');
        loadDriverDashboard();
    } catch (e) {
        showT('❌', e.message || 'Unable to approve booking.', 'var(--red)');
    }
}


async function rejectBooking(tripId) {
    try {
        const result = await apiRequest(`/trips/${tripId}/reject`, { method: 'POST' });
        showT('⚠️', result.message, 'var(--orange)');
        loadDriverDashboard();
    } catch (e) {
        showT('❌', e.message || 'Unable to reject booking.', 'var(--red)');
    }
}


async function completeBooking(tripId) {
    try {
        const result = await apiRequest(`/trips/${tripId}/complete`, { method: 'POST' });
        showT('✅', result.message, 'var(--teal)');
        loadDriverDashboard();
    } catch (e) {
        showT('❌', e.message || 'Unable to complete trip.', 'var(--red)');
    }
}

async function initLiveTracking() {
    if (liveTrackingInterval) clearInterval(liveTrackingInterval);
    
    const poll = async () => {
        if (!currentUser) return;
        try {
            const data = await apiRequest('/vehicles/live-locations');
            
            // 1. Update general map (all active vehicles)
            if (map && document.getElementById('map')) {
                renderHomeMarkersOnMap(data.vehicles || []);
            }
            
            // 2. Update driver map (nearby passengers/active trips)
            if (drvMap && document.getElementById('driver-map') && currentUser.role === 'driver') {
                renderPassengerMarkersOnMap(data.trips || []);
            }
            
            // 3. Update admin map (everything)
            if (admMap && document.getElementById('admin-map') && currentUser.role === 'admin') {
                renderAdminVehiclesOnMap(data.vehicles || []);
                renderPassengerMarkersOnMap(data.trips || [], admMap, adminMarkers);
            }
        } catch (e) {
            console.warn('Live tracking poll skipped', e);
        }
    };
    
    poll();
    liveTrackingInterval = setInterval(poll, 8000); // 8 second update cycle
}


boot();
initLiveTracking();

// ══════════════════════════════════════════
// CHATBOT LOGIC
// ══════════════════════════════════════════
function toggleChatbot() {
    const window = document.getElementById('chatbot-window');
    if (!window) return;
    const isOpen = window.classList.contains('open');
    if (isOpen) {
        window.classList.remove('open');
    } else {
        window.classList.add('open');
        setTimeout(() => document.getElementById('chatbot-input')?.focus(), 300);
    }
}

function handleChatbotKey(event) {
    if (event.key === 'Enter') {
        sendChatbotMessage();
    }
}

async function sendChatbotMessage() {
    const input = document.getElementById('chatbot-input');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    
    addChatMessage(msg, 'user');
    
    const chatContainer = document.getElementById('chatbot-messages');
    if (!chatContainer) return;
    
    const typingWrapper = document.createElement('div');
    typingWrapper.className = `cb-msg bot`;
    typingWrapper.id = "cb-typing-indicator";
    typingWrapper.innerHTML = `
        <div class="cb-bubble" style="padding: 4px;">
            <div class="cb-typing">
                <div class="cb-dot"></div>
                <div class="cb-dot"></div>
                <div class="cb-dot"></div>
            </div>
        </div>`;
    chatContainer.appendChild(typingWrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const result = await apiRequest('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        
        const ind = document.getElementById("cb-typing-indicator");
        if (ind) ind.remove();
        
        if (result && result.reply) {
            addChatMessage(result.reply, 'bot');
        } else {
            addChatMessage("I'm having trouble thinking right now.", 'bot');
        }
    } catch (e) {
        const ind = document.getElementById("cb-typing-indicator");
        if (ind) ind.remove();
        addChatMessage("Server unavailable. Please try again later.", 'bot');
    }
}

function addChatMessage(text, sender) {
    const chatContainer = document.getElementById('chatbot-messages');
    if (!chatContainer) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = `cb-msg ${sender}`;
    wrapper.innerHTML = `<div class="cb-bubble">${escapeHtml(text)}</div>`;
    
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ══════════════════════════════════════════
// USSD LOGIC
// ══════════════════════════════════════════
let ussdState = 0; // 0: Start, 1: Main Menu, 2: Booking, 3: Fares, 4: Wallet

function appendUSSD(char) {
    const inp = document.getElementById('uinp');
    if (inp) inp.value += char;
}

function clearUSSD() {
    const inp = document.getElementById('uinp');
    if (inp) {
        inp.value = inp.value.slice(0, -1);
    }
}

function resetUSSDScreen() {
    ussdState = 0;
    const scr = document.getElementById('uscr');
    const inp = document.getElementById('uinp');
    if (scr) scr.innerHTML = "A Smart Transport System Uganda<br>Dial *123# to begin";
    if (inp) inp.value = "";
}

function sendUSSD() {
    const inp = document.getElementById('uinp');
    const scr = document.getElementById('uscr');
    if (!inp || !scr) return;

    const val = inp.value.trim();
    if (!val) {
        // If empty and they click OK, just flash it or do nothing
        return;
    }

    inp.value = '';

    if (val === '*123#') {
        ussdState = 1;
        scr.innerHTML = "ASTS Uganda<br>1. Book a Ride<br>2. Check Fares<br>3. Wallet Balance<br>4. About & Contact<br><br>Type choice (1-4) and Send:";
        return;
    }

    if (ussdState === 0) {
        scr.innerHTML = "Invalid Code.<br>A Smart Transport System Uganda<br>Dial *123# to begin";
        return;
    }

    if (ussdState === 1) {
        if (val === '1') {
            ussdState = 2;
            scr.innerHTML = "=== BOOK A RIDE ===<br>1. Standard Taxi<br>2. Boda Boda<br>3. Mini Bus<br>0. Back";
        } else if (val === '2') {
            ussdState = 3;
            scr.innerHTML = "=== FARES ===<br>Base Rate: 500 UGX/km<br>Standard Taxi: Base x 1<br>Boda Boda: Base x 0.7<br>Bus: Fixed Rate<br>0. Back";
        } else if (val === '3') {
            ussdState = 4;
            scr.innerHTML = `=== WALLET ===<br>SmartCard Balance:<br>${currentUser ? formatUGX(balance) : 'Please sign in first'}<br><br>0. Back`;
        } else if (val === '4') {
            ussdState = 1;
            scr.innerHTML = "=== CONTACT ===<br>Help: +256800123456<br>Email: support@sts.ug<br><br>0. Back";
        } else {
            scr.innerHTML = "Invalid choice.<br>1. Book a Ride<br>2. Check Fares<br>3. Wallet Balance<br>4. About & Contact";
        }
        return;
    }

    if (ussdState === 2) {
        if (val === '0') {
            ussdState = 1;
            scr.innerHTML = "ASTS Uganda<br>1. Book a Ride<br>2. Check Fares<br>3. Wallet Balance<br>4. About & Contact<br><br>Type choice (1-4) and Send:";
        } else if (['1','2','3'].includes(val)) {
            scr.innerHTML = "Booking request received.<br>Driver assigned via SMS.<br><br>Thank you for using ASTS!<br>(Session Ended)";
            ussdState = 0;
            setTimeout(resetUSSDScreen, 4000);
        } else {
            scr.innerHTML = "Invalid choice.<br>1. Standard Taxi<br>2. Boda Boda<br>3. Mini Bus<br>0. Back";
        }
        return;
    }

    if (ussdState === 3 || ussdState === 4) {
        if (val === '0') {
            ussdState = 1;
            scr.innerHTML = "ASTS Uganda<br>1. Book a Ride<br>2. Check Fares<br>3. Wallet Balance<br>4. About & Contact<br><br>Type choice (1-4) and Send:";
        } else {
            // Keep same state if invalid input on these pages except 0
            scr.innerHTML = scr.innerHTML.split('<br>0. Back')[0] + "<br>(Invalid) 0. Back";
        }
    }
}
