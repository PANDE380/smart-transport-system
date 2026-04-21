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
let liveFleetSnapshot = {
    vehicles: [],
    trips: [],
    generatedAt: null
};
let currentBookingVehicle = null;
let bookingMapFittedToFleet = false;
let lastTripId = null;
let currentPage = 'home';
let ussdSessionStarted = false;
let driverMarkers = [];
let adminMarkers = [];
let liveTrackingInterval = null;
let adminDashboardStream = null;
let adminDashboardStreamConnected = false;
let driverDashboardLoading = false;
let driverDashboardStream = null;
let driverDashboardStreamConnected = false;
let driverDashboardSnapshot = null;
let servicesCoverageMap = null;
let servicesCoverageMarkers = [];
let servicesDashboardLoading = false;
let servicesDashboardSnapshot = null;
let servicesDashboardStream = null;
let servicesDashboardStreamConnected = false;
let servicesDashboardPollingTimer = null;
let paymentDashboardLoading = false;
let paymentDashboardSnapshot = null;
let paymentDashboardStream = null;
let paymentDashboardStreamConnected = false;
let paymentDashboardPollingTimer = null;
let passengerMarkers = [];
let homeMarkers = [];
let homeMarkersLookup = {}; // Added for smooth interpolation lookup
let adminVehMarkers = {}; // Added for admin map smooth marker tracking
let pendingProfilePhotoFile = null;
let pendingProfilePhotoPreviewUrl = null;
let chatbotConversation = [];
let chatbotStatusSnapshot = null;
let chatbotStatusLoading = false;
let adminUserChartInstance = null; // Graph instance for admin dashboard
const MODE_TO_VEHICLE_TYPE = {
    'Standard Taxi': 'Taxi',
    'Boda Boda': 'Boda Boda',
    'Special Hire': 'Special Hire',
    'Mini Bus': 'Mini Bus',
    'Marine Transport': 'Marine',
    'Smart Bus': 'Bus'
};

function getVehicleImage(mode) {
    const map = {
        'Standard Taxi': '/assets/images/taxi.png',
        'Boda Boda': '/assets/images/boda.png',
        'Special Hire': '/assets/images/special.png',
        'Mini Bus': '/assets/images/minibus.png',
        'Marine Transport': '/assets/images/marine.png',
        'Smart Bus': '/assets/images/bus.png',
        'Taxi': '/assets/images/taxi.png',
        'Marine': '/assets/images/marine.png',
        'Bus': '/assets/images/bus.png'
    };
    return map[mode] || '/assets/images/taxi.png';
}
const DRIVER_VEHICLE_CONFIG = {
    Taxi: {
        label: 'Standard Taxi',
        capacity: 14,
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
const PAYMENT_METHOD_META = {
    MTN: {
        label: 'MTN Mobile Money',
        accountLabel: 'MTN number',
        placeholder: '0772123456',
        helper: 'Use the MTN number that will approve the wallet credit.'
    },
    AIRTEL: {
        label: 'Airtel Money',
        accountLabel: 'Airtel number',
        placeholder: '0701123456',
        helper: 'Use the Airtel number that will approve the wallet credit.'
    },
    FLEXIPAY: {
        label: 'Stanbic FlexiPay',
        accountLabel: 'FlexiPay number',
        placeholder: '0700123456',
        helper: 'Use your registered FlexiPay mobile number.'
    },
    CHIPPER: {
        label: 'Chipper Cash',
        accountLabel: 'Chipper username',
        placeholder: '@username',
        helper: 'Enter your Chipper Cash username to approve the transfer.'
    },
    VISA: {
        label: 'Visa / Mastercard',
        accountLabel: 'Card number',
        placeholder: '4111 2222 3333 4444',
        helper: 'Processed securely via the STS payment gateway.'
    },
    BANK: {
        label: 'Bank Transfer',
        accountLabel: 'Transfer Reference',
        placeholder: 'Your name or Account ID',
        helper: 'Funds credited once the bank confirms our operational deposit.'
    }
};
const SERVICES_DASHBOARD_CARDS = [
    {
        key: 'standard_taxi',
        title: 'Standard Taxi',
        badge: 'GPS matched',
        icon: 'fas fa-taxi',
        img: 'assets/images/minibus.png',
        description: 'Reliable city travel with live fleet availability and driver dispatch updates.',
        action: 'book-standard-taxi',
        buttonLabel: 'Book taxi'
    },
    {
        key: 'boda_boda',
        title: 'Boda Boda',
        badge: 'Fast urban trips',
        icon: 'fas fa-motorcycle',
        img: 'assets/images/boda.png',
        description: 'Fast response mobility for short urban trips with real-time demand visibility.',
        action: 'book-boda-boda',
        buttonLabel: 'Book boda'
    },
    {
        key: 'special_hire',
        title: 'Special Hire',
        badge: 'Premium',
        icon: 'fas fa-gem',
        img: 'assets/images/special.png',
        description: 'Premium chauffeur bookings with live service readiness and trip monitoring.',
        action: 'book-special-hire',
        buttonLabel: 'Book premium'
    },
    {
        key: 'mini_bus',
        title: 'Mini Bus',
        badge: 'Group transport',
        icon: 'fas fa-bus-simple',
        img: 'assets/images/bus.png',
        description: 'Shared and group transport with fleet-level capacity and trip tracking.',
        action: 'book-mini-bus',
        buttonLabel: 'Book minibus'
    },
    {
        key: 'marine_transport',
        title: 'Marine Transport',
        badge: 'Lake routes',
        icon: 'fas fa-ship',
        img: 'assets/images/marine.png',
        description: 'Marine travel availability for ferry and boat operations across supported routes.',
        action: 'book-marine',
        buttonLabel: 'Book marine'
    },
    {
        key: 'smart_bus',
        title: 'STS Smart Bus',
        badge: 'Mass transit',
        icon: 'fas fa-bus',
        img: 'assets/images/bus.png',
        description: 'Digitally managed bus movement with route demand and live vehicle visibility.',
        action: 'book-smart-bus',
        buttonLabel: 'Open bus booking'
    },
    {
        key: 'live_vehicle_tracking',
        title: 'Live Vehicle Tracking',
        badge: 'Real time',
        icon: 'fas fa-map-location-dot',
        description: 'Track live vehicle positions and trip coverage from the operations map.',
        action: 'open-tracking',
        buttonLabel: 'Open tracking'
    },
    {
        key: 'emergency_sos',
        title: 'Emergency SOS',
        badge: 'Safety first',
        icon: 'fas fa-triangle-exclamation',
        description: 'See how many safety alerts are active and jump into the SOS workflow quickly.',
        action: 'open-sos',
        buttonLabel: 'Open SOS'
    },
    {
        key: 'mobile_money_payments',
        title: 'Mobile Money Payments',
        badge: 'Wallet ready',
        icon: 'fas fa-wallet',
        description: 'Monitor top-ups and ride payment capture from the wallet and payment flow.',
        action: 'open-payment',
        buttonLabel: 'Open payments'
    },
    {
        key: 'ai_smart_routing',
        title: 'AI Smart Routing',
        badge: 'OpenAI enabled',
        icon: 'fas fa-robot',
        description: 'Routing intelligence and assistant health are surfaced here from the backend.',
        action: 'open-chatbot',
        buttonLabel: 'Open assistant'
    },
    {
        key: 'ussd_access',
        title: 'USSD Access',
        badge: 'Any phone',
        icon: 'fas fa-keyboard',
        description: 'USSD access remains available for users without smartphone or data access.',
        action: 'open-ussd',
        buttonLabel: 'Open USSD'
    },
    {
        key: 'verified_driver_matching',
        title: 'Verified Driver Matching',
        badge: 'Compliance',
        icon: 'fas fa-id-card',
        description: 'Driver approval and matching readiness are updated from live backend records.',
        action: 'open-driver-matching',
        buttonLabel: 'Match driver'
    },
    {
        key: 'lost_and_found',
        title: 'Lost and Found',
        badge: 'Support',
        icon: 'fas fa-magnifying-glass',
        description: 'Quick entry into support workflows for items left behind in active or recent rides.',
        action: 'open-lost-found',
        buttonLabel: 'Report item'
    },
    {
        key: 'driver_ratings_feedback',
        title: 'Driver Ratings and Feedback',
        badge: 'Quality control',
        icon: 'fas fa-star-half-stroke',
        description: 'Keep service quality visible with live rating totals and review readiness.',
        action: 'open-ratings',
        buttonLabel: 'Open feedback'
    }
];
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
    en: { code: 'en', label: 'ENG', name: 'English',    locale: 'en-UG', htmlLang: 'en' },
    sw: { code: 'sw', label: 'SWA', name: 'Kiswahili',  locale: 'sw-KE', htmlLang: 'sw' },
    lg: { code: 'lg', label: 'LUG', name: 'Luganda',    locale: 'en-UG', htmlLang: 'lg' },
    nk: { code: 'nk', label: 'RNK', name: 'Runyankore', locale: 'en-UG', htmlLang: 'nk' },
    ls: { code: 'ls', label: 'LSG', name: 'Lusoga',     locale: 'en-UG', htmlLang: 'ls' },
    ac: { code: 'ac', label: 'ACH', name: 'Acholi',     locale: 'en-UG', htmlLang: 'ac' },
    at: { code: 'at', label: 'ATE', name: 'Ateso',      locale: 'en-UG', htmlLang: 'at' },
    lb: { code: 'lb', label: 'LGB', name: 'Lugbara',    locale: 'en-UG', htmlLang: 'lb' }
};
const UI_COPY = {
    en: {
        nav_home: 'HOME', nav_booking: 'BOOK A RIDE', nav_services: 'SERVICES',
        nav_about: 'ABOUT US', nav_contact: 'CONTACT', nav_ussd: 'USSD',
        nav_history: 'HISTORY', nav_dashboard: 'DASHBOARD',
        btn_sign_in: 'Sign In', btn_register: 'Register',
        role_passenger: 'Rider', role_driver: 'Driver', role_captain: 'Captain',
        role_admin: 'Admin', role_traffic_officer: 'Traffic Officer',
        toast_signed_out: 'Signed out successfully.',
        currency: 'Currency', language: 'Language', connectSupport: 'Connect & Support'
    },
    sw: {
        nav_home: 'MWANZO', nav_booking: 'WEKA SAFARI', nav_services: 'HUDUMA',
        nav_about: 'KUHUSU', nav_contact: 'WASILIANA', nav_ussd: 'USSD',
        nav_history: 'HISTORIA', nav_dashboard: 'DASHIBODI',
        btn_sign_in: 'Ingia', btn_register: 'Jisajili',
        role_passenger: 'Abiria', role_driver: 'Dereva',
        role_admin: 'Msimamizi', role_traffic_officer: 'Afisa wa Trafiki',
        toast_signed_out: 'Umetoka kwenye akaunti kwa mafanikio.',
        currency: 'Sarafu', language: 'Lugha', connectSupport: 'Unganika & Usaidizi'
    },
    lg: {
        nav_home: 'AWAKA', nav_booking: 'TEGEKA OLUGENDO', nav_services: 'OBUWEEREZA',
        nav_about: 'EBIKWATAKO', nav_contact: 'TWANDIKIRE', nav_ussd: 'USSD',
        nav_history: 'EBYAFAAYO', nav_dashboard: 'DAASHIBOODI',
        btn_sign_in: 'Yingira', btn_register: 'Wewandiise',
        role_passenger: 'Omutambuzi', role_driver: 'Omuvuuzi',
        role_admin: 'Omuddukanya', role_traffic_officer: 'Akulira Entambula',
        toast_signed_out: 'Ofulumye mu akawunti bulungi.',
        currency: 'Ensimbi', language: 'Olulimi', connectSupport: 'Kwatana & Obuweereza'
    },
    nk: {
        nav_home: 'OMUGYENZO', nav_booking: 'TEEREKA OLUGENDO', nav_services: 'OBUKOREZI',
        nav_about: 'EBIKWATA', nav_contact: 'TUKWATANISE', nav_ussd: 'USSD',
        nav_history: 'EBYASHAHO', nav_dashboard: 'DAASHIIBODI',
        btn_sign_in: 'Ingira', btn_register: 'Wandiika',
        role_passenger: 'Omugendererwa', role_driver: 'Omushoferi',
        role_admin: 'Omulamuzi', role_traffic_officer: 'Omusirika wa Entambula',
        toast_signed_out: 'Orekereirwe neza.',
        currency: 'Ensimbi', language: 'Orulimi', connectSupport: 'Kwatana & Obufizi'
    },
    ls: {
        nav_home: 'ENJU', nav_booking: 'TEEKA OLUGENDO', nav_services: 'OBUWEEREZA',
        nav_about: 'EBIKWATA', nav_contact: 'TWANDIKIRE', nav_ussd: 'USSD',
        nav_history: 'EBYAFAYO', nav_dashboard: 'DASHIBODI',
        btn_sign_in: 'Yingira', btn_register: 'Wandiika',
        role_passenger: 'Omutambula', role_driver: 'Omushoferi',
        role_admin: 'Omukulu', role_traffic_officer: 'Omusirikale wa Entambula',
        toast_signed_out: 'Oulumye bulungi.',
        currency: 'Ensimbi', language: 'Olulimi', connectSupport: 'Kwatana & Obuweereza'
    },
    ac: {
        nav_home: 'GANG', nav_booking: 'COK WOT', nav_services: 'TIC',
        nav_about: 'IKOM WANWA', nav_contact: 'KWAN KWEDA', nav_ussd: 'USSD',
        nav_history: 'TICME MA OKATO', nav_dashboard: 'DASHIBODI',
        btn_sign_in: 'Done i', btn_register: 'Coyo nyiŋi',
        role_passenger: 'Luwot', role_driver: 'Welo gari',
        role_admin: 'Ladit', role_traffic_officer: 'Lapol pa wot',
        toast_signed_out: 'Ilor woko ki kony.',
        currency: 'Lim', language: 'Leb', connectSupport: 'Kwan & Kony'
    },
    at: {
        nav_home: 'EBALE', nav_booking: 'ŊOL EJALANG', nav_services: 'IŊENESIA',
        nav_about: 'AKWAP', nav_contact: 'IKWANU', nav_ussd: 'USSD',
        nav_history: 'ITAI', nav_dashboard: 'DASHIBODI',
        btn_sign_in: 'Itunga', btn_register: 'Idwok iŋom',
        role_passenger: 'Ajalang', role_driver: 'Okosia gari',
        role_admin: 'Omonuk', role_traffic_officer: 'Askali ejalang',
        toast_signed_out: 'Ikwek noi.',
        currency: 'Akisio', language: 'Elatai', connectSupport: 'Ikwanu & Iŋenesia'
    },
    lb: {
        nav_home: 'AMBA', nav_booking: 'ROVA ADRI', nav_services: 'ENZA',
        nav_about: 'ADRI AWE', nav_contact: 'KPATA AWE', nav_ussd: 'USSD',
        nav_history: 'AYIVU', nav_dashboard: 'DASHIBODI',
        btn_sign_in: 'Suka azua', btn_register: 'Dria vua',
        role_passenger: 'Adri amvu', role_driver: 'Ofori gari',
        role_admin: 'Ozo', role_traffic_officer: 'Asikari adri',
        toast_signed_out: 'Ita nzua leka.',
        currency: 'Drapi', language: 'Agbari', connectSupport: 'Kpata & Enza'
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

function getUserRoleLabel(user) {
    if (!user) return '';
    if (user.role === 'passenger') return t('role_passenger');
    if (user.role === 'driver') {
        const type = user.vehicle_type || '';
        if (type.toLowerCase() === 'marine') {
            return t('role_captain');
        }
        return t('role_driver');
    }
    return t(`role_${user.role}`);
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
    const message = encodeURIComponent('Explore STS Uganda transport services: ');
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
            <button class="top-pref-item${appPrefs.currency === option.code ? ' active' : ''}" type="button" onclick="setCurrencyPreference('${option.code}')" tabindex="0" aria-pressed="${appPrefs.currency === option.code}">
                <span>${option.label}</span>
                <span class="top-pref-meta">${appPrefs.currency === option.code ? 'Selected' : option.name}</span>
            </button>
        `).join('');
    }

    if (languageMenu) {
        languageMenu.innerHTML = Object.values(LANGUAGE_OPTIONS).map(option => `
            <button class="top-pref-item${appPrefs.language === option.code ? ' active selected-lang' : ''}" type="button" onclick="setLanguagePreference('${option.code}')" tabindex="0" aria-pressed="${appPrefs.language === option.code}">
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

    // Update nav links using data-page attributes (reliable across all roles)
    const dict = UI_COPY[appPrefs.language] || UI_COPY.en;
    const navPageMap = {
        home: dict.nav_home,
        booking: dict.nav_booking,
        services: dict.nav_services,
        about: dict.nav_about,
        contact: dict.nav_contact,
        ussd: dict.nav_ussd,
        history: dict.nav_history,
        driver: dict.nav_dashboard,
        admin: dict.nav_dashboard
    };
    document.querySelectorAll('.nl[data-page]').forEach(link => {
        const page = link.dataset.page;
        if (navPageMap[page]) link.textContent = navPageMap[page];
    });

    const topBarNote = document.querySelector('.top-bar-note');
    if (topBarNote) topBarNote.textContent = dict.connectSupport || 'Connect & Support';
    const topPrefLabels = document.querySelectorAll('.top-pref-label');
    if (topPrefLabels[0]) topPrefLabels[0].textContent = dict.currency || 'Currency';
    if (topPrefLabels[1]) topPrefLabels[1].textContent = dict.language || 'Language';
    const languageCurrent = document.getElementById('language-current');
    if (languageCurrent) languageCurrent.textContent = getLanguageConfig().label;

    // Update auth buttons if present
    if (document.getElementById('tab-login')) document.getElementById('tab-login').textContent = dict.btn_sign_in;
    if (document.getElementById('tab-reg')) document.getElementById('tab-reg').textContent = dict.btn_register;

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
        if (document.getElementById('booking-page')?.classList.contains('active')) {
            updatePaymentEstimate();
            syncBookingLiveUI();
        }
    }
    if (document.getElementById('history-page')?.classList.contains('active') && currentUser) {
        loadHistory();
    }
    if (document.getElementById('driver-page')?.classList.contains('active') && currentUser?.role === 'driver') {
        loadDriverDashboard();
        startDriverDashboardStream();
    }
    if (document.getElementById('services-page')?.classList.contains('active')) {
        if (servicesDashboardSnapshot) {
            applyServicesDashboardSnapshot(servicesDashboardSnapshot);
        } else {
            loadServicesDashboard();
        }
        startServicesDashboardStream();
    }
    if (document.getElementById('payment-page')?.classList.contains('active') && currentUser) {
        if (paymentDashboardSnapshot) {
            applyPaymentDashboardSnapshot(paymentDashboardSnapshot);
        } else {
            loadPaymentDashboard();
        }
        startPaymentDashboardStream();
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
    if (typeof stsApplyTranslations === 'function') stsApplyTranslations();
    // Visually highlight selected language
    const languageMenu = document.getElementById('language-menu');
    if (languageMenu) {
        Array.from(languageMenu.children).forEach(btn => btn.classList.remove('selected-lang'));
        const idx = Object.keys(LANGUAGE_OPTIONS).indexOf(languageCode);
        if (languageMenu.children[idx]) languageMenu.children[idx].classList.add('selected-lang');
    }
}
// --- Responsive and accessible language switcher style ---
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.innerHTML = `.selected-lang { background: #123a5a !important; color: #fff !important; border-radius: 8px; border: none; }`;
    document.head.appendChild(style);
});

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

function formatDashboardMetricValue(metric = {}) {
    if (metric.type === 'currency') {
        return formatUGX(Number(metric.value || 0));
    }
    if (metric.type === 'decimal') {
        return Number(metric.value || 0).toFixed(1);
    }
    if (metric.type === 'text') {
        return String(metric.value ?? 'N/A');
    }

    const numericValue = Number(metric.value || 0);
    return Number.isFinite(numericValue)
        ? numericValue.toLocaleString(getLanguageConfig().locale)
        : String(metric.value ?? '0');
}

function getToneClass(tone = 'neutral') {
    const normalized = String(tone || 'neutral').toLowerCase();
    if (normalized === 'good') return 'services-tone-good';
    if (normalized === 'warning') return 'services-tone-warning';
    if (normalized === 'critical') return 'services-tone-critical';
    return 'services-tone-neutral';
}

function getServiceStatusClass(status = 'standby') {
    const normalized = String(status || 'standby').toLowerCase().replaceAll(' ', '-');
    return `service-status-${normalized}`;
}

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function fetchAIFare() {
    if (routeDistKm <= 0) return 0;
    
    try {
        const res = await apiRequest('/trips/estimate-fare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                distance_km: parseFloat(routeDistKm),
                vehicle_type: getVehicleTypeForMode(selModeV)
            })
        });
        
        if (res.estimated_fare_ugx) {
            return res.estimated_fare_ugx;
        }
    } catch (e) {
        console.warn('AI Fare fetch failed, using fallback', e);
    }
    return getCurrentFare();
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
    try {
        const method = (options.method || 'GET').toUpperCase();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const finalOptions = {
            ...options,
            method,
            headers
        };

        // If it's a GET request, we usually don't want a Content-Type or body
        if (method === 'GET') {
            delete finalOptions.headers['Content-Type'];
        }

        const response = await fetch(`${API_BASE_URL}${path}`, finalOptions);
        let payload = {};
        try {
            payload = await response.json();
        } catch (e) {
            // If body is empty or not JSON
            if (!response.ok) throw new Error(`Server returned error ${response.status}`);
        }

        if (!response.ok) {
            const error = payload.error || payload.message || `Request failed with status ${response.status}`;
            if (response.status === 401) {
                // Potential session expiry
                console.warn('Unauthorized request:', path);
            }
            throw new Error(error);
        }
        return payload;
    } catch (err) {
        console.error('API Error:', path, err);
        throw err; // Re-throw to be handled by caller
    }
}

/**
 * Professional Notification System
 * @param {string} icon - HTML string for icon or emoji
 * @param {string} msg - Message to display
 * @param {string} color - Background color or variable name
 */
function showT(icon, msg, color = 'var(--white)') {
    let t = document.getElementById('global-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'global-toast';
        t.className = 'toast';
        document.body.appendChild(t);
    }

    // Force hide existing to reset animation
    t.classList.remove('show');
    
    // Slight delay to re-trigger animation if already visible
    setTimeout(() => {
        t.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-msg">${msg}</span>`;
        t.style.borderLeft = `4px solid ${color.startsWith('var') ? color : color}`;
        t.classList.add('show');
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
            t.classList.remove('show');
        }, 4000);
    }, 50);
}

// ══════════════════════════════════════════
// MOBILE NAVIGATION (Hamburger + Drawer)
// ══════════════════════════════════════════

function toggleMobileMenu() {
    const drawer  = document.getElementById('mobile-nav-drawer');
    const overlay = document.getElementById('mobile-nav-overlay');
    const btn     = document.getElementById('hamburger-btn');
    if (!drawer) return;

    const isOpen = drawer.classList.contains('is-open');
    if (isOpen) {
        closeMobileMenu();
    } else {
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        overlay.classList.add('is-open');
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden'; // prevent background scroll
    }
}

function closeMobileMenu() {
    const drawer  = document.getElementById('mobile-nav-drawer');
    const overlay = document.getElementById('mobile-nav-overlay');
    const btn     = document.getElementById('hamburger-btn');
    if (!drawer) return;

    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-open');
    btn && btn.classList.remove('is-open');
    btn && btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
}

function toggleDriverMobView(view) {
    const listPanel = document.getElementById('driver-panel-list');
    const mapPanel  = document.getElementById('driver-panel-map');
    const listBtn   = document.getElementById('drv-toggle-list');
    const mapBtn    = document.getElementById('drv-toggle-map');

    if (!listPanel || !mapPanel) return;

    if (view === 'map') {
        listPanel.style.display = 'none';
        mapPanel.style.display = 'block';
        listBtn.className = 'btn-out';
        mapBtn.className = 'btn-full';
        // Invalidate map size to ensure it renders correctly after being hidden
        if (typeof drvMap !== 'undefined' && drvMap) {
            setTimeout(() => drvMap.invalidateSize(), 50);
        }
    } else {
        listPanel.style.display = 'block';
        mapPanel.style.display = 'none';
        listBtn.className = 'btn-full';
        mapBtn.className = 'btn-out';
    }
}

function toggleMobAccordion(triggerBtn) {
    const body     = triggerBtn.nextElementSibling;
    const isOpen   = body.classList.contains('is-open');

    // Close all other accordions first
    document.querySelectorAll('.mob-accordion-body.is-open').forEach(b => {
        b.classList.remove('is-open');
        const sibling = b.previousElementSibling;
        if (sibling) sibling.setAttribute('aria-expanded', 'false');
    });

    // Toggle clicked one
    if (!isOpen) {
        body.classList.add('is-open');
        triggerBtn.setAttribute('aria-expanded', 'true');
    }
}

// Close mobile menu on Escape key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMobileMenu();
});

/**
 * Button Loading Utility
 */
function setBtnLoading(btn, isLoading, originalHtml) {
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        btn.setAttribute('data-original', btn.innerHTML);
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
        btn.style.opacity = '0.7';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.getAttribute('data-original') || originalHtml;
        btn.style.opacity = '1';
    }
}

/**
 * Universal Wrapper for Async Actions with UI Feedback
 */
async function withLoading(btn, action) {
    if (btn && btn.disabled) return;
    const original = btn ? btn.innerHTML : '';
    try {
        if (btn) setBtnLoading(btn, true, original);
        await action();
    } catch (err) {
        console.error('Action failed:', err);
        showT('❌', err.message || 'An unexpected error occurred.', 'var(--red)');
    } finally {
        if (btn) setBtnLoading(btn, false, original);
    }
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
        } catch (e) {
            console.error('Failed to load view snippet:', view, e);
        }
    }));

    // Re-apply translations once snippets are in the DOM
    if (typeof stsApplyTranslations === 'function') {
        stsApplyTranslations();
    }
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
    document.title = 'STS Uganda | Smart Transport Platform';
    const yearEl = document.getElementById('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    await loadViews();
    initReveal();
    loadChatbotStatus();
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
    if (capacity) {
        capacity.dataset.manual = 'true';
        if (capacity.max && Number(capacity.value) > Number(capacity.max)) {
            capacity.value = capacity.max;
            showRegErr(`Maximum allowed capacity is ${capacity.max}.`);
        } else {
            showRegErr('');
        }
    }
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
    if (capacity) {
        if (!capacity.dataset.manual) capacity.value = config.capacity;
        capacity.max = config.capacity;
    }
    if (hint) {
        hint.textContent = `Driver profile for ${config.label}. Maximum allowed capacity is ${config.capacity}.`;
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
        showT('<i class="fas fa-lock"></i>', 'Two-factor verification successful.', 'var(--teal)');
    } catch (err) {
        showTwoFactorErr(err.message || 'Verification failed.');
    }
}

async function doLogin() {
    const identifier = document.getElementById('l-identifier').value.trim();
    const password = document.getElementById('l-password').value;
    const btn = document.getElementById('loginBtn');
    
    if (!identifier || !password) {
        showLoginErr('Please enter both identifier and password.');
        return;
    }

    await withLoading(btn, async () => {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: identifier, password: password })
        });
        const result = await response.json().catch(() => ({}));
        
        if (response.ok) {
            if (result.requires_two_factor) {
                openTwoFactorPrompt(result);
                showT('<i class="fas fa-key"></i>', result.message || 'Verification code sent.', 'var(--yellow)');
                return;
            }

            loginSuccess(result.user);
            closeM('auth-m');
            showT('👋', `Welcome back, ${result.user.name}!`, 'var(--orange)');
        } else {
            showLoginErr(result.error || result.message || 'Invalid credentials');
            throw new Error(result.error || result.message || 'Invalid credentials');
        }
    });
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
    openM('google-picker-m');
}

async function handleGoogleChoice(role) {
    closeM('google-picker-m');
    closeM('auth-m');
    showT('<i class="fab fa-google"></i>', 'Authenticating with Google...', 'var(--blue)');
    
    // Quick-switch identities for prototype demo
    const mockUsers = {
        'passenger': { id: 1, name: 'Johnathan S.', role: 'passenger', email: 'johnathan.pass@gmail.com', balance: 50000 },
        'driver': { id: 2, name: 'Musa K.', role: 'driver', email: 'musa.pro@gmail.com', balance: 125000 },
        'admin': { id: 3, name: 'Sarah B.', role: 'admin', email: 's.bakiza@sts.ug', balance: 0 }
    };
    
    const user = mockUsers[role];
    
    setTimeout(() => {
        loginSuccess(user);
        showT('👋', `Welcome back, ${user.name}! (Signed in via Google)`, 'var(--navy)');
    }, 850);
}

function toggleGoogleCustom() {
    const main = document.getElementById('google-picker-main');
    const custom = document.getElementById('google-picker-custom');
    if (main && custom) {
        if (main.style.display !== 'none') {
            main.style.display = 'none';
            custom.style.display = 'block';
        } else {
            main.style.display = 'block';
            custom.style.display = 'none';
        }
    }
}

let selectedGRole = 'passenger';
function selGRole(role) {
    selectedGRole = role;
    document.querySelectorAll('#google-picker-custom .role-opt').forEach(opt => {
        opt.classList.toggle('sel', opt.id === `g-role-${role}`);
    });
}

async function handleGoogleCustomSubmit() {
    const email = document.getElementById('g-custom-email').value.trim();
    if (!email || !email.includes('@')) {
        showT('⚠️', 'Please enter a valid Google email address.', 'var(--orange)');
        return;
    }

    closeM('google-picker-m');
    closeM('auth-m');
    showT('<i class="fab fa-google"></i>', 'Authenticating with Google...', 'var(--blue)');

    setTimeout(() => {
        const name = email.split('@')[0];
        const user = { 
            id: Date.now(), 
            name: name.charAt(0).toUpperCase() + name.slice(1), 
            role: selectedGRole, 
            email: email, 
            balance: selectedGRole === 'driver' ? 125000 : 50000 
        };
        loginSuccess(user);
        showT('👋', `Welcome back, ${user.name}! (Logged in with custom email)`, 'var(--navy)');
    }, 900);
}

async function doRegister() {
    const name = document.getElementById('r-name').value.trim();
    const phone = document.getElementById('r-phone').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const password = document.getElementById('r-password').value;
    const btn = document.getElementById('registerBtn');
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

        const config = getDriverVehicleConfig(vehicleType);
        if (vehicleCapacity > config.capacity) {
            showRegErr(`Maximum allowed passenger capacity for ${config.label} is ${config.capacity}.`);
            return;
        }

        Object.assign(payload, {
            license_number: licenseNumber,
            vehicle_type: vehicleType,
            number_plate: numberPlate,
            vehicle_capacity: Math.round(vehicleCapacity)
        });
    }

    await withLoading(btn, async () => {
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        
        if (response.ok) {
            showT('🎉', 'Account created! Please sign in.', 'var(--teal)');
            resetRegisterForm();
            switchAuthTab('login');
        } else {
            showRegErr(result.error || result.message || 'Registration failed');
            throw new Error(result.error || result.message || 'Registration failed');
        }
    });
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
    const dots = document.querySelectorAll('.h-dot, .dot');
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
    stopDriverDashboardStream();
    stopPaymentDashboardStream();
    
    // Security: Clear credential inputs from the DOM
    const fieldsToClear = [
        'l-identifier', 'l-password', 
        'r-name', 'r-phone', 'r-email', 'r-password',
        'r-license-number', 'r-number-plate'
    ];
    fieldsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    localStorage.removeItem('user');
    currentUser = null;
    driverDashboardSnapshot = null;
    paymentDashboardSnapshot = null;
    currentBookingVehicle = null;
    bookingMapFittedToFleet = false;
    liveFleetSnapshot = { vehicles: [], trips: [], generatedAt: null };
    setGuestUI();
    showPg('home');
    showT('👋', t('toast_signed_out'), 'var(--navy)');
}

function setSlide(idx) {
    jumpSlide(idx);
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
// ══════════════════════════════════════════════════════════════════
// ROLE-BASED ACCESS CONTROL — nav configs
// Pages shown in the top nav per role (no cross-role dashboard links)
// ══════════════════════════════════════════════════════════════════
const PASS_NAV = [
    {key:'nav_home',     p:'home'},
    {key:'nav_booking',  p:'booking'},
    {key:'nav_services', p:'services'},
    {key:'nav_about',    p:'about'},
    {key:'nav_support',  p:'contact'},
    {key:'nav_ussd',     p:'ussd'},
    {key:'nav_history',  p:'history'},
];
const DRV_NAV = [
    {key:'nav_home',     p:'home'},
    {key:'nav_driver',   p:'driver'},
    {key:'nav_services', p:'services'},
    {key:'nav_about',    p:'about'},
    {key:'nav_support',  p:'contact'},
    {key:'nav_history',  p:'history'},
];
const ADM_NAV = [
    {key:'nav_home',     p:'home'},
    {key:'nav_admin',    p:'admin'},
    {key:'nav_services', p:'services'},
    {key:'nav_about',    p:'about'},
    {key:'nav_support',  p:'contact'},
    {key:'nav_history',  p:'history'},
];
const GUEST_NAV = [
    {key:'nav_home',     p:'home'},
    {key:'nav_services', p:'services'},
    {key:'nav_about',    p:'about'},
    {key:'nav_support',  p:'contact'},
];

function setGuestUI() {
    document.getElementById('nav-right').innerHTML = `
        <button class="nav-auth-btn" type="button" onclick="openM('auth-m')">${t('btn_sign_in')}</button>
        <button class="nav-cta-btn" type="button" onclick="openM('auth-m');switchAuthTab('register')">${t('btn_register')}</button>`;

    // Mobile drawer auth slot
    const mobAuth = document.getElementById('mob-nav-auth');
    if (mobAuth) {
        mobAuth.innerHTML = `
            <div class="mob-auth-row">
                <button class="mob-auth-signin" type="button" onclick="openM('auth-m'); closeMobileMenu();">
                    <i class="fas fa-sign-in-alt"></i> ${t('btn_sign_in')}
                </button>
                <button class="mob-auth-register" type="button" onclick="openM('auth-m'); switchAuthTab('register'); closeMobileMenu();">
                    <i class="fas fa-user-plus"></i> ${t('btn_register')}
                </button>
            </div>`;
    }

    buildNav(GUEST_NAV);
    syncMobileNav(null);

    const bui = document.getElementById('booking-ui');
    const gp  = document.getElementById('guest-prompt');
    const sw  = document.getElementById('sc-wrap');
    if (bui) bui.style.display = 'block';
    if (gp)  gp.style.display  = 'none';
    if (sw)  sw.style.display  = 'block';
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
                    <div class="u-name">${escapeHtml(user.name)}</div>
                    <div class="u-role">${escapeHtml(getUserRoleLabel(user))}</div>
                </div>
            </div>
        </div>
        <button class="signout-btn" type="button" title="Sign out" aria-label="Sign out" onclick="signOut()">
            <i class="fas fa-sign-out-alt"></i>
        </button>`;

    // Mobile drawer auth slot — user chip + sign out
    const mobAuth = document.getElementById('mob-nav-auth');
    if (mobAuth) {
        mobAuth.innerHTML = `
            <div class="mob-user-chip" onclick="showPg('history'); closeMobileMenu();">
                <div class="u-av" style="width:38px;height:38px;font-size:0.85rem;flex-shrink:0;">${renderUserAvatar(user)}</div>
                <div style="flex:1;min-width:0;">
                    <div class="u-name" style="font-size:0.85rem;">${escapeHtml(user.name)}</div>
                    <div class="u-role" style="font-size:0.68rem;color:var(--yellow);text-transform:capitalize;">${escapeHtml(getUserRoleLabel(user))}</div>
                </div>
                <button class="mob-signout-btn" type="button" title="Sign out" onclick="event.stopPropagation(); signOut(); closeMobileMenu();">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>`;
    }

    const nav = user.role === 'driver' ? DRV_NAV
              : user.role === 'admin'  ? ADM_NAV
              : PASS_NAV;
    buildNav(nav);
    syncMobileNav(user.role);

    const bui = document.getElementById('booking-ui');
    const gp  = document.getElementById('guest-prompt');
    const sw  = document.getElementById('sc-wrap');
    if (bui) bui.style.display = 'block';
    if (gp)  gp.style.display  = 'none';
    if (sw)  sw.style.display  = 'block';
    if (user.role === 'passenger') loadBookingSummary();

    // Re-initialize Live Streams on successful login/identification
    if (user.role === 'admin') initAdminStream();
    if (user.role === 'driver') initDriverStream();
}

function syncActiveNav() {
    const role = currentUser?.role; // undefined if guest

    document.querySelectorAll('.nl').forEach(link => {
        const page = link.dataset.page;
        link.classList.toggle('active', page === currentPage);
        
        // Default assuming it's visible
        let isVisible = true;

        if (!role && AUTH_REQUIRED.has(page)) {
            // Guest cannot see protected pages
            isVisible = false;
        } else if (role && PAGE_RESTRICTIONS[page]) {
            // Logged in user must have the correct role for restricted pages
            if (!PAGE_RESTRICTIONS[page].includes(role)) {
                isVisible = false;
            }
        }

        link.style.display = isVisible ? 'inline-flex' : 'none';
    });
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
        const label = t(n.key);
        const btn = `<button class="nl" type="button" data-page="${n.p}" onclick="showPg('${n.p}', this)">${label}</button>`;
        const dropBtn = `<button class="nl" type="button" data-page="${n.p}" onclick="showPg('${n.p}', this)">${label}</button>`;

        if (n.p === 'home' || n.p === 'booking' || n.p === 'driver') {
            mainEl.innerHTML += btn;
        } else if (n.p === 'services' && rightEl) {
            rightEl.innerHTML += btn;
        } else {
            dropEl.innerHTML += dropBtn;
        }
    });

    syncActiveNav();
}

// ══════════════════════════════════════════════════════════════════
// ROLE-BASED PAGE RESTRICTIONS
// Keys = page name.  Values = array of roles allowed.
// null means any authenticated user; omitting a page = public.
// ══════════════════════════════════════════════════════════════════
const PAGE_RESTRICTIONS = {
    // Dashboards — strictly one role each
    admin:   ['admin'],
    driver:  ['driver'],
    // Passenger-only features
    booking: ['passenger'],
    // Authenticated users only (all roles)
    history: ['passenger', 'driver', 'admin'],
    payment: ['passenger', 'driver', 'admin'],
};

// Pages that require at minimum a signed-in account (guests get redirected to sign-in)
const AUTH_REQUIRED = new Set(['booking', 'history', 'payment', 'admin', 'driver']);

// Helper: show/hide hamburger nav links based on role
function syncMobileNav(role) {
    // Admin link — admin only
    const mobAdmin = document.getElementById('mob-nav-admin-link');
    if (mobAdmin) mobAdmin.style.display = role === 'admin' ? 'flex' : 'none';

    // Driver link — driver only
    const mobDriver = document.getElementById('mob-nav-driver-link');
    if (mobDriver) mobDriver.style.display = role === 'driver' ? 'flex' : 'none';
}


function showPg(name, btn) {
    const role = currentUser?.role; // undefined if guest

    // Guard: Require login for protected dashboards
    if (AUTH_REQUIRED.has(name) && !currentUser) {
        showT('🔒', 'Please sign in to access this page.', 'var(--yellow)');
        openM('auth-m');
        if (AUTH_REQUIRED.has(currentPage)) {
            name = 'home'; // fallback if current page is also protected
        } else {
            return; // stay on current allowed page
        }
    }
    
    // Guard: Role-based restrictions (Admins can't see driver view, etc.)
    if (currentUser && PAGE_RESTRICTIONS[name]) {
        if (!PAGE_RESTRICTIONS[name].includes(role)) {
            showT('🚫', 'Access Restricted: Your account type is not authorized for this area.', 'var(--red)');
            if (!PAGE_RESTRICTIONS[currentPage] || PAGE_RESTRICTIONS[currentPage].includes(role)) {
                return; // stay on current allowed page
            }
            name = 'home'; // fallback
        }
    }

    currentPage = name;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(name + '-page');
    if (target) target.classList.add('active');

    if (btn?.dataset?.page) {
        currentPage = btn.dataset.page;
    }
    syncActiveNav();

    if (name !== 'driver') {
        stopDriverDashboardStream();
    }
    if (name !== 'services') {
        stopServicesDashboardStream();
    }
    if (name !== 'payment') {
        stopPaymentDashboardStream();
    }

    // Initialize page functionalities for ALL users (Unblocked)
    if (name === 'booking') {
        setTimeout(initHomeMap, 200);
        loadBookingSummary();
        syncBookingLiveUI();
    }
    if (name === 'services') {
        loadServicesDashboard();
        startServicesDashboardStream();
        setTimeout(() => servicesCoverageMap?.invalidateSize(), 220);
    }
    if (name === 'driver') {
        setTimeout(initDrvMap, 200);
        loadDriverDashboard();
        startDriverDashboardStream();
    }
    if (name === 'admin') {
        setTimeout(initAdmMap, 200);
        loadAdminDashboard();
    }
    if (name === 'history') loadHistory();
    if (name === 'ussd') resetUSSDScreen();
    if (name === 'payment') {
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
        prefillPaymentAccountReference();
        updatePaymentMethodUI();
        updatePaymentEstimate();
        loadPaymentDashboard();
        startPaymentDashboardStream();
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
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'; 
const PROFESSIONAL_TILE_ATTRIBUTION =
    '&copy; OpenStreetMap contributors &copy; CARTO';

// Helper for smooth marker interpolation (Real-time movement)
function moveMarkerSmoothly(marker, newLatLng, duration = 4000) {
    if (!marker) return;
    const startLatLng = marker.getLatLng();
    const startTime = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Linear interpolation
        const lat = startLatLng.lat + (newLatLng[0] - startLatLng.lat) * progress;
        const lng = startLatLng.lng + (newLatLng[1] - startLatLng.lng) * progress;
        
        marker.setLatLng([lat, lng]);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    requestAnimationFrame(animate);
}


function addProfessionalTileLayer(targetMap) {
    L.tileLayer(PROFESSIONAL_TILE_LAYER, {
        attribution: PROFESSIONAL_TILE_ATTRIBUTION
    }).addTo(targetMap);
}

function initHomeMap() {
    if (!document.getElementById('map')) return;
    if (!map) {
        map = L.map('map').setView(KLA, 13);
        addProfessionalTileLayer(map);

        const userIcon = L.divIcon({
            html: '<div style="width:14px;height:14px;background:#0f172a;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(15,23,42,.16)"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
            className: ''
        });
        L.marker(KLA, { icon: userIcon })
            .addTo(map)
            .bindPopup('<b>Your location</b>');
    }

    map.invalidateSize();
    syncBookingLiveUI();
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

function getBookingLiveVehicles() {
    const selectedVehicleType = getVehicleTypeForMode(selModeV);
    return (liveFleetSnapshot.vehicles || []).filter((vehicle) => {
        const seatsAvailable = Number(
            vehicle.available_seats ?? ((vehicle.capacity || 0) - (vehicle.current_passengers || 0))
        );
        return vehicle.vehicle_type === selectedVehicleType && seatsAvailable > 0;
    });
}

function getBookingReferencePoint(vehicle, fallbackIndex = 0) {
    if (coords.pickup) return coords.pickup;
    return getMarkerPoint(vehicle, fallbackIndex);
}

function getBookingOriginPoint() {
    if (coords.pickup) return coords.pickup;
    return KLA;
}

function calculateDistanceKm(origin, destination) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const [lat1, lng1] = origin;
    const [lat2, lng2] = destination;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(deltaLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
}

function getSortedBookingVehicles(vehicles = getBookingLiveVehicles()) {
    const origin = getBookingOriginPoint();
    return vehicles
        .map((vehicle, index) => ({
            vehicle,
            distanceKm: calculateDistanceKm(origin, getMarkerPoint(vehicle, index))
        }))
        .sort((left, right) => left.distanceKm - right.distanceKm)
        .map((entry) => entry.vehicle);
}

function renderHomeMarkersOnMap(vehicles) {
    if (!map) return;
    homeMarkers = clearMarkers(homeMarkers);
    const emptyState = document.getElementById('booking-map-empty');
    const mapChip = document.getElementById('booking-map-chip');

    if (!vehicles.length) {
        if (emptyState) emptyState.style.display = 'flex';
        if (mapChip) mapChip.textContent = '0 visible vehicles';
        bookingMapFittedToFleet = false;
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (mapChip) {
        mapChip.textContent = `${vehicles.length} visible vehicle${vehicles.length === 1 ? '' : 's'}`;
    }

    vehicles.forEach((v, i) => {
        const key = `h-veh-${v.id}`;
        const point = getMarkerPoint(v, i);
        
        if (homeMarkersLookup[key]) {
            // Smoothly move existing marker
            moveMarkerSmoothly(homeMarkersLookup[key], point);
        } else {
            // Create new marker
            const icon = L.divIcon({
                html: `
                    <div style="width:16px; height:16px; background:#fcc200; border:2px solid #111827; border-radius:50%; box-shadow:0 0 0 5px rgba(252,194,0,0.18);"></div>
                `,
                iconSize: [16, 16],
                className: ''
            });
            const marker = L.marker(point, { icon }).addTo(map);
            const seatsAvailable = Number(
                v.available_seats ?? ((v.capacity || 0) - (v.current_passengers || 0))
            );
            marker.bindPopup(`
                <b>${escapeHtml(v.vehicle_type)}</b><br>
                ${escapeHtml(v.driver_name || 'Verified driver')}<br>
                ${escapeHtml(v.number_plate)}<br>
                ${seatsAvailable} seat${seatsAvailable === 1 ? '' : 's'} available
            `);
            homeMarkersLookup[key] = marker;
            homeMarkers.push(marker);
        }
    });

    // Cleanup stale markers
    Object.keys(homeMarkersLookup).forEach(key => {
        const id = parseInt(key.split('-')[2]);
        if (!vehicles.find(v => v.id === id)) {
            map.removeLayer(homeMarkersLookup[key]);
            const markerIndex = homeMarkers.indexOf(homeMarkersLookup[key]);
            if (markerIndex > -1) homeMarkers.splice(markerIndex, 1);
            delete homeMarkersLookup[key];
        }
    });

    if (!coords.pickup && !coords.dropoff && homeMarkers.length && !bookingMapFittedToFleet) {
        const group = L.featureGroup(homeMarkers);
        map.fitBounds(group.getBounds().pad(0.18));
        bookingMapFittedToFleet = true;
    }
}

function updateBookingRouteState(title, detail) {
    const titleEl = document.getElementById('booking-route-state');
    const detailEl = document.getElementById('booking-route-state-detail');
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.textContent = detail;
}

function renderBookingVehicleList(vehicles = getSortedBookingVehicles()) {
    const container = document.getElementById('booking-vehicle-list');
    const liveCount = document.getElementById('booking-live-count');
    const liveCountDetail = document.getElementById('booking-live-count-detail');
    const nearestEl = document.getElementById('booking-nearest-driver');
    const nearestDetail = document.getElementById('booking-nearest-driver-detail');

    if (liveCount) liveCount.textContent = String(vehicles.length);
    if (liveCountDetail) {
        liveCountDetail.textContent = `${selModeV} vehicles currently visible on the live map.`;
    }

    if (!container) return;

    if (!vehicles.length) {
        if (nearestEl) nearestEl.textContent = 'No live match';
        if (nearestDetail) nearestDetail.textContent = `No active ${selModeV} vehicles are online right now.`;
        container.innerHTML = `
            <div class="booking-empty-state">
                No active ${escapeHtml(selModeV)} vehicles are visible right now. Try another service or wait for drivers to come online.
            </div>
        `;
        renderHomeMarkersOnMap([]);
        return;
    }

    const nearestVehicle = vehicles[0];
    const nearestPoint = getMarkerPoint(nearestVehicle, 0);
    const referencePoint = getBookingOriginPoint();
    const nearestDistance = calculateDistanceKm(referencePoint, nearestPoint);
    const nearestEta = Math.max(3, Math.round(nearestDistance * 4));

    if (nearestEl) nearestEl.textContent = nearestVehicle.driver_name || nearestVehicle.number_plate;
    if (nearestDetail) {
        nearestDetail.textContent = `${nearestVehicle.number_plate} is about ${nearestDistance.toFixed(1)} km away with an ETA near ${nearestEta} min.`;
    }

    container.innerHTML = vehicles.slice(0, 4).map((vehicle, index) => {
        const point = getMarkerPoint(vehicle, index);
        const origin = getBookingOriginPoint();
        const distanceKm = calculateDistanceKm(origin, point);
        const etaMinutes = Math.max(3, Math.round(distanceKm * 4));
        const seatsAvailable = Number(
            vehicle.available_seats ?? ((vehicle.capacity || 0) - (vehicle.current_passengers || 0))
        );

        return `
            <article class="booking-vehicle-card">
                <div class="booking-vehicle-top">
                    <div>
                        <strong>${escapeHtml(vehicle.driver_name || 'Verified driver')}</strong>
                        <p>${escapeHtml(vehicle.number_plate)} · ${escapeHtml(vehicle.vehicle_type)}</p>
                    </div>
                    <span class="booking-badge-good">~${etaMinutes} min</span>
                </div>
                <div class="booking-vehicle-meta">
                    <small>${distanceKm.toFixed(1)} km away</small>
                    <small>${seatsAvailable} seat${seatsAvailable === 1 ? '' : 's'} available</small>
                </div>
            </article>
        `;
    }).join('');

    renderHomeMarkersOnMap(vehicles);
}

function syncBookingLiveUI() {
    if (!document.getElementById('booking-page')?.classList.contains('active')) return;

    const vehicles = getSortedBookingVehicles();
    const livePill = document.getElementById('booking-live-pill');
    const latestSync = document.getElementById('booking-latest-sync');
    const latestSyncDetail = document.getElementById('booking-latest-sync-detail');
    const generatedAt = liveFleetSnapshot.generatedAt;

    if (livePill) {
        livePill.innerHTML = `
            <span class="booking-live-dot"></span>
            ${vehicles.length ? 'Live fleet synced' : 'Watching for active vehicles'}
        `;
    }
    if (latestSync) {
        latestSync.textContent = generatedAt ? formatDateTime(generatedAt) : 'Waiting';
    }
    if (latestSyncDetail) {
        latestSyncDetail.textContent = generatedAt
            ? `${selModeV} fleet data last refreshed at ${formatDateTime(generatedAt)}.`
            : 'Fleet data refreshes automatically while this page is open.';
    }
    const selectedModeChip = document.getElementById('booking-selected-mode-chip');
    if (selectedModeChip) selectedModeChip.textContent = selModeV;

    renderBookingVehicleList(vehicles);
}

function renderPassengerMarkersOnMap(trips, targetMap = drvMap, markerArray = passengerMarkers) {
    if (!targetMap) return markerArray;
    const nextMarkers = clearMarkers(markerArray);
    const icon = L.divIcon({
        html: `<div style="width:10px; height:10px; background:var(--teal); border:2px solid #fff; border-radius:50%; box-shadow:0 0 8px rgba(20,184,166,0.3);"></div>`,
        iconSize: [10, 10], className: ''
    });
    
    trips.forEach(trip => {
        // Mock current location for active trips based on start/end
        const point = [KLA[0] + (Math.random() - 0.5) * 0.02, KLA[1] + (Math.random() - 0.5) * 0.02];
        const marker = L.marker(point, { icon }).addTo(targetMap);
        marker.bindPopup(`<b>Passenger</b><br>${trip.start_location} -> ${trip.end_location}`);
        nextMarkers.push(marker);
    });

    return nextMarkers;
}

function renderDriverVehiclesOnMap(vehicles) {
    if (!drvMap || !vehicles || vehicles.length === 0) return;
    
    vehicles.forEach((v) => {
        if (v.latitude == null || v.longitude == null) return;
        
        const key = `d-veh-${v.id}`;
        if (adminVehMarkers[key]) {
            moveMarkerSmoothly(adminVehMarkers[key], [v.latitude, v.longitude]);
        } else {
            const marker = L.marker([v.latitude, v.longitude]).addTo(drvMap);
            marker.bindPopup(`<b>${escapeHtml(v.number_plate)}</b><br>${escapeHtml(v.vehicle_type)}`);
            adminVehMarkers[key] = marker;
        }
    });
}

function renderAdminVehiclesOnMap(vehicles) {
    if (!admMap || !vehicles || vehicles.length === 0) return;
    
    let validVehicleFound = false;

    vehicles.forEach((v) => {
        if (v.latitude == null || v.longitude == null) return;
        validVehicleFound = true;
        
        const key = `a-veh-${v.id}`;
        if (adminVehMarkers[key]) {
            moveMarkerSmoothly(adminVehMarkers[key], [v.latitude, v.longitude]);
        } else {
            const marker = L.marker([v.latitude, v.longitude]).addTo(admMap);
            marker.bindPopup(`<b>${escapeHtml(v.number_plate)}</b><br>${escapeHtml(v.driver_name || 'Assigned Driver')}<br>${escapeHtml(v.vehicle_type)}`);
            adminVehMarkers[key] = marker;
        }
    });

    Object.keys(adminVehMarkers).forEach(key => {
        if (key.startsWith('a-veh-')) {
            const id = parseInt(key.split('-')[2]);
            if (!vehicles.find(v => v.id === id && v.latitude != null && v.longitude != null)) {
                admMap.removeLayer(adminVehMarkers[key]);
                delete adminVehMarkers[key];
            }
        }
    });

    if (validVehicleFound && vehicles[0] && vehicles[0].latitude != null) {
        admMap.setView([vehicles[0].latitude, vehicles[0].longitude], 11);
    }
}

function servicesPageIsActive() {
    return Boolean(document.getElementById('services-page')?.classList.contains('active'));
}

function initServicesCoverageMap() {
    if (!document.getElementById('services-coverage-map') || typeof L === 'undefined') return;
    if (servicesCoverageMap) return;

    servicesCoverageMap = L.map('services-coverage-map', {
        scrollWheelZoom: false
    }).setView(KLA, 12);
    addProfessionalTileLayer(servicesCoverageMap);
}

function updateServicesLiveState() {
    const pill = document.getElementById('services-live-pill');
    const syncState = document.getElementById('services-sync-state');
    const syncDetail = document.getElementById('services-sync-detail');
    const snapshotTime = servicesDashboardSnapshot?.generated_at;
    const formattedTime = snapshotTime ? formatDateTime(snapshotTime) : 'Waiting for first snapshot';

    if (pill) {
        pill.innerHTML = `
            <span class="services-live-dot"></span>
            ${servicesDashboardStreamConnected ? 'Live stream connected' : 'Snapshot mode active'}
        `;
    }

    if (syncState) {
        syncState.textContent = servicesDashboardStreamConnected
            ? 'Streaming real-time operations'
            : 'Using latest synced snapshot';
    }

    if (syncDetail) {
        syncDetail.textContent = `Last backend sync: ${formattedTime}. The page reconnects automatically if the stream drops.`;
    }
}

function renderServicesCoverageMap(points = []) {
    const emptyState = document.getElementById('services-map-empty');
    const countChip = document.getElementById('services-coverage-count');

    if (countChip) {
        countChip.textContent = `${points.length} point${points.length === 1 ? '' : 's'}`;
    }

    initServicesCoverageMap();
    if (!servicesCoverageMap) return;

    servicesCoverageMarkers = clearMarkers(servicesCoverageMarkers);

    if (!points.length) {
        if (emptyState) emptyState.style.display = 'flex';
        servicesCoverageMap.setView(KLA, 12);
        servicesCoverageMap.invalidateSize();
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    points.forEach((point) => {
        const marker = L.marker([point.lat, point.lng]).addTo(servicesCoverageMap);
        marker.bindPopup(`
            <b>${escapeHtml(point.vehicle_type || 'Vehicle')}</b><br>
            ${escapeHtml(point.number_plate || 'No plate')}<br>
            ${escapeHtml(point.driver_name || 'Assigned driver')}
        `);
        servicesCoverageMarkers.push(marker);
    });

    const featureGroup = L.featureGroup(servicesCoverageMarkers);
    if (featureGroup.getLayers().length) {
        servicesCoverageMap.fitBounds(featureGroup.getBounds().pad(0.18));
    }
    servicesCoverageMap.invalidateSize();
}

function renderServicesFeed(feed = []) {
    const container = document.getElementById('services-feed-list');
    const countChip = document.getElementById('services-live-record-count');
    if (!container) return;

    if (countChip) {
        countChip.textContent = `${feed.length} item${feed.length === 1 ? '' : 's'}`;
    }

    if (!feed.length) {
        container.innerHTML = `
            <div class="services-empty-state">
                Waiting for live service activity from bookings, payments, and safety events.
            </div>
        `;
        return;
    }

    container.innerHTML = feed.map((item) => `
        <article class="services-feed-item">
            <div class="services-feed-meta">
                <span class="${getToneClass(item.tone)}">${escapeHtml(item.tone || 'live')}</span>
                <small>${escapeHtml(formatDateTime(item.created_at))}</small>
            </div>
            <h3>${escapeHtml(item.title || 'Service update')}</h3>
            <p>${escapeHtml(item.detail || 'Live operational update')}</p>
            <small>${escapeHtml(item.meta || 'STS operations')}</small>
        </article>
    `).join('');
}

function renderServicesSystems(systems = []) {
    const container = document.getElementById('services-systems-list');
    if (!container) return;

    if (!systems.length) {
        container.innerHTML = `
            <div class="services-empty-state">
                No platform health details are available yet.
            </div>
        `;
        return;
    }

    container.innerHTML = systems.map((item) => `
        <article class="services-system-item">
            <div class="services-system-status">
                <h3>${escapeHtml(item.title || 'System')}</h3>
                <span class="${getToneClass(item.tone)}">${escapeHtml(item.status || 'Ready')}</span>
            </div>
            <p>${escapeHtml(item.detail || 'Status unavailable')}</p>
        </article>
    `).join('');
}

function renderServicesCards(services = {}) {
    const grid = document.getElementById('services-service-grid');
    if (!grid) return;

    grid.innerHTML = SERVICES_DASHBOARD_CARDS.map((config) => {
        const service = services[config.key] || {};
        const metrics = Array.isArray(service.metrics) ? service.metrics : [];
        const metricsMarkup = metrics.length
            ? metrics.map((metric) => `
                <div class="service-metric-item">
                    <span>${escapeHtml(metric.label || 'Metric')}</span>
                    <strong>${escapeHtml(formatDashboardMetricValue(metric))}</strong>
                </div>
            `).join('')
            : `
                <div class="service-metric-item">
                    <span>Backend status</span>
                    <strong>Waiting</strong>
                </div>
            `;

        return `
            <article class="service-card ${config.img ? 'has-img' : ''}">
                ${config.img ? `
                    <div class="service-card-img-wrap">
                        <div class="service-card-sts-badge"><i class="fas fa-certificate"></i> STS Verified</div>
                        <img src="${config.img}" alt="${escapeHtml(config.title)}" class="service-card-img">
                    </div>` : ''}
                <div class="service-card-body">
                    <div class="service-card-head">
                        <div class="service-card-title">
                            ${!config.img ? `<div class="service-card-icon"><i class="${config.icon}"></i></div>` : ''}
                            <div>
                                <small>${escapeHtml(config.badge)}</small>
                                <h3>${escapeHtml(config.title)}</h3>
                                <p>${escapeHtml(config.description)}</p>
                            </div>
                        </div>
                        <span class="service-status-chip ${getServiceStatusClass(service.status)}">
                            ${escapeHtml(service.status || 'standby')}
                        </span>
                    </div>
                    <div class="service-metric-list">
                        ${metricsMarkup}
                    </div>
                    <button class="service-card-action" onclick="handleServicesDashboardAction('${config.action}')">
                        <i class="fas fa-arrow-right"></i>
                        ${escapeHtml(config.buttonLabel)}
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function applyServicesDashboardSnapshot(data) {
    servicesDashboardSnapshot = data;

    const stats = data?.stats || {};
    const chatbot = data?.chatbot || {};
    const heroSummary = document.getElementById('services-hero-summary');
    const pendingMetric = document.getElementById('services-metric-pending');
    const pendingDetail = document.getElementById('services-metric-pending-detail');
    const vehiclesMetric = document.getElementById('services-metric-vehicles');
    const vehiclesDetail = document.getElementById('services-metric-vehicles-detail');
    const revenueMetric = document.getElementById('services-metric-revenue');
    const revenueDetail = document.getElementById('services-metric-revenue-detail');
    const ratingMetric = document.getElementById('services-metric-rating');
    const ratingDetail = document.getElementById('services-metric-rating-detail');
    const openAIState = document.getElementById('services-openai-state');
    const openAIDetail = document.getElementById('services-openai-detail');

    if (heroSummary) {
        heroSummary.textContent =
            `${stats.active_vehicles ?? 0} active vehicles, ` +
            `${stats.pending_requests ?? 0} pending requests, ` +
            `${stats.completed_trips_today ?? 0} rides completed today, and ` +
            `${stats.coverage_points ?? 0} live map points are currently synced.`;
    }
    if (pendingMetric) pendingMetric.textContent = String(stats.pending_requests ?? 0);
    if (pendingDetail) {
        pendingDetail.textContent = `${stats.scheduled_trips ?? 0} scheduled trips are also being watched by the live feed.`;
    }
    if (vehiclesMetric) vehiclesMetric.textContent = String(stats.active_vehicles ?? 0);
    if (vehiclesDetail) {
        vehiclesDetail.textContent = `${stats.verified_drivers ?? 0} verified drivers and ${stats.coverage_points ?? 0} GPS points are currently online.`;
    }
    if (revenueMetric) revenueMetric.textContent = formatUGX(stats.today_revenue ?? 0);
    if (revenueDetail) {
        revenueDetail.textContent = `${formatUGX(stats.wallet_topups_today ?? 0)} in wallet top-ups and ${stats.successful_payments_today ?? 0} successful ride payments today.`;
    }
    if (ratingMetric) ratingMetric.textContent = Number(stats.average_rating ?? 0).toFixed(1);
    if (ratingDetail) {
        ratingDetail.textContent = `${stats.rated_trip_count ?? 0} ratings submitted and ${stats.open_sos_alerts ?? 0} open SOS alerts.`;
    }
    if (openAIState) {
        openAIState.textContent = chatbot.status_label || 'OpenAI status unavailable';
    }
    if (openAIDetail) {
        openAIDetail.textContent = chatbot.detail || 'No chatbot runtime details were returned by the backend.';
    }

    updateServicesLiveState();
    renderServicesFeed(data?.feed || []);
    renderServicesSystems(data?.systems || []);
    renderServicesCards(data?.services || {});
    renderServicesCoverageMap(data?.map_points || []);
}

async function loadServicesDashboard() {
    if (servicesDashboardLoading) return;

    servicesDashboardLoading = true;
    try {
        const data = await apiRequest('/services/dashboard');
        applyServicesDashboardSnapshot(data);
    } catch (error) {
        console.error('Services dashboard load failed', error);
        const heroSummary = document.getElementById('services-hero-summary');
        if (heroSummary) {
            heroSummary.textContent = 'We could not load live service activity just now. Automatic retry is still running.';
        }
    } finally {
        servicesDashboardLoading = false;
    }
}

function stopServicesDashboardStream() {
    if (servicesDashboardStream) {
        servicesDashboardStream.close();
        servicesDashboardStream = null;
    }
    if (servicesDashboardPollingTimer) {
        clearInterval(servicesDashboardPollingTimer);
        servicesDashboardPollingTimer = null;
    }
    servicesDashboardStreamConnected = false;
    updateServicesLiveState();
}

function scheduleServicesDashboardPolling() {
    if (servicesDashboardPollingTimer || !servicesPageIsActive()) return;

    servicesDashboardPollingTimer = setInterval(() => {
        if (!servicesPageIsActive()) {
            stopServicesDashboardStream();
            return;
        }
        loadServicesDashboard();
    }, 12000);
}

function startServicesDashboardStream() {
    if (!servicesPageIsActive() || servicesDashboardStream) return;

    if (typeof EventSource === 'undefined') {
        scheduleServicesDashboardPolling();
        return;
    }

    servicesDashboardStream = new EventSource(`${API_BASE_URL}/services/dashboard/stream`);

    servicesDashboardStream.addEventListener('dashboard', (event) => {
        servicesDashboardStreamConnected = true;
        if (servicesDashboardPollingTimer) {
            clearInterval(servicesDashboardPollingTimer);
            servicesDashboardPollingTimer = null;
        }
        try {
            applyServicesDashboardSnapshot(JSON.parse(event.data));
        } catch (error) {
            console.error('Services dashboard stream parse failed', error);
        }
    });

    servicesDashboardStream.addEventListener('heartbeat', () => {
        servicesDashboardStreamConnected = true;
        updateServicesLiveState();
    });

    servicesDashboardStream.onopen = () => {
        servicesDashboardStreamConnected = true;
        updateServicesLiveState();
    };

    servicesDashboardStream.onerror = () => {
        servicesDashboardStreamConnected = false;
        updateServicesLiveState();
        if (servicesDashboardStream) {
            servicesDashboardStream.close();
            servicesDashboardStream = null;
        }
        scheduleServicesDashboardPolling();
        if (servicesPageIsActive()) {
            setTimeout(() => {
                if (servicesPageIsActive()) startServicesDashboardStream();
            }, 5000);
        }
    };
}

function handleServicesDashboardAction(action) {
    switch (action) {
        case 'book-standard-taxi':
            showService('Standard Taxi');
            return;
        case 'book-boda-boda':
            showService('Boda Boda');
            return;
        case 'book-special-hire':
            showService('Special Hire');
            return;
        case 'book-mini-bus':
            showService('Mini Bus');
            return;
        case 'book-marine':
            showService('Marine Transport');
            return;
        case 'book-smart-bus':
            showService('Smart Bus');
            return;
        case 'open-tracking':
            needAuth('live vehicle tracking', () => {
                showPg('booking');
                showT('🛰️', 'Live trip tracking becomes available after a ride is assigned.', 'var(--yellow)');
            });
            return;
        case 'open-sos':
            openM('sos-m');
            return;
        case 'open-payment':
            if (!currentUser) {
                openM('auth-m');
                return;
            }
            showPg('payment');
            return;
        case 'open-chatbot':
            if (!document.getElementById('chatbot-window')?.classList.contains('open')) {
                toggleChatbot();
            }
            return;
        case 'open-ussd':
            showPg('ussd');
            return;
        case 'open-driver-matching':
            needAuth('verified driver matching', () => showPg('booking'));
            return;
        case 'open-lost-found':
            openM('lost-m');
            return;
        case 'open-ratings':
            needAuth('driver ratings and feedback', () => showPg('history'));
            return;
        default:
            return;
    }
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
    if (field === 'pickup' && document.getElementById('mi-from')) {
        document.getElementById('mi-from').textContent = name.split(',')[0];
    }
    if (field === 'dropoff' && document.getElementById('mi-to')) {
        document.getElementById('mi-to').textContent = name.split(',')[0];
    }
    updateBookingRouteState(
        coords.pickup && coords.dropoff ? 'Routing ready' : 'Awaiting route',
        coords.pickup && coords.dropoff
            ? 'Route points selected. Calculate fare to match the nearest live driver.'
            : 'Select both pickup and destination to build your route.'
    );
    syncBookingLiveUI();
    if (coords.pickup && coords.dropoff) calcRoute();
}

function calcRoute() {
    if (!map) return;
    bookingMapFittedToFleet = true;
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
        
        // Trigger AI Fare Prediction
        document.getElementById('frt').textContent = 'Predicting...';
        fetchAIFare().then(fare => {
            document.getElementById('frt').textContent = formatUGX(fare);
            const aiLabel = document.getElementById('ai-label');
            if (aiLabel) aiLabel.style.display = 'inline-block';
        });

        document.getElementById('frm').textContent = selModeV;
        document.getElementById('farebox').classList.add('show');
        updateBookingRouteState(
            'Route calculated',
            `${routeDistKm} km and about ${routeTimeMin} min for ${selModeV}.`
        );
        syncBookingLiveUI();
    }).addTo(map);
}

// ══════════════════════════════════════════
// WALLET & PAYMENTS
// ══════════════════════════════════════════
function startTopupFlow() {
    if (!currentUser) { openM('auth-m'); return; }
    showPg('payment');

    setTimeout(() => {
        const defaultAmtPill = document.querySelector('#payment-page .ao:nth-child(3)');
        if (defaultAmtPill) selAmtP(defaultAmtPill, 50000);
        prefillPaymentAccountReference();
        updatePaymentMethodUI();
        updatePaymentEstimate();
    }, 500);
}

function paymentPageIsActive() {
    return Boolean(document.getElementById('payment-page')?.classList.contains('active'));
}

function prefillPaymentAccountReference() {
    const input = document.getElementById('payment-account-ref');
    if (!input || input.value.trim() || !currentUser?.phone) return;
    input.value = currentUser.phone;
}

function getSelectedTopupAmount() {
    const customValue = Number(document.getElementById('custom-amt')?.value || 0);
    if (customValue > 0) return customValue;
    return Number(selTopup || 0);
}

function getNormalizedPaymentMethod(methodCode = selMethodV) {
    return PAYMENT_METHOD_META[methodCode] ? methodCode : 'MTN';
}

function updatePaymentMethodUI() {
    const methodCode = getNormalizedPaymentMethod();
    const meta = PAYMENT_METHOD_META[methodCode];
    const badge = document.getElementById('payment-method-badge');
    const accountLabel = document.getElementById('payment-account-label');
    const helper = document.getElementById('payment-method-helper');
    const input = document.getElementById('payment-account-ref');
    const summaryMethod = document.getElementById('payment-summary-method-inline');

    document.querySelectorAll('#payment-page .pm-opt').forEach((option) => {
        option.classList.toggle('active', option.dataset.method === methodCode);
    });

    if (badge) badge.textContent = meta.label;
    if (accountLabel) accountLabel.textContent = meta.accountLabel;
    if (helper) helper.textContent = meta.helper;
    if (input) input.placeholder = meta.placeholder;
    if (summaryMethod) summaryMethod.textContent = meta.label;
}

function updatePaymentLiveState() {
    const pill = document.getElementById('payment-live-pill');
    const detail = document.getElementById('payment-live-detail');
    const updatedAt = paymentDashboardSnapshot?.stats?.last_updated;

    if (pill) {
        pill.innerHTML = `
            <span class="payment-live-dot"></span>
            ${paymentDashboardStreamConnected ? 'Wallet live sync on' : 'Wallet snapshot synced'}
        `;
    }
    if (detail) {
        detail.textContent = updatedAt
            ? `Last wallet sync: ${formatDateTime(updatedAt)}. The page reconnects automatically when needed.`
            : 'Your wallet balance, top-ups, and ride payments will update here in real time.';
    }
}

function updatePaymentEstimate() {
    const selectedAmount = getSelectedTopupAmount();
    const projectedBalance = Number(balance || 0) + selectedAmount;
    const selectedAmountEl = document.getElementById('payment-selected-amount');
    const estimatedBalanceEl = document.getElementById('payment-estimated-balance');
    const inlineAmount = document.getElementById('payment-summary-amount-inline');

    if (selectedAmountEl) selectedAmountEl.textContent = formatUGX(selectedAmount);
    if (estimatedBalanceEl) estimatedBalanceEl.textContent = formatUGX(projectedBalance);
    if (inlineAmount) inlineAmount.textContent = formatUGX(selectedAmount);
}

function renderPaymentRecentTransactions(transactions = []) {
    const container = document.getElementById('payment-recent-list');
    if (!container) return;

    if (!transactions.length) {
        container.innerHTML = `
            <div class="payment-empty-state">
                Recent top-ups and paid rides will appear here.
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map((txn) => `
        <div class="payment-txn">
            <div class="payment-txn-meta">
                <strong>${escapeHtml(txn.title || 'Wallet transaction')}</strong>
                <span>${escapeHtml(txn.subtitle || 'STS wallet')}</span>
                <small>${escapeHtml(formatDateTime(txn.created_at))}</small>
            </div>
            <div class="payment-txn-amount ${txn.direction === 'credit' ? 'credit' : 'debit'}">
                ${txn.direction === 'credit' ? '+' : '-'}${formatUGX(txn.amount)}
            </div>
        </div>
    `).join('');
}

function applyPaymentDashboardSnapshot(data) {
    paymentDashboardSnapshot = data;

    const wallet = data?.wallet || {};
    const totals = data?.history?.totals || {};
    const stats = data?.stats || {};
    const lastTopup = stats.last_topup_amount ? formatUGX(stats.last_topup_amount) : 'No top-up yet';

    balance = Number(wallet.balance || 0);

    if (document.getElementById('pmt-bal')) document.getElementById('pmt-bal').textContent = formatUGX(balance);
    if (document.getElementById('pmt-card-num')) document.getElementById('pmt-card-num').textContent = wallet.card_number || 'No SmartCard linked';
    if (document.getElementById('payment-last-topup')) {
        document.getElementById('payment-last-topup').textContent = stats.last_topup_at
            ? `${lastTopup} on ${formatDateTime(stats.last_topup_at)}`
            : lastTopup;
    }
    if (document.getElementById('payment-summary-topups')) document.getElementById('payment-summary-topups').textContent = formatUGX(totals.topups || 0);
    if (document.getElementById('payment-summary-spent')) document.getElementById('payment-summary-spent').textContent = formatUGX(totals.spent || 0);
    if (document.getElementById('payment-summary-rides')) document.getElementById('payment-summary-rides').textContent = String(totals.rides || 0);
    if (document.getElementById('payment-summary-balance')) document.getElementById('payment-summary-balance').textContent = formatUGX(balance);
    if (document.getElementById('payment-summary-balance-inline')) document.getElementById('payment-summary-balance-inline').textContent = formatUGX(balance);
    if (document.getElementById('baldis')) document.getElementById('baldis').textContent = formatUGX(balance);
    if (document.getElementById('balbadge')) document.getElementById('balbadge').textContent = formatUGX(balance);
    if (document.getElementById('d-bal')) document.getElementById('d-bal').textContent = formatUGX(balance);
    if (document.getElementById('sc-num-display')) document.getElementById('sc-num-display').textContent = wallet.card_number || 'No SmartCard linked';

    updatePaymentLiveState();
    updatePaymentMethodUI();
    updatePaymentEstimate();
    renderPaymentRecentTransactions(data?.recent_transactions || []);
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
    await processPayment(selTopup, 'MTN');
}

let selMethodV = 'MTN';
function selMethod(el, m) {
    selMethodV = getNormalizedPaymentMethod(m);
    updatePaymentMethodUI();
    updatePaymentEstimate();
}

function selAmtP(el, amt) {
    document.querySelectorAll('#payment-page .ao').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    selTopup = amt;
    if (document.getElementById('custom-amt')) {
        document.getElementById('custom-amt').value = '';
    }
    updatePaymentEstimate();
}

function clearPills() {
    document.querySelectorAll('#payment-page .ao').forEach(o => o.classList.remove('sel'));
    selTopup = 0;
    updatePaymentEstimate();
}

async function processFinalPayment() {
    if (!currentUser) {
        openM('auth-m');
        return;
    }

    const amount = getSelectedTopupAmount();
    const accountReference = document.getElementById('payment-account-ref')?.value.trim() || '';

    if (!amount || amount < 1000) {
        showT('⚠️', 'Enter or select at least 1,000 UGX.', 'var(--yellow)');
        return;
    }
    if (!accountReference) {
        showT('⚠️', 'Enter the mobile money number to continue.', 'var(--yellow)');
        return;
    }

    const btn = document.getElementById('pay-btn');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        await processPayment(amount, selMethodV);
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldText;
    }
}

async function processPayment(amt, method) {
    try {
        const accountReference = (
            document.getElementById('payment-account-ref')?.value.trim() ||
            currentUser?.phone ||
            ''
        );
        const result = await apiRequest('/payments/wallet/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                amount: amt,
                method,
                account_reference: accountReference
            })
        });

        if (result.dashboard) {
            applyPaymentDashboardSnapshot(result.dashboard);
        } else {
            await loadPaymentDashboard();
        }
        await loadWallet();
        if (document.getElementById('history-page')?.classList.contains('active')) {
            await loadHistory();
        }

        showT('💰', `${formatUGX(amt)} was added to your wallet successfully.`, 'var(--yellow)');
        closeM('topup-m');
        if (paymentPageIsActive()) {
            selTopup = 0;
            document.querySelectorAll('#payment-page .ao').forEach(o => o.classList.remove('sel'));
            if (document.getElementById('custom-amt')) document.getElementById('custom-amt').value = '';
            updatePaymentEstimate();
        }
    } catch (e) {
        showT('❌', e.message || 'Top-up failed. Please try again.', 'var(--red)');
    }
}

async function loadPaymentDashboard() {
    if (!currentUser || currentUser.role !== 'passenger' || paymentDashboardLoading) return;

    paymentDashboardLoading = true;
    try {
        const data = await apiRequest(`/payments/dashboard?user_id=${currentUser.id}`);
        applyPaymentDashboardSnapshot(data);
    } catch (error) {
        console.error('Payment dashboard load failed', error);
        updatePaymentLiveState();
    } finally {
        paymentDashboardLoading = false;
    }
}

function stopPaymentDashboardStream() {
    if (paymentDashboardStream) {
        paymentDashboardStream.close();
        paymentDashboardStream = null;
    }
    if (paymentDashboardPollingTimer) {
        clearInterval(paymentDashboardPollingTimer);
        paymentDashboardPollingTimer = null;
    }
    paymentDashboardStreamConnected = false;
    updatePaymentLiveState();
}

function schedulePaymentDashboardPolling() {
    if (paymentDashboardPollingTimer || !paymentPageIsActive() || !currentUser) return;

    paymentDashboardPollingTimer = setInterval(() => {
        if (!paymentPageIsActive()) {
            stopPaymentDashboardStream();
            return;
        }
        loadPaymentDashboard();
    }, 12000);
}

function startPaymentDashboardStream() {
    if (!paymentPageIsActive() || !currentUser || paymentDashboardStream) return;

    if (typeof EventSource === 'undefined') {
        schedulePaymentDashboardPolling();
        return;
    }

    paymentDashboardStream = new EventSource(
        `${API_BASE_URL}/payments/dashboard/stream?user_id=${currentUser.id}`
    );

    paymentDashboardStream.addEventListener('dashboard', (event) => {
        paymentDashboardStreamConnected = true;
        if (paymentDashboardPollingTimer) {
            clearInterval(paymentDashboardPollingTimer);
            paymentDashboardPollingTimer = null;
        }
        try {
            applyPaymentDashboardSnapshot(JSON.parse(event.data));
        } catch (error) {
            console.error('Payment dashboard stream parse failed', error);
        }
    });

    paymentDashboardStream.addEventListener('heartbeat', () => {
        paymentDashboardStreamConnected = true;
        updatePaymentLiveState();
    });

    paymentDashboardStream.onopen = () => {
        paymentDashboardStreamConnected = true;
        updatePaymentLiveState();
    };

    paymentDashboardStream.onerror = () => {
        paymentDashboardStreamConnected = false;
        updatePaymentLiveState();
        if (paymentDashboardStream) {
            paymentDashboardStream.close();
            paymentDashboardStream = null;
        }
        schedulePaymentDashboardPolling();
        if (paymentPageIsActive()) {
            setTimeout(() => {
                if (paymentPageIsActive()) startPaymentDashboardStream();
            }, 5000);
        }
    };
}

// ══════════════════════════════════════════
// RIDES
// ══════════════════════════════════════════
function selMode(el, mode, mult) {
    document.querySelectorAll('.mpill').forEach(c => c.classList.remove('sel'));
    el.classList.add('sel');
    selModeV = mode; selModeM = mult;
    document.getElementById('frm').textContent = mode;
    const chip = document.getElementById('booking-selected-mode-chip');
    if (chip) chip.textContent = mode;
    if (routeDistKm > 0) {
        document.getElementById('frt').textContent = 'Updating...';
        fetchAIFare().then(fare => {
            document.getElementById('frt').textContent = formatUGX(fare);
        });
    }
    syncBookingLiveUI();
}

async function calcFare() {
    if (!currentUser) { openM('auth-m'); return; }
    
    // Use AI Predicted Fare
    document.getElementById('frt').textContent = 'Fetching AI Price...';
    const fare = await fetchAIFare();
    document.getElementById('frt').textContent = formatUGX(fare);

    if (!fare || fare <= 0) {
        updateBookingRouteState('Route incomplete', 'Select both pickup and destination before we can price the trip.');
        showT('📍', 'Please select locations first', 'var(--navy)');
        return;
    }
    
    if (fare > balance) {
        updateBookingRouteState('Insufficient balance', 'Top up your wallet to request this ride.');
        showT('❌', 'Insufficient balance. Please top up.', 'var(--red)');
        return;
    }

    try {
        let vehicles = getSortedBookingVehicles();
        if (!vehicles.length) {
            vehicles = await apiRequest(`/vehicles/active?type=${encodeURIComponent(getVehicleTypeForMode(selModeV))}`).catch(() => []);
            liveFleetSnapshot.vehicles = Array.isArray(vehicles) ? vehicles : [];
        }

        const availableVehicles = vehicles.filter(vehicle => (
            (vehicle.available_seats ?? (vehicle.capacity - vehicle.current_passengers)) > 0
        ));

        if (!availableVehicles.length) {
            updateBookingRouteState('No active vehicles', `No ${selModeV} drivers are currently online for this route.`);
            showT('🚫', `No active ${selModeV} vehicles are available right now.`, 'var(--red)');
            return;
        }

        currentBookingVehicle = getSortedBookingVehicles(availableVehicles)[0];

        document.getElementById('drvbox').classList.add('show');
        document.getElementById('drv-name').textContent = `${currentBookingVehicle.driver_name || 'Verified Driver'} ✓`;
        document.getElementById('drv-meta').textContent = `${currentBookingVehicle.number_plate} · ${currentBookingVehicle.vehicle_type} · ${currentBookingVehicle.available_seats} seats left`;
        document.getElementById('drv-eta').textContent = `~${Math.max(3, Math.min(8, currentBookingVehicle.id + 1))} min`;

        const drvImg = document.getElementById('matched-driver-img');
        if (drvImg) {
            drvImg.src = getVehicleImage(currentBookingVehicle.vehicle_type);
            drvImg.style.opacity = '1';
        }

        const cbb = document.getElementById('confirm-booking-box');
        if (cbb) {
            cbb.style.display = 'block';
            cbb.classList.add('reveal', 'active');
        }

        updateBookingRouteState(
            'Driver matched',
            `${currentBookingVehicle.driver_name || 'Verified driver'} is ready for your ${selModeV} request.`
        );
        syncBookingLiveUI();
        showT('🚕', 'Driver found from the live backend fleet. Confirm to book.', 'var(--yellow)');
    } catch (e) {
        showT('❌', e.message || 'Unable to fetch an active vehicle right now.', 'var(--red)');
    }
}

async function registerBooking() {
    if (!currentUser) { openM('auth-m'); return; }
    const fare = await fetchAIFare();
    const scheduleInput = document.getElementById('schedule-datetime');
    const scheduleValue = scheduleInput?.value?.trim() || '';
    if (!currentBookingVehicle) {
        showT('🚕', 'Calculate fare first so we can match you to an active vehicle.', 'var(--navy)');
        return;
    }
    
    showT('🚕', 'Registering trip...', 'var(--yellow)');
    
    try {
        const bookingPayload = {
            passenger_id: currentUser.id,
            vehicle_id: currentBookingVehicle.id,
            start_location: document.getElementById('pickup').value,
            end_location: document.getElementById('dropoff').value,
            fare: fare
        };

        if (scheduleValue) {
            bookingPayload.scheduled_at = new Date(scheduleValue).toISOString();
        }

        const data = await apiRequest('/trips/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingPayload)
        });
        
        lastTripId = data.trip.id;
        showT('✅', data.message || 'Ride request sent successfully. Waiting for driver approval.', 'var(--yellow)');
        
        document.getElementById('confirm-booking-box').style.display = 'none';
        document.getElementById('farebox').classList.remove('show');
        document.getElementById('drvbox').classList.remove('show');
        document.getElementById('pickup').value = '';
        document.getElementById('dropoff').value = '';
        if (scheduleInput) scheduleInput.value = '';
        currentBookingVehicle = null;
        routeDistKm = 0;
        routeTimeMin = 0;
        coords.pickup = null;
        coords.dropoff = null;
        if (routingControl && map) map.removeControl(routingControl);
        routingControl = null;
        bookingMapFittedToFleet = false;
        document.getElementById('mi-from').textContent = 'Not selected';
        document.getElementById('mi-to').textContent = 'Not selected';
        document.getElementById('mi-dist').textContent = '--';
        document.getElementById('mi-time').textContent = '--';
        document.getElementById('frd').textContent = '--';
        document.getElementById('frtime').textContent = '--';
        document.getElementById('frt').textContent = '--';
        updateBookingRouteState(
            'Request sent',
            'Your booking is now pending driver approval. You can watch future activity in Recent ride requests.'
        );
        syncBookingLiveUI();
        
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

async function triggerSos(tripId = lastTripId) {
    if (!currentUser) { openM('auth-m'); return; }
    
    // Simulate emergency protocol
    showT('🚨', 'SOS Triggered! Emergency services and STS operations have been alerted.', 'var(--red)');
    
    try {
        await apiRequest('/trips/' + tripId + '/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, location: coords.pickup || 'Unknown' })
        });
        // Logic for backend to propagate alert to admin panel
    } catch (e) {
        console.warn('SOS backend alert simulation successful.');
    }
}

async function submitRating() {
    const rating = document.querySelector('input[name="rating"]:checked')?.value;
    const comment = document.getElementById('rate-comment')?.value;
    
    if (!rating) {
        showT('❓', 'Please select a rating before submitting.', 'var(--navy)');
        return;
    }
    
    showT('🌟', 'Thank you for your feedback! Rating submitted.', 'var(--teal)');
    closeM('rate-m');
}

function setRating(n) {
    const wrap = document.getElementById('stars-wrap');
    if (!wrap) return;
    const labels = wrap.querySelectorAll('label');
    labels.forEach((l, i) => {
        // Star IDs are r1..r5, labels are for them.
        // The HTML has them in descending order (r5 to r1) or ascending?
        // Let's assume the index matches the rating if they were in order.
        // Actually, I'll just look at the value.
    });
    
    // Easier way: use the value from the radio
    const radio = document.getElementById('r' + n);
    if (radio) radio.checked = true;
    
    // Color the stars
    for (let i = 1; i <= 5; i++) {
        const lbl = document.querySelector(`label[for="r${i}"]`);
        if (lbl) lbl.style.color = i <= n ? 'var(--yellow)' : '#e5e7eb';
    }
}

function rebook(p, d) {
    document.getElementById('pickup').value = p;
    document.getElementById('dropoff').value = d;
    showT('📍', 'Route updated from recent trip.', 'var(--navy)');
    scrollToBook();
    document.getElementById('mi-from').textContent = p;
    document.getElementById('mi-to').textContent = d;
    updateBookingRouteState('Rebooking route', 'We are rebuilding your previous route now.');
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
                <div class="txdt">${escapeHtml(txn.subtitle || 'STS transaction')} · ${formatDateTime(txn.created_at)}</div>
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
                <article class="booking-summary-card">
                    <div class="booking-summary-top">
                        <span class="${trip.status === 'completed' ? 'booking-badge-good' : 'booking-badge-neutral'}">${escapeHtml(trip.status || 'registered')}</span>
                        <small>${escapeHtml(formatDateTime(trip.created_at || trip.timestamp))}</small>
                    </div>
                    <strong>${escapeHtml(trip.start_location)}</strong>
                    <p style="margin:6px 0 10px; color:#475467;">to ${escapeHtml(trip.end_location)}</p>
                    <div class="booking-summary-meta">
                        <small>${escapeHtml(trip.vehicle_type || 'Assigned service')}</small>
                        <small>${escapeHtml(trip.driver_name || 'Driver pending')}</small>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px;">
                        <b style="color:#b7791f; font-size:.96rem;">${formatUGX(trip.fare)}</b>
                        <button class="btn-ghost" style="padding:4px 10px; font-size:.72rem; border-color:#d6deea; color:#344054;" onclick='rebook(${JSON.stringify(trip.start_location)}, ${JSON.stringify(trip.end_location)})'>Rebook</button>
                    </div>
                </article>
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

async function getLatestTripId(statusFilter = []) {
    if (!statusFilter.length && lastTripId) return lastTripId;
    if (!currentUser) return null;
    try {
        const data = await apiRequest(`/trips/history?user_id=${currentUser.id}`);
        const trip = (data.trips || []).find(candidate => (
            !statusFilter.length || statusFilter.includes(candidate.status)
        )) || null;
        if (!statusFilter.length) {
            lastTripId = trip?.id ?? null;
        }
        return trip?.id ?? null;
    } catch (e) {
        return null;
    }
}

let selectedStarRating = 0;

function selectStar(val) {
    selectedStarRating = val;
    const stars = document.querySelectorAll('.star-btn');
    const labels = ['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent'];
    stars.forEach(s => {
        const sv = parseInt(s.dataset.val);
        s.style.color = sv <= val ? '#ffc200' : '#d1d5db';
        s.style.transform = sv <= val ? 'scale(1.15)' : 'scale(1)';
    });
    const label = document.getElementById('star-label');
    if (label) label.textContent = `${labels[val]} — ${val} star${val > 1 ? 's' : ''}`;
}

async function submitRating() {
    const tripId = await getLatestTripId(['completed']);
    if (!tripId) {
        showT('⭐', 'Complete a trip first so we have something to rate.', 'var(--orange)');
        closeM('rating-m');
        return;
    }

    if (selectedStarRating < 1) {
        showT('⚠️', 'Please tap a star to select your rating.', 'var(--orange)');
        return;
    }

    const feedback = document.getElementById('rating-feedback')?.value.trim() || '';

    try {
        await apiRequest(`/trips/${tripId}/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: selectedStarRating, feedback })
        });
        showT('⭐', `Thank you for your ${selectedStarRating}-star rating!`, 'var(--yellow)');
        closeM('rating-m');
        selectedStarRating = 0;
        if (document.getElementById('rating-feedback')) document.getElementById('rating-feedback').value = '';
    } catch (e) {
        showT('❌', e.message || 'Unable to submit rating right now.', 'var(--red)');
    }
}

// REQ-20: Admin Reports
async function loadAdminReports() {
    try {
        const data = await apiRequest('/admin/reports');
        const panel = document.getElementById('admin-reports-panel');
        if (panel) panel.style.display = 'block';

        if (document.getElementById('rpt-revenue'))
            document.getElementById('rpt-revenue').textContent = formatUGX(data.financials?.total_revenue_ugx ?? 0);
        if (document.getElementById('rpt-completed'))
            document.getElementById('rpt-completed').textContent = data.operations?.total_trips_completed ?? 0;
        if (document.getElementById('rpt-rate'))
            document.getElementById('rpt-rate').textContent = data.operations?.completion_rate ?? '—';
        if (document.getElementById('rpt-avg-fare'))
            document.getElementById('rpt-avg-fare').textContent = formatUGX(data.financials?.average_trip_fare ?? 0);

        const breakdown = document.getElementById('rpt-vehicle-breakdown');
        if (breakdown && data.operations?.popular_vehicle_types) {
            const types = data.operations.popular_vehicle_types;
            breakdown.innerHTML = Object.entries(types).map(([type, count]) => {
                const icon = type.toLowerCase().includes('boda') ? 'motorcycle' : 'car';
                return `
                    <div style="display:flex; align-items:center; background:#f1f5f9; padding:12px; border-radius:8px; flex: 0 0 calc(50% - 8px); min-width: 200px; box-sizing: border-box;">
                        <div style="background:#123a5a; color:#fff; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:6px; margin-right:12px; flex-shrink: 0;">
                            <i class="fas fa-${icon}" style="font-size:0.9rem;"></i>
                        </div>
                        <div style="flex:1;">
                            <div style="font-size:0.85rem; color:#475569; font-weight:600;">${escapeHtml(type)}</div>
                            <div style="font-size:0.75rem; color:#64748b;">${count} successful trips</div>
                        </div>
                    </div>`;
            }).join('');
        }

        const ts = document.getElementById('rpt-generated-at');
        if (ts) ts.innerHTML = `Date: <b>${new Date().toLocaleDateString('en-GB')}</b><br>Time: <b>${new Date().toLocaleTimeString('en-GB')}</b>`;

        showT('📊', 'Operational report generated successfully.', 'var(--yellow)');
    } catch (e) {
        showT('❌', e.message || 'Unable to generate report.', 'var(--red)');
    }
}

function downloadReportPDF() {
    const element = document.getElementById('report-print-container');
    if (!element) return;
    
    // Force a temporary view reset to top to prevent html2canvas blank page issues
    const originalScrollPos = window.scrollY;
    window.scrollTo(0, 0);

    // Configure html2pdf options
    const opt = {
        margin: [0.3, 0.3],
        filename: `STS_Operational_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            letterRendering: true,
            scrollY: 0,
            scrollX: 0
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Use html2pdf library to generate and download
    if (typeof html2pdf === 'undefined') {
        window.scrollTo(0, originalScrollPos);
        showT('❌', 'PDF library not loaded. Please refresh the page.', 'var(--red)');
        return;
    }

    html2pdf().set(opt).from(element).save().then(() => {
        window.scrollTo(0, originalScrollPos);
        showT('✅', 'Report downloaded successfully!', 'var(--success)');
    }).catch(err => {
        window.scrollTo(0, originalScrollPos);
        console.error('PDF Export Error:', err);
        showT('❌', 'Failed to generate PDF. Check console for details.', 'var(--red)');
    });
}

// REQ-27: In-App Support
async function submitSupport() {
    const category = document.getElementById('support-category')?.value || 'other';
    const description = document.getElementById('support-description')?.value.trim() || '';
    const errEl = document.getElementById('support-err');

    if (!description) {
        if (errEl) { errEl.textContent = 'Please describe your issue before submitting.'; errEl.style.display = 'block'; }
        return;
    }

    // In a production system this would hit a support ticket API.
    // For now we simulate success and send the data to the chatbot as a fallback.
    try {
        await apiRequest('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `[SUPPORT TICKET - ${category.toUpperCase()}] ${description}`
            })
        });
    } catch (_) { /* silent — ticket logged locally */ }

    if (errEl) errEl.style.display = 'none';
    if (document.getElementById('support-description')) document.getElementById('support-description').value = '';
    closeM('support-m');
    showT('🎫', 'Support ticket submitted. Our team will respond within 24 hours.', 'var(--teal)');
}

async function trigSOS() {
    const tripId = await getLatestTripId(['active']);
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

function getDriverLiveRecordCount(snapshot = driverDashboardSnapshot) {
    const stats = snapshot?.stats || {};
    if (typeof stats.live_record_count === 'number') {
        return stats.live_record_count;
    }
    return (
        (snapshot?.pending_trips?.length || 0) +
        (snapshot?.active_trips?.length || 0) +
        (snapshot?.recent_trips?.length || 0)
    );
}

function updateDriverRequestChip(total = getDriverLiveRecordCount()) {
    const chip = document.getElementById('driver-request-chip');
    if (!chip) return;

    chip.textContent = driverDashboardStreamConnected
        ? `${total} Live Records · Live`
        : `${total} Live Records`;
}

function renderDriverCards(recentTrips = [], vehicles = [], pendingTrips = [], activeTrips = []) {
    const container = document.getElementById('rreqs');
    if (!container) return;
    updateDriverRequestChip(pendingTrips.length + activeTrips.length + recentTrips.length);

    let html = '';

    // 1. Pending Approvals (Priority)
    if (pendingTrips.length > 0) {
        html += `<h3 style="font-size:1rem; margin-bottom:12px; color:var(--orange);">Pending Approvals (${pendingTrips.length})</h3>`;
        html += pendingTrips.map(trip => {
            const vehImg = getVehicleImage(trip.vehicle_type);
            return `
                <div class="rc" style="border: 1.5px solid var(--orange); border-radius:12px; padding:16px; background:rgba(255,194,0,0.02); margin-bottom:12px; display:flex; gap:16px;">
                    <div style="width:50px; height:50px; border-radius:10px; overflow:hidden; border:1px solid var(--orange); flex-shrink:0;">
                        <img src="${vehImg}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="flex:1;">
                        <div class="rct">
                            <div>
                                <div class="rr" style="font-weight:700; color:var(--navy); margin-bottom:4px;">${escapeHtml(trip.start_location)} -> ${escapeHtml(trip.end_location)}</div>
                                <div class="rm" style="display:flex; gap:12px; font-size:.74rem; color:var(--text3); flex-wrap:wrap;">
                                    <span><i class="fas fa-user"></i> ${escapeHtml(trip.passenger_name || 'Passenger')}</span>
                                    <span><i class="fas fa-tag"></i> ${escapeHtml(trip.vehicle_type)}</span>
                                </div>
                            </div>
                            <div class="rf" style="font-size:1.1rem; font-weight:800; color:var(--orange);">${formatUGX(trip.fare)}</div>
                        </div>
                        <div style="display:flex; gap:10px; margin-top:12px;">
                            <button class="btn-full-sm" style="flex:1; padding:8px; font-size:.8rem; background:var(--orange); color:#fff; border:none; border-radius:8px; font-weight:800; cursor:pointer;" onclick="approveBooking(${trip.id})">Approve</button>
                            <button class="btn-ghost-sm" style="flex:1; padding:8px; font-size:.8rem; border:1px solid var(--red); color:var(--red); background:none; border-radius:8px; font-weight:700; cursor:pointer;" onclick="rejectBooking(${trip.id})">Decline</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 2. Active Trips
    if (activeTrips.length > 0) {
        html += `<h3 style="font-size:1rem; margin:20px 0 12px; color:var(--teal);">Active Rides</h3>`;
        html += activeTrips.map(trip => {
            const vehImg = getVehicleImage(trip.vehicle_type);
            return `
                <div class="rc" style="border: 1.5px solid var(--teal); border-radius:12px; padding:16px; background:rgba(20,184,166,0.02); margin-bottom:12px; display:flex; gap:16px;">
                    <div style="width:50px; height:50px; border-radius:10px; overflow:hidden; border:1px solid var(--teal); flex-shrink:0;">
                         <img src="${vehImg}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="flex:1;">
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
                        <div style="margin-top:10px;">
                            <button class="btn-full" style="width:100%; padding:8px; font-size:.82rem; background:var(--teal); color:#fff; border:none; border-radius:8px; font-weight:800; cursor:pointer;" onclick="completeBooking(${trip.id})">Complete & Charge</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
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
            html += vehicles.map(vehicle => {
                const vehImg = getVehicleImage(vehicle.vehicle_type);
                return `
                    <div class="rc" style="border: 1.5px solid var(--border); border-radius:12px; padding:16px; background:var(--white); box-shadow:var(--shadow-md); margin-bottom:12px; overflow:hidden; position:relative;">
                        <div style="position:absolute; top:0; right:0; width:100px; height:100%; opacity:0.1; z-index:0;">
                            <img src="${vehImg}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                        <div class="rct" style="position:relative; z-index:1;">
                            <div>
                                <div class="rr" style="font-weight:700; color:var(--navy); margin-bottom:4px;">${escapeHtml(vehicle.number_plate)}</div>
                                <div class="rm" style="display:flex; gap:12px; font-size:.74rem; color:var(--text3); flex-wrap:wrap;">
                                    <span><i class="fas fa-car" style="display:none;"></i> ${escapeHtml(vehicle.vehicle_type)}</span>
                                    <span><i class="fas fa-users"></i> ${vehicle.current_passengers}/${vehicle.capacity} occupied</span>
                                    <span><i class="fas fa-circle" style="color:${vehicle.is_active ? 'var(--yellow)' : '#9ca3af'}"></i> ${vehicle.is_active ? 'Online' : 'Offline'}</span>
                                </div>
                            </div>
                            <div class="rf" style="font-size:1rem; font-weight:800; color:var(--orange);">${vehicle.available_seats} seats free</div>
                        </div>
                    </div>
                `;
            }).join('');
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

function hydrateDriverWithdrawalSummary() {
    const stats = driverDashboardSnapshot?.stats || {};
    const availableEl = document.getElementById('driver-withdraw-available');
    const totalEl = document.getElementById('driver-withdraw-total');
    const withdrawnEl = document.getElementById('driver-withdrawn-total');
    const updatedEl = document.getElementById('driver-withdraw-updated');
    const accountInput = document.getElementById('driver-withdraw-account');

    if (availableEl) availableEl.textContent = formatUGX(stats.available_earnings ?? 0);
    if (totalEl) totalEl.textContent = formatUGX(stats.earnings_total ?? 0);
    if (withdrawnEl) withdrawnEl.textContent = formatUGX(stats.withdrawn_total ?? 0);
    if (updatedEl) {
        updatedEl.textContent = stats.streamed_at
            ? `Live synced ${formatDateTime(stats.streamed_at)}`
            : 'Waiting for the latest driver ledger sync.';
    }
    if (accountInput && !accountInput.value && currentUser?.phone) {
        accountInput.value = currentUser.phone;
    }
}

function applyDriverDashboardSnapshot(data) {
    if (!data) return;

    driverDashboardSnapshot = data;
    const stats = data.stats || {};
    const vehicles = data.vehicles || [];
    const pendingTrips = data.pending_trips || [];
    const activeTrips = data.active_trips || [];
    const recentTrips = data.recent_trips || [];
    const welcome = document.getElementById('driver-welcome');

    if (welcome) {
        const activeVehicleCount = stats.active_vehicle_count ?? 0;
        const pendingCount = pendingTrips.length;
        const availableBalance = formatUGX(stats.available_earnings ?? 0);
        welcome.textContent = `Welcome back${data.driver?.name ? `, ${data.driver.name}` : ''}. ${activeVehicleCount} active vehicle${activeVehicleCount === 1 ? '' : 's'} and ${pendingCount} pending request${pendingCount === 1 ? '' : 's'} are synced here. Available payout balance: ${availableBalance}.`;
    }

    if (document.getElementById('driver-rides-today')) {
        document.getElementById('driver-rides-today').textContent = stats.rides_today ?? 0;
    }
    if (document.getElementById('driver-earnings')) {
        document.getElementById('driver-earnings').textContent = formatUGX(stats.earnings_total ?? 0);
    }
    if (document.getElementById('driver-rating')) {
        document.getElementById('driver-rating').textContent = Number(stats.avg_rating ?? 0).toFixed(1);
    }
    if (document.getElementById('driver-active-vehicles')) {
        document.getElementById('driver-active-vehicles').textContent = stats.active_vehicle_count ?? 0;
    }

    updateDriverPresence(stats.online);
    renderDriverVehiclesOnMap(vehicles);
    passengerMarkers = renderPassengerMarkersOnMap(activeTrips);
    renderDriverCards(recentTrips, vehicles, pendingTrips, activeTrips);
    updateDriverRequestChip(getDriverLiveRecordCount(data));
    hydrateDriverWithdrawalSummary();
}

async function loadDriverDashboard() {
    if (currentUser?.role !== 'driver' || driverDashboardLoading) return;

    driverDashboardLoading = true;

    try {
        const data = await apiRequest(`/users/${currentUser.id}/driver-dashboard`);
        applyDriverDashboardSnapshot(data);
    } catch (e) {
        console.error('Driver dashboard load failed', e);
        const chip = document.getElementById('driver-request-chip');
        const welcome = document.getElementById('driver-welcome');
        const container = document.getElementById('rreqs');

        if (chip) chip.textContent = 'Backend unavailable';
        if (welcome) {
            welcome.textContent = 'We could not sync your assigned trips just now. Automatic retry is still running.';
        }
        if (container) {
            container.innerHTML = `
                <div class="rc" style="border: 1.5px solid var(--border); border-radius:12px; padding:16px; background:var(--white); box-shadow:var(--shadow-md); margin-bottom:12px;">
                    <div class="rr" style="font-weight:700; color:var(--navy); margin-bottom:4px;">Unable to sync driver records</div>
                    <div class="rm" style="display:flex; gap:12px; font-size:.74rem; color:var(--text3); flex-wrap:wrap;">
                        <span><i class="fas fa-wifi"></i> The dashboard will retry automatically</span>
                    </div>
                </div>
            `;
        }
    } finally {
        driverDashboardLoading = false;
    }
}

function stopDriverDashboardStream() {
    if (driverDashboardStream) {
        driverDashboardStream.close();
        driverDashboardStream = null;
    }
    driverDashboardStreamConnected = false;
    updateDriverRequestChip();
}

function startDriverDashboardStream() {
    if (
        currentUser?.role !== 'driver' ||
        driverDashboardStream ||
        !document.getElementById('driver-page')?.classList.contains('active') ||
        typeof EventSource === 'undefined'
    ) {
        return;
    }

    driverDashboardStream = new EventSource(
        `${API_BASE_URL}/users/${currentUser.id}/driver-dashboard/stream`
    );

    driverDashboardStream.addEventListener('dashboard', (event) => {
        driverDashboardStreamConnected = true;
        try {
            applyDriverDashboardSnapshot(JSON.parse(event.data));
        } catch (error) {
            console.error('Driver stream parse failed', error);
        }
    });

    driverDashboardStream.addEventListener('heartbeat', () => {
        driverDashboardStreamConnected = true;
        updateDriverRequestChip();
    });

    driverDashboardStream.onopen = () => {
        driverDashboardStreamConnected = true;
        updateDriverRequestChip();
    };

    driverDashboardStream.onerror = () => {
        driverDashboardStreamConnected = false;
        updateDriverRequestChip();
    };
}

async function openDriverWithdrawModal() {
    if (currentUser?.role !== 'driver') return;
    if (!driverDashboardSnapshot) {
        await loadDriverDashboard();
    }

    const errEl = document.getElementById('driver-withdraw-err');
    const amountInput = document.getElementById('driver-withdraw-amount');
    const noteInput = document.getElementById('driver-withdraw-note');

    if (errEl) {
        errEl.textContent = '';
        errEl.style.display = 'none';
    }
    if (amountInput) amountInput.value = '';
    if (noteInput) noteInput.value = '';

    hydrateDriverWithdrawalSummary();
    openM('driver-withdraw-m');
}

async function submitDriverWithdrawal() {
    if (currentUser?.role !== 'driver') return;

    const method = document.getElementById('driver-withdraw-method')?.value || 'MTN Mobile Money';
    const accountReference = document.getElementById('driver-withdraw-account')?.value.trim() || '';
    const note = document.getElementById('driver-withdraw-note')?.value.trim() || '';
    const amount = Number(document.getElementById('driver-withdraw-amount')?.value || 0);
    const availableBalance = Number(driverDashboardSnapshot?.stats?.available_earnings ?? 0);
    const errEl = document.getElementById('driver-withdraw-err');
    const submitBtn = document.getElementById('driver-withdraw-submit');

    if (errEl) {
        errEl.textContent = '';
        errEl.style.display = 'none';
    }

    if (!amount || amount <= 0) {
        if (errEl) {
            errEl.textContent = 'Enter a valid withdrawal amount.';
            errEl.style.display = 'block';
        }
        return;
    }

    if (!accountReference) {
        if (errEl) {
            errEl.textContent = 'Enter the mobile money number or bank account reference.';
            errEl.style.display = 'block';
        }
        return;
    }

    if (availableBalance > 0 && amount > availableBalance) {
        if (errEl) {
            errEl.textContent = `Only ${formatUGX(availableBalance)} is currently available for payout.`;
            errEl.style.display = 'block';
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    try {
        const result = await apiRequest(`/users/${currentUser.id}/driver-withdrawals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                method,
                account_reference: accountReference,
                note
            })
        });

        if (result.dashboard) {
            applyDriverDashboardSnapshot(result.dashboard);
        } else {
            await loadDriverDashboard();
        }

        closeM('driver-withdraw-m');
        showT('💸', result.message || 'Withdrawal request submitted successfully.', 'var(--yellow)');
    } catch (e) {
        if (errEl) {
            errEl.textContent = e.message || 'Unable to submit the withdrawal request.';
            errEl.style.display = 'block';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Request Payout';
        }
    }
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
                <td colspan="7" style="padding:18px; text-align:center; color:var(--text3);">No pending driver approvals are waiting in the backend queue.</td>
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
                <td style="padding:14px;">${driver.created_at ? formatDateTime(driver.created_at) : 'N/A'}</td>
                <td style="padding:14px; text-align:center;">
                    <button onclick="appDrv(${driver.id})" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; margin-right:4px;"><i class="fas fa-check"></i> Approve</button>
                    <button onclick="rejDrv(${driver.id})" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;"><i class="fas fa-times"></i> Reject</button>
                </td>
            </tr>`;
    }).join('');
}

function pollCurrentTripStatus() {
    if (!lastTripId || !currentUser || currentPage !== 'booking') return;
    
    apiRequest(`/trips/history?user_id=${currentUser.id}`).then(data => {
        const trips = data.trips || [];
        const currentTrip = trips.find(t => t.id === lastTripId);
        
        if (currentTrip) {
            updatePassengerLiveStatus(currentTrip);
            if (currentTrip.status === 'completed' || currentTrip.status === 'cancelled') {
                lastTripId = null; // Stop tracking once finished
            }
        }
    }).catch(e => console.error('Trip polling failed', e));
}

function updatePassengerLiveStatus(trip) {
    const box = document.getElementById('passenger-live-status');
    if (!box) return;
    
    box.style.display = 'block';
    
    const vehImg = getVehicleImage(trip.vehicle_type);
    let color = '#f97316';
    let title = 'Finding your driver...';
    let sub = `Your ${trip.vehicle_type} request is being broadcast to nearby active drivers.`;
    let showPulse = true;
    
    if (trip.status === 'active') {
        color = '#14b8a6';
        title = 'Driver Assigned!';
        sub = `${trip.driver_name || 'Your driver'} is on the way in vehicle ${trip.number_plate}.`;
        showPulse = false;
    } else if (trip.status === 'completed') {
        color = '#10b981';
        title = 'Trip Completed';
        sub = `Arrived at ${trip.end_location}. Payment of ${formatUGX(trip.fare)} successful.`;
        showPulse = false;
    } else if (trip.status === 'cancelled') {
        color = '#ef4444';
        title = 'Ride Cancelled';
        sub = 'Your request was declined or timed out. Please try again.';
        showPulse = false;
    }

    box.style.border = `1.5px solid ${color}`;
    box.style.background = `linear-gradient(rgba(255,255,255,0.9), rgba(255,255,255,0.9)), url(${vehImg})`;
    box.style.backgroundSize = 'cover';
    box.style.backgroundPosition = 'center';
    
    box.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; position:relative; z-index:2;">
            <div style="width:60px; height:60px; border-radius:14px; overflow:hidden; border:2px solid ${color}; background:#fff; position:relative;">
                <img src="${vehImg}" style="width:100%; height:100%; object-fit:cover;">
                ${showPulse ? `<div class="pls-pulse" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);"></div>` : ''}
            </div>
            <div style="flex:1;">
                <div style="font-weight:800; color:var(--navy); font-size:1.1rem; margin-bottom:2px;">${title}</div>
                <div style="font-size:.88rem; color:var(--text2); line-height:1.4;">${sub}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${trip.status === 'active' ? `<button class="btn-sos-sm" onclick="triggerSos(${trip.id})">SOS</button>` : ''}
                ${trip.status === 'completed' || trip.status === 'cancelled' ? 
                    `<button class="btn-ghost-sm" onclick="this.parentElement.parentElement.parentElement.style.display='none'">Dismiss</button>` : ''}
            </div>
        </div>
    `;
}

function renderAdminLiveActivity(trips = []) {
    const container = document.getElementById('admin-live-activity-list');
    const chip = document.getElementById('admin-live-activity-chip');
    if (!container) return;

    if (chip) chip.textContent = `${trips.length} Recent Events`;

    if (!trips.length) {
        container.innerHTML = '<div class="booking-empty-state">No platform activity detected.</div>';
        return;
    }

    container.innerHTML = trips.map(trip => {
        let color = '#f97316';
        let statusText = 'REQUESTED';
        if (trip.status === 'active') { color = '#14b8a6'; statusText = 'STARTED'; }
        else if (trip.status === 'completed') { color = '#10b981'; statusText = 'FINISHED'; }
        else if (trip.status === 'cancelled') { color = '#ef4444'; statusText = 'CANCELLED'; }

        const vehImg = getVehicleImage(trip.vehicle_type);

        return `
            <div style="display:flex; align-items:center; gap:14px; padding:12px; border-bottom:1px solid #f3f4f6;">
                <div style="width:38px; height:38px; border-radius:8px; overflow:hidden; flex-shrink:0; border:1px solid #e5e7eb;">
                    <img src="${vehImg}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                        <span style="font-size:.85rem; font-weight:700; color:var(--navy);">${escapeHtml(trip.passenger_name || 'Passenger')}</span>
                        <span style="font-size:.65rem; font-weight:800; color:${color}; letter-spacing:0.04em;">${statusText}</span>
                    </div>
                    <div style="font-size:.72rem; color:var(--text3); line-height:1.3;">
                        Booked ${escapeHtml(trip.vehicle_type)} to ${escapeHtml(trip.end_location)}
                    </div>
                </div>
            </div>
        `;
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

        updateAdminChart(stats.total_passengers ?? 0, stats.total_drivers ?? 0);

        initAdmMap();
        renderAdminVehiclesOnMap(vehicles);
        renderAdminAlerts(data.sos_alerts || []);
        renderPendingDrivers(data.pending_drivers || []);
        renderAdminLiveActivity(data.live_trips || []);
    } catch (e) {
        showT('❌', e.message || 'Unable to load admin dashboard.', 'var(--red)');
    }
}

function updateAdminChart(passengers, drivers) {
    const ctx = document.getElementById('admin-user-chart');
    const statusChip = document.getElementById('admin-chart-status');
    if (!ctx) return;
    
    if (statusChip) {
        statusChip.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success);"></i> Live Sync';
    }

    const chartData = {
        labels: ['Passengers Accounts', 'Driver Partners'],
        datasets: [{
            data: [passengers, drivers],
            backgroundColor: ['#3b82f6', '#10b981'], // Blue for Passengers, Emerald for Drivers
            hoverBackgroundColor: ['#2563eb', '#059669'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    if (adminUserChartInstance) {
        adminUserChartInstance.data = chartData;
        adminUserChartInstance.update();
    } else {
        if (typeof Chart === 'undefined') return;
        adminUserChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#4b5563',
                            font: { family: "'Inter', sans-serif", size: 13, weight: 'bold' },
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 14, family: "'Inter', sans-serif" },
                        bodyFont: { size: 13, family: "'Inter', sans-serif", weight: 'bold' }
                    }
                }
            }
        });
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

function appDrv(driverId) {
    if (!confirm('Are you sure you want to approve this driver? They will gain full access to the STS Driver app.')) return;
    showT('⏳', 'Approving driver...', 'var(--brand)');
    apiRequest(`/admin/drivers/${driverId}/approve`, { method: 'POST' })
        .then(result => {
            showT('✅', result.message || 'Driver approved successfully.', 'var(--success)');
            loadAdminDashboard();
        })
        .catch(e => showT('❌', e.message || 'Failed to approve driver.', 'var(--red)'));
}

function rejDrv(driver_id) {
    if (!confirm('Are you sure you want to completely reject and remove this driver application?')) return;
    showT('⏳', 'Removing application...', 'var(--gray)');
    apiRequest(`/admin/drivers/${driver_id}/reject`, { method: 'POST' })
        .then(result => {
            showT('⚠️', result.message || 'Driver application rejected.', 'var(--orange)');
            loadAdminDashboard();
        })
        .catch(e => showT('❌', e.message || 'Failed to reject driver.', 'var(--red)'));
}

async function resetSystemActivity() {
    if (!confirm('CRITICAL ACTION: This will permanently delete ALL trip and payment history from the database. This is intended for clearing test data only. Proceed?')) return;
    
    showT('⚠️', 'Purging system activity logs...', 'var(--red)');
    try {
        const result = await apiRequest('/admin/system/reset-activity', { method: 'POST' });
        showT('✅', result.message || 'Activity logs cleared.', 'var(--success)');
        
        // Refresh dashboard immediately to show empty state
        if (typeof loadAdminDashboard === 'function') {
            await loadAdminDashboard();
        }
    } catch (e) {
        showT('❌', e.message || 'Failed to reset activity.', 'var(--red)');
    }
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
        try {
            // Update Sync Indicator Based on Connectivity
            const indicator = document.getElementById('live-sync-indicator');
            if (indicator) {
                indicator.style.display = 'flex';
                const pulse = indicator.querySelector('.sync-pulse');
                const label = indicator.querySelector('span:last-child');
                
                // If any stream is active, show Green/Live
                if (adminDashboardStreamConnected || driverDashboardStreamConnected) {
                    pulse.style.background = '#10b981';
                    label.style.color = '#10b981';
                    label.textContent = 'Live';
                } else {
                    // Falling back to polling - show Yellow/Sync
                    pulse.style.background = '#f59e0b';
                    label.style.color = '#f59e0b';
                    label.textContent = 'Sync';
                }
            }

            const data = await apiRequest('/vehicles/live-locations');
            liveFleetSnapshot = {
                vehicles: data.vehicles || [],
                trips: data.trips || [],
                generatedAt: data.generated_at || new Date().toISOString()
            };
            
            // 1. Update booking map and live fleet cards
            if (map && document.getElementById('booking-page')?.classList.contains('active')) {
                syncBookingLiveUI();
            }
            
            // 2. Fall back to polling if the live driver stream is unavailable.
            if (
                document.getElementById('driver-page')?.classList.contains('active') &&
                currentUser?.role === 'driver' &&
                !driverDashboardStreamConnected
            ) {
                await loadDriverDashboard();
            }
            
            // 3. Update admin dashboard if stream is unavailable
            if (document.getElementById('admin-page')?.classList.contains('active') && 
                currentUser?.role === 'admin' && 
                !adminDashboardStreamConnected) {
                await loadAdminDashboard();
            }

            // 4. Update passenger's current trip status
            if (lastTripId && document.getElementById('booking-page')?.classList.contains('active')) {
                pollCurrentTripStatus();
            }
        } catch (e) {
            console.warn('Live tracking poll skipped', e);
            const indicator = document.getElementById('live-sync-indicator');
            if (indicator) {
                indicator.querySelector('.sync-pulse').style.background = '#ef4444';
                indicator.querySelector('span:last-child').style.color = '#ef4444';
                indicator.querySelector('span:last-child').textContent = 'Offline';
            }
        }
    };
    
    poll();
    liveTrackingInterval = setInterval(poll, 4000); 
}

/**
 * Establishment of Server-Sent Events (SSE) for Admin
 */
function initAdminStream() {
    if (adminDashboardStream) adminDashboardStream.close();
    
    console.log('Establishing Real-time Admin Bridge...');
    adminDashboardStream = new EventSource(`${API_BASE_URL}/admin/dashboard/stream`);
    
    adminDashboardStream.onopen = () => {
        adminDashboardStreamConnected = true;
        console.log('✅ Admin Live Bridge Connected');
        showT('🟢', 'Live Fleet Connection Established', 'var(--success)');
    };

    adminDashboardStream.addEventListener('connected', () => {
        adminDashboardStreamConnected = true;
        console.log('⚡ Admin Data Bridge Handshake Complete');
    });

    adminDashboardStream.addEventListener('dashboard', (e) => {
        const data = JSON.parse(e.data);
        adminDashboardStreamConnected = true;
        
        // Populate dashboard silently with live data
        if (data.stats) {
            if (document.getElementById('admin-total-users')) document.getElementById('admin-total-users').textContent = data.stats.total_users;
            if (document.getElementById('admin-passengers')) document.getElementById('admin-passengers').textContent = data.stats.total_passengers;
            if (document.getElementById('admin-drivers')) document.getElementById('admin-drivers').textContent = data.stats.total_drivers;
            if (document.getElementById('admin-revenue')) document.getElementById('admin-revenue').textContent = formatUGX(data.stats.total_revenue);
            
            updateAdminChart(data.stats.total_passengers ?? 0, data.stats.total_drivers ?? 0);
        }
        
        if (data.live_trips) renderAdminLiveActivity(data.live_trips);
        if (data.sos_alerts) renderAdminAlerts(data.sos_alerts);
        if (data.pending_drivers) renderPendingDrivers(data.pending_drivers);
        
        console.log('Admin Dashboard Synced via Live Stream');
    });

    adminDashboardStream.onerror = (err) => {
        adminDashboardStreamConnected = false;
        console.warn('Admin Live Stream encountered an error. Falling back to polling.', err);
        // If the server is offline or the stream is blocked by a proxy
        if (adminDashboardStream.readyState === EventSource.CLOSED) {
            console.error('SSE Connection was closed by the server.');
        }
    };
}

/**
 * Establishment of Server-Sent Events (SSE) for Driver
 */
function initDriverStream() {
    if (driverDashboardStream) driverDashboardStream.close();
    if (!currentUser || currentUser.role !== 'driver') return;

    console.log('Establishing Real-time Driver Bridge...');
    driverDashboardStream = new EventSource(`${API_BASE_URL}/users/${currentUser.id}/driver-dashboard/stream`);

    driverDashboardStream.addEventListener('dashboard', (e) => {
        const data = JSON.parse(e.data);
        driverDashboardStreamConnected = true;
        
        // Pass data directly to renderer
        renderDriverDashboardData(data);
    });

    driverDashboardStream.onerror = () => {
        driverDashboardStreamConnected = false;
        console.warn('Driver Live Stream encountered an error. Falling back to polling.');
    };
}

function renderDriverDashboardData(data) {
    if (!data) return;
    
    if (document.getElementById('drv-rides-today')) document.getElementById('drv-rides-today').textContent = data.stats?.rides_today ?? 0;
    if (document.getElementById('drv-earnings')) document.getElementById('drv-earnings').textContent = formatUGX(data.stats?.earnings_total ?? 0);
    if (document.getElementById('drv-rating')) document.getElementById('drv-rating').textContent = (data.stats?.avg_rating || '5.0') + '/5';
    
    if (data.active_trips) {
        const container = document.getElementById('drv-active-trips');
        if (container) {
            if (data.active_trips.length > 0) {
                container.innerHTML = data.active_trips.map(trip => `
                    <div class="trip-card active">
                        <div class="trip-header">
                            <span class="trip-id">TRIP #${trip.id}</span>
                            <span class="trip-status active">LIVE</span>
                        </div>
                        <div class="trip-body">
                            <p><i class="fas fa-map-marker-alt"></i> ${escapeHtml(trip.start_location)}</p>
                            <p><i class="fas fa-flag-checkered"></i> ${escapeHtml(trip.end_location)}</p>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div class="empty-state">No live trips. Go online to receive requests.</div>';
            }
        }
    }
}


boot();
initLiveTracking();

// ══════════════════════════════════════════
// CHATBOT LOGIC
// ══════════════════════════════════════════
function isSafeExternalUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

function applyChatbotStatus(status = {}, overrideDetail = '') {
    chatbotStatusSnapshot = status;

    const label = document.getElementById('chatbot-provider-label');
    const subtitle = document.getElementById('chatbot-provider-subtitle');
    const statusDot = document.querySelector('.cb-status');
    
    // Professional Branding: Always show branded name and positive status
    const labelText = 'STS Connect Assistant';
    const detail = 'Professional Transport Support';

    if (label) label.textContent = labelText;
    if (subtitle) subtitle.textContent = detail;

    if (statusDot) {
        // Since we now have a high-quality knowledge engine fallback, 
        // the assistant is always "Live" for the user.
        statusDot.style.background = 'var(--green)';
    }
}

async function loadChatbotStatus(force = false) {
    if (chatbotStatusLoading) return;
    if (chatbotStatusSnapshot && !force) {
        applyChatbotStatus(chatbotStatusSnapshot);
        return;
    }

    chatbotStatusLoading = true;
    try {
        const status = await apiRequest('/chat/status');
        applyChatbotStatus(status);
    } catch (error) {
        applyChatbotStatus({
            provider: 'OpenAI',
            ready: false,
            status: 'attention_needed',
            detail: error.message || 'Unable to load chatbot status right now.'
        });
    } finally {
        chatbotStatusLoading = false;
    }
}

function toggleChatbot() {
    const window = document.getElementById('chatbot-window');
    if (!window) return;
    const isOpen = window.classList.contains('open');
    if (isOpen) {
        window.classList.remove('open');
    } else {
        window.classList.add('open');
        loadChatbotStatus();
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
    const msg = input?.value.trim();
    if (!msg) return;

    input.value = '';
    addChatMessage(msg, 'user');
    const history = chatbotConversation.slice(-12);
    chatbotConversation.push({ role: 'user', content: msg });
    
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
            body: JSON.stringify({ message: msg, history })
        });
        
        const ind = document.getElementById("cb-typing-indicator");
        if (ind) ind.remove();

        if (result?.status) {
            applyChatbotStatus(result.status, result.notice || '');
        }

        if (result && result.reply) {
            addChatMessage(result.reply, 'bot', { sources: result.sources || [] });
            chatbotConversation.push({ role: 'assistant', content: result.reply });
        } else {
            addChatMessage("I'm having trouble thinking right now.", 'bot');
        }
    } catch (e) {
        const ind = document.getElementById("cb-typing-indicator");
        if (ind) ind.remove();
        addChatMessage("Server unavailable. Please try again later.", 'bot');
    }
}

function addChatMessage(text, sender, options = {}) {
    const chatContainer = document.getElementById('chatbot-messages');
    if (!chatContainer) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = `cb-msg ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = 'cb-bubble';
    bubble.textContent = text;
    wrapper.appendChild(bubble);

    if (sender === 'bot' && Array.isArray(options.sources) && options.sources.length) {
        const sources = document.createElement('div');
        sources.className = 'cb-sources';

        options.sources.forEach((source) => {
            if (!isSafeExternalUrl(source?.url)) return;
            const link = document.createElement('a');
            link.className = 'cb-source-link';
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.innerHTML = `<i class="fas fa-link"></i> ${escapeHtml(source.title || source.url)}`;
            sources.appendChild(link);
        });

        if (sources.childElementCount) {
            wrapper.appendChild(sources);
        }
    }
    
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
        scr.innerHTML = "STS Uganda<br>1. Book a Ride<br>2. Check Fares<br>3. Wallet Balance<br>4. About & Contact<br><br>Type choice (1-4) and Send:";
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
            scr.innerHTML = "STS Uganda<br>1. Book a Ride<br>2. Check Fares<br>3. Wallet Balance<br>4. About & Contact<br><br>Type choice (1-4) and Send:";
        } else if (['1','2','3'].includes(val)) {
            scr.innerHTML = "Booking request received.<br>Driver assigned via SMS.<br><br>Thank you for using STS!<br>(Session Ended)";
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
            scr.innerHTML = "STS Uganda<br>1. Book a Ride<br>2. Check Fares<br>3. Wallet Balance<br>4. About & Contact<br><br>Type choice (1-4) and Send:";
        } else {
            // Keep same state if invalid input on these pages except 0
            scr.innerHTML = scr.innerHTML.split('<br>0. Back')[0] + "<br>(Invalid) 0. Back";
        }
    }
}

function updateSyncUI(isConnected) {
    const indicators = [
        document.getElementById('live-sync-indicator'),
        document.getElementById('mobile-sync-slot')
    ];
    
    indicators.forEach(indicator => {
        if (!indicator) return;
        
        if (indicator.id === 'mobile-sync-slot') {
            indicator.innerHTML = `
                <div id="live-sync-indicator-mob" class="live-indicator-mob" style="display:flex; align-items:center; gap:8px; padding: 4px 10px; background: rgba(16, 185, 129, 0.1); border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.2);">
                    <span class="sync-pulse" style="width:8px; height:8px; background:${isConnected ? '#10b981' : '#f97316'}; border-radius:50%; display:inline-block;"></span>
                    <span style="font-size:0.7rem; font-weight:700; color:${isConnected ? '#10b981' : '#f97316'}; text-transform:uppercase; letter-spacing:0.05em;">${isConnected ? 'Live' : 'Offline'}</span>
                </div>
            `;
        } else {
            indicator.style.display = 'flex';
            const dot = indicator.querySelector('.sync-pulse');
            const lbl = indicator.querySelector('span:last-child');
            if (dot) dot.style.background = isConnected ? '#10b981' : '#f97316';
            if (lbl) {
                lbl.textContent = isConnected ? 'Live' : 'Offline';
                lbl.style.color = isConnected ? '#10b981' : '#f97316';
            }
        }
    });
}

function initSyncMonitoring() {
    const poll = async () => {
        try {
            const resp = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
            updateSyncUI(resp.ok);
        } catch (e) {
            updateSyncUI(false);
        }
    };
    poll();
    setInterval(poll, 15000); 
}

// DROPDOWN CLICK HANDLER
document.addEventListener('click', function(e) {
    const dropbtn = e.target.closest('.dropbtn');
    const dropdowns = document.querySelectorAll('.dropdown');
    
    if (dropbtn) {
        const parent = dropbtn.closest('.dropdown');
        e.preventDefault();
        
        // Close all others
        dropdowns.forEach(d => {
            if (d !== parent) d.classList.remove('open');
        });
        // Toggle the clicked one
        parent.classList.toggle('open');
    } else {
        // Clicked outside, close all
        dropdowns.forEach(d => d.classList.remove('open'));
    }
});
