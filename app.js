let S_URL, S_KEY, O_KEY, sbClient;

// Глобална променлива за текущия език
let currentLanguage = 'bg';

/**
 * ИНИЦИАЛИЗАЦИЯ: Извличане на ключовете от защитен API ендпоинт
 */
async function init() {
    try {
        // Извикваме вашия сървърен ендпоинт, който държи ключовете скрити
        const res = await fetch('/api/config');
        const config = await res.json();
        
        S_URL = config.supabaseUrl; 
        S_KEY = config.supabaseKey; 
        O_KEY = config.openaiKey;

        if (window.supabase && !sbClient) {
            sbClient = window.supabase.createClient(S_URL, S_KEY);
            setupAuth();
            checkUser();
        }
    } catch (e) {
        console.error("Грешка при инициализация:", e);
    }
}

// Изчакваме DOM и библиотеките да се заредят
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/**
 * АУТЕНТИКАЦИЯ: Вход и Регистрация
 */
function setupAuth() {
    // Добавяне на функционалност за превключване между вход и регистрация
    const toggleBtn = document.getElementById('toggleAuthBtn');
    const mainBtn = document.getElementById('mainAuthBtn');
    const authTitle = document.getElementById('authTitle');
    
    if (toggleBtn && mainBtn && authTitle) {
        toggleBtn.onclick = () => {
            const isLogin = authTitle.textContent.includes('Вход') || authTitle.textContent.includes('Login');
            if (isLogin) {
                // Превключване към регистрация
                if (currentLanguage === 'en') {
                    authTitle.textContent = 'Register';
                    mainBtn.textContent = 'Sign Up';
                    toggleBtn.textContent = 'Already have account';
                } else {
                    authTitle.textContent = 'Регистрация';
                    mainBtn.textContent = 'Регистрирай се';
                    toggleBtn.textContent = 'Вече имам профил';
                }
            } else {
                // Превключване към вход
                if (currentLanguage === 'en') {
                    authTitle.textContent = 'Login';
                    mainBtn.textContent = 'Login';
                    toggleBtn.textContent = 'Register';
                } else {
                    authTitle.textContent = 'Вход';
                    mainBtn.textContent = 'Влез';
                    toggleBtn.textContent = 'Регистрация';
                }
            }
        };
        
        mainBtn.onclick = async () => {
            const email = document.getElementById('authEmail').value;
            const pass = document.getElementById('authPassword').value;
            const isReg = authTitle.textContent.includes('Регистрация') || authTitle.textContent.includes('Register');
            
            if (!email || !pass) {
                alert('Моля попълнете всички полета!');
                return;
            }
            
            try {
                if (isReg) {
                    // Регистрация с имейл потвърждение
                    const { data, error } = await sbClient.auth.signUp({
                        email,
                        password: pass,
                        options: {
                            emailRedirectTo: window.location.origin
                        }
                    });
                    
                    if (error) throw error;
                    
                    // Показване на съобщение за имейл потвърждение
                    alert('✉️ Проверете имейла си!\n\nИзпратихме ви линк за потвърждение. Моля кликнете на линка в имейла, за да активирате профила си.');
                    
                    // Скриваме модала
                    const modal = document.getElementById('authModal');
                    if (modal) modal.style.display = 'none';
                } else {
                    // Вход
                    const { error } = await sbClient.auth.signInWithPassword({ email, password: pass });
                    
                    if (error) throw error;
                    
                    // Скриваме модала при успех
                    const modal = document.getElementById('authModal');
                    if (modal) modal.style.display = 'none'; 
                    
                    checkUser();
                }
            } catch (err) { 
                alert('Грешка: ' + err.message); 
            }
        };
    }
}

async function checkUser() {
    const { data: { user } } = await sbClient.auth.getUser();
    const statusDiv = document.getElementById('userStatus');
    const benefitsBox = document.getElementById('benefitsBox');
    const myTripsSection = document.getElementById('myTripsSection');
    
    if (user && statusDiv) {
        statusDiv.innerHTML = `
            <div class="flex items-center gap-3 bg-slate-800 p-2 px-4 rounded-xl border border-slate-700">
                <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">${user.email}</span>
                <button onclick="sbClient.auth.signOut().then(() => location.reload())" class="text-white hover:text-red-500 transition px-2">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>`;
        
        // Скриване на benefitsBox при влязъл потребител (в sidebar)
        if (benefitsBox) benefitsBox.classList.add('hidden');
        
        // Показване на секцията "Моите запазени програми"
        if (myTripsSection) myTripsSection.classList.remove('hidden');
        
        // Изчистване на ограничението за нерегистрирани
        localStorage.removeItem('hasGeneratedItinerary');
        
        loadUserItineraries(); 
    } else {
        // Показване на benefitsBox при невлязъл потребител (в sidebar)
        if (benefitsBox) benefitsBox.classList.remove('hidden');
        
        // Скриване на секцията "Моите запазени програми"
        if (myTripsSection) myTripsSection.classList.add('hidden');
    }
}

/**
 * БАЗА ДАННИ: Зареждане, Преглед и Изтриване
 */
async function loadUserItineraries() {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    const { data, error } = await sbClient
        .from('itineraries')
        .select('*')
        .order('created_at', { ascending: false });

    const container = document.getElementById('savedItineraries');
    const section = document.getElementById('myTripsSection');
    if (!container) return;

    if (data && data.length > 0) {
        // Показваме секцията
        if (section) section.classList.remove('hidden');
        
        container.innerHTML = data.map(item => `
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 p-5 rounded-2xl flex flex-col justify-between group hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/20 transition-all h-full">
                <div class="mb-4">
                    <h5 class="text-white font-bold text-base uppercase tracking-tight mb-3">${item.destination}</h5>
                    <div class="inline-flex items-center gap-2 bg-blue-600/20 px-3 py-1.5 rounded-lg border border-blue-500/30">
                        <i class="fas fa-calendar-alt text-blue-400 text-[10px]"></i>
                        <p class="text-[10px] text-blue-300 font-semibold">
                            ${new Date(item.created_at).toLocaleDateString('bg-BG')}
                        </p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="viewSaved('${item.id}')" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-500 transition shadow-lg">
                        <i class="fas fa-eye mr-1"></i> Преглед
                    </button>
                    <button onclick="deleteSaved('${item.id}')" class="bg-red-500/20 text-red-400 p-2 px-3 rounded-xl text-[10px] hover:bg-red-500 hover:text-white transition border border-red-500/30">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        // Скриваме секцията ако няма данни
        if (section) section.classList.add('hidden');
        container.innerHTML = `<p class="text-slate-600 text-[10px] uppercase font-bold italic tracking-widest col-span-full">Нямате запазени планове.</p>`;
    }
}

window.viewSaved = async (id) => {
    const { data, error } = await sbClient.from('itineraries').select('*').eq('id', id).single();
    if (data) {
        const res = document.getElementById('result');
        res.innerHTML = data.content;
        res.classList.remove('hidden');
        res.scrollIntoView({ behavior: 'smooth' });
    }
};

window.deleteSaved = async (id) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази програма?")) return;
    const { error } = await sbClient.from('itineraries').delete().eq('id', id);
    if (!error) loadUserItineraries();
};

/**
 * Генерира Trip.com Deep Link за дестинация
 */
function getTripComLink(destination) {
    const baseUrl = "https://www.trip.com/hotels/list";
    const allianceId = "7847155";
    const sid = "295352142";
    
    // Сглобяваме линк, който директно търси дестинацията
    return `${baseUrl}?cityname=${encodeURIComponent(destination)}&Allianceid=${allianceId}&SID=${sid}&trip_sub1=ai_itinerary`;
}

/**
 * AI ГЕНЕРИРАНЕ: OpenAI Integration
 */
async function generatePlan(e) {
    e.preventDefault();
    
    // Проверка дали потребителят е влязъл
    const { data: { user } } = await sbClient.auth.getUser();
    
    // Ако НЕ е влязъл, проверяваме дали вече е генерирал програма
    if (!user) {
        const hasGenerated = localStorage.getItem('hasGeneratedItinerary');
        
        if (hasGenerated === 'true') {
            // Показване на съобщение с призив за регистрация
            const shouldRegister = confirm(
                "🔒 Достигнахте лимита за гост-потребители!\n\n" +
                "✨ Регистрирайте се безплатно, за да:\n" +
                "• Генерирате неограничен брой програми\n" +
                "• Запазвате и достъпвате програмите си по всяко време\n" +
                "• Експортвате в PDF формат\n\n" +
                "Искате ли да се регистрирате сега?"
            );
            
            if (shouldRegister) {
                openModal();
            }
            return; // Спиране на генерирането
        }
    }
    
    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    const startDate = document.getElementById('startDate').value;
    const travelStyle = document.getElementById('travelStyle').value;
    const travelers = document.getElementById('travelers').value;
    const budgetAmount = document.getElementById('budgetAmount').value;
    const currency = document.getElementById('currency').value;
    
    const placeholder = document.getElementById('placeholder');
    if (placeholder) placeholder.classList.add('hidden');
    
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    // Превод на стиловете
    const styleMap = {
        'balanced': 'балансиран (комбинация от забележителности и релакс)',
        'dynamic': 'динамичен (много активности и забележителности)',
        'relaxed': 'релаксиращ (повече почивка и спокойни дейности)'
    };
    
    const travelStyleBG = styleMap[travelStyle] || 'балансиран';
    
    // Избор на език за AI промпт
    const isEnglish = currentLanguage === 'en';
    
    const prompt = isEnglish ? 
    `Create a professional travel plan for ${dest} in ENGLISH with the following parameters:

📍 Destination: ${dest}
📅 Duration: ${days} days (starting ${startDate})
👥 Number of travelers: ${travelers} people
💰 Budget: ${budgetAmount} ${currency} per person
🎯 Travel style: ${styleMap[travelStyle] || 'balanced'}

STRUCTURE (NO # OR * SYMBOLS):

HOTEL: [Hotel name] - [Brief description]
(Suggest 4 different hotels suitable for the budget)

DAY 1:
☕ BREAKFAST: [Cafe/restaurant name] - [Description and specialty]
🏛️ [Attraction 1] - [Description]
🏛️ [Attraction 2] - [Description]
🍴 LUNCH: [Restaurant name] - [Description and recommended dish]
📸 [Attraction 3] - [Description]
📸 [Attraction 4] - [Description]
🌙 DINNER: [Restaurant name] - [Description]

(Repeat structure for each day)

IMPORTANT:
- All venues must be REAL and existing in ${dest}
- All descriptions should be specific and useful
- Consider the budget of ${budgetAmount} ${currency} per person
- Follow the "${styleMap[travelStyle]}" style
- For ${travelers} people
- Each place on a NEW line
- Emojis only at the beginning of the line
- DO NOT add any concluding text or summary at the end
- STOP after the last day's dinner`
    :
    `Създай професионален туристически план за ${dest} на БЪЛГАРСКИ език със следните параметри:

📍 Дестинация: ${dest}
📅 Продължителност: ${days} дни (от ${startDate})
👥 Брой пътуващи: ${travelers} души
💰 Бюджет: ${budgetAmount} ${currency} на човек
🎯 Стил на пътуване: ${travelStyleBG}

СТРУКТУРА (БЕЗ СИМВОЛИ # ИЛИ *):

ХОТЕЛ: [Име на хотел] - [Кратко описание]
(Предложи 4 различни хотела подходящи за бюджета)

ДЕН 1:
☕ ЗАКУСКА: [Име на кафене/ресторант] - [Описание и специалитет]
🏛️ [Забележителност 1] - [Описание]
🏛️ [Забележителност 2] - [Описание]
🍴 ОБЯД: [Име на ресторант] - [Описание и препоръчано ястие]
📸 [Забележителност 3] - [Описание]
📸 [Забележителност 4] - [Описание]
🌙 ВЕЧЕРЯ: [Име на ресторант] - [Описание]

(Повтори структурата за всеки ден)

ВАЖНО:
- Всички заведения да са РЕАЛНИ и съществуващи в ${dest}
- Всички описания да са конкретни и полезни
- Съобрази бюджета ${budgetAmount} ${currency} на човек
- Спазвай стила "${travelStyleBG}"
- За ${travelers} души
- Всяко място на НОВА линия
- Емоджи само в началото на реда
- НЕ добавяй заключителен текст или обобщение в края
- СПРИ след вечерята на последния ден`;
    
    const systemMessage = isEnglish ?
        "You are an expert travel guide who creates detailed and personalized travel programs. Respond exactly according to the given structure, with real places and specific recommendations." :
        "Ти си експертен туристически гид, който създава детайлни и персонализирани пътни програми. Отговаряй точно по зададената структура, с реални места и конкретни препоръки.";

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${O_KEY}` 
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {role: "system", content: systemMessage},
                    {role: "user", content: prompt}
                ]
            })
        });
        const data = await response.json();
        renderUI(dest, days, startDate, travelers, budgetAmount, currency, data.choices[0].message.content);
        
        // Ако потребителят НЕ е влязъл, маркираме че е генерирал програма
        if (!user) {
            localStorage.setItem('hasGeneratedItinerary', 'true');
        }
    } catch (err) {
        alert("Грешка при генериране на плана!");
    } finally {
        document.getElementById('loader').classList.add('hidden');
    }
}

/**
 * UI РЕНДЕРИРАНЕ: Превръщане на текста в HTML карти
 */
function renderUI(dest, days, startDate, travelers, budgetAmount, currency, md) {
    const res = document.getElementById('result');
    let hotelsHtml = ""; let programHtml = ""; let hCount = 0;
    
    const lines = md.replace(/[*#]/g, '').split('\n').filter(l => l.trim() !== "");

    lines.forEach(line => {
        const l = line.trim(); 
        const upper = l.toUpperCase();
        
        // Филтър: Игнорирай редове със забележки и празни редове
        if (l.startsWith('(') || l.startsWith('[') || 
            upper.includes('ПРЕДЛОЖИ') || upper.includes('SUGGEST') || 
            upper.includes('ПОВТОРИ') || upper.includes('REPEAT') ||
            upper.includes('ВАЖНО') || upper.includes('IMPORTANT') ||
            upper.includes('СТРУКТУРА') || upper.includes('STRUCTURE') ||
            upper.startsWith('**') || // Markdown bold
            l.length <= 3) {
            return; // Пропусни този ред
        }
        
        // 1. ХОТЕЛИ
        if ((upper.startsWith('ХОТЕЛ:') || upper.startsWith('HOTEL:')) && hCount < 4) {
            const parts = l.split(':')[1].trim().split('-');
            const name = parts[0].trim();
            const desc = parts[1] ? parts[1].trim() : "";
            const hotelUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest + " " + name)}&aid=7872577`;
            hotelsHtml += `
                <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm" style="page-break-inside: avoid;">
                    <div class="mb-2">
                        <p class="text-[10px] font-black text-blue-600 uppercase mb-1">Настаняване</p>
                        <p class="font-bold text-slate-800 text-base leading-tight mb-2">${name}</p>
                        ${desc ? `<p class="text-sm text-slate-600 leading-snug">${desc}</p>` : ''}
                    </div>
                    <a href="${hotelUrl}" target="_blank" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-md block text-center hover:bg-blue-700 transition">
                        Резервирай в Booking.com
                    </a>
                </div>`;
            hCount++;
        }
        // 2. ЗАГЛАВИЯ НА ДНИ (само ако започва с "ДЕН" или "DAY" или има само "ДЕН X:")
        else if ((upper.startsWith('ДЕН') || upper.startsWith('DAY')) && 
                 (l.match(/^(ДЕН|DAY)\s*\d+/i) || l.length < 20)) {
            programHtml += `<div class="text-2xl font-black text-slate-900 border-b-4 border-blue-600/20 mt-10 mb-6 uppercase italic pb-1" style="page-break-before: auto; page-break-after: avoid;">${l}</div>`;
        }
        // 3. ВСИЧКО ДРУГО СТАВА КАРТА
        else if (l.length > 3) {
            // Разделяне на заглавие и описание (ако има "-")
            let title = l;
            let desc = "";
            
            if (l.includes('-')) {
                const parts = l.split('-');
                title = parts[0].trim();
                desc = parts.slice(1).join('-').trim();
            }
            
            // Почистване на заглавието от емоджи и ключови думи
            const cleanTitle = title
                .replace(/[\u{1F300}-\u{1F9FF}]/ug, '')
                .replace(/ЗАКУСКА:|ОБЯД:|ВЕЧЕРЯ:|BREAKFAST:|LUNCH:|DINNER:/gi, '')
                .trim();
            
            // Проверка дали е ресторант
            const isRestaurant = upper.includes('ЗАКУСКА') || upper.includes('ОБЯД') || upper.includes('ВЕЧЕРЯ') ||
                                upper.includes('BREAKFAST') || upper.includes('LUNCH') || upper.includes('DINNER');
            
            // Генериране на линк - ВСИЧКИ към Google Maps
            const linkUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest + " " + cleanTitle)}`;
            
            // Рендиране на картата
            programHtml += `
                <div class="bg-white p-5 rounded-[2.5rem] shadow-md border border-slate-50 mb-4 flex justify-between items-center group transition hover:border-blue-200" style="page-break-inside: avoid;">
                    <div class="flex flex-col pr-4 flex-1">
                        <b class="text-slate-900 font-extrabold text-lg block mb-1 tracking-tight">${title}</b>
                        ${desc ? `<p class="text-slate-600 text-sm leading-relaxed line-clamp-2">${desc}</p>` : ''}
                    </div>
                    <a href="${linkUrl}" target="_blank" class="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:bg-blue-600 transition">
                        <i class="fas fa-${isRestaurant ? 'utensils' : 'map-marker-alt'} text-sm"></i>
                    </a>
                </div>`;
        }
    });

    // Проверка дали потребителят е влязъл за PDF бутона
    const checkUserForPDF = async () => {
        const { data: { user } } = await sbClient.auth.getUser();
        return user;
    };

    res.innerHTML = `
        <div id="pdfArea" class="max-w-5xl mx-auto pb-24 bg-white p-4 md:p-8 rounded-[4rem]">
            <!-- Хедър с информация -->
            <div class="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8 md:p-10 rounded-[2.5rem] text-white mb-10 shadow-2xl border-b-[8px] border-blue-600" style="page-break-inside: avoid;">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                                <i class="fas fa-map-marked-alt text-2xl"></i>
                            </div>
                            <div>
                                <h2 class="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">${dest}</h2>
                                <p class="text-[9px] text-blue-300 tracking-[0.3em] font-light uppercase">Premium Travel Guide</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] mt-4">
                            <div class="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/20">
                                <i class="fas fa-calendar-alt text-blue-400 mr-1"></i>
                                <span class="font-bold">${days} дни</span>
                            </div>
                            <div class="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/20">
                                <i class="fas fa-users text-emerald-400 mr-1"></i>
                                <span class="font-bold">${travelers} души</span>
                            </div>
                            <div class="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/20">
                                <i class="fas fa-wallet text-purple-400 mr-1"></i>
                                <span class="font-bold">${budgetAmount} ${currency}</span>
                            </div>
                            <div class="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/20">
                                <i class="fas fa-calendar-check text-yellow-400 mr-1"></i>
                                <span class="font-bold">${startDate || 'Гъвкави дати'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col md:flex-row gap-2" data-html2canvas-ignore="true">
                        <div id="actionButtons" class="flex gap-2">
                            <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg transition">
                                <i class="fas fa-bookmark mr-1"></i> Запази
                            </button>
                            <button id="pdfButton" onclick="handlePDFClick('${dest}')" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg transition">
                                <i class="fas fa-file-pdf mr-1"></i> PDF
                            </button>
                        </div>
                        <div id="shareButtons" class="flex gap-2 hidden">
                            <button onclick="shareToFacebook('${dest}')" class="bg-[#1877F2] hover:bg-[#0d6efd] text-white p-3 rounded-2xl shadow-lg transition" title="Сподели във Facebook">
                                <i class="fab fa-facebook-f text-sm"></i>
                            </button>
                            <button onclick="shareToTwitter('${dest}')" class="bg-black hover:bg-gray-800 text-white p-3 rounded-2xl shadow-lg transition" title="Сподели в X">
                                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            </button>
                            <button onclick="shareToLinkedIn('${dest}')" class="bg-[#0A66C2] hover:bg-[#004182] text-white p-3 rounded-2xl shadow-lg transition" title="Сподели в LinkedIn">
                                <i class="fab fa-linkedin-in text-sm"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Програма -->
            <div class="px-2">${programHtml}</div>
            
            <!-- Trip.com Бутон -->
            <div class="mt-12 mb-10 px-2 text-center" style="page-break-inside: avoid;">
                <a href="${getTripComLink(dest)}" target="_blank" class="inline-block bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-black py-5 px-8 rounded-3xl text-sm transition shadow-2xl transform hover:scale-105" style="text-decoration: none;">
                    <i class="fas fa-hotel mr-2 text-lg"></i>
                    <span class="uppercase">Виж наличните хотели в</span> ${dest} <span class="uppercase">за твоите дати в Trip.com</span>
                </a>
            </div>
            
            <!-- Footer (само в PDF) -->
            <div class="mt-16 p-6 bg-slate-50 rounded-2xl text-center border-t-4 border-blue-600" style="page-break-inside: avoid;" data-html2canvas-show="true">
                <p class="text-[10px] text-slate-600 mb-2">
                    <i class="fas fa-bolt text-blue-600"></i>
                    Генерирано от <b>ITINERFLAI</b> - Вашият AI Туристически Архитект
                </p>
                <p class="text-[8px] text-slate-400">
                    itinerflai.com | Създадено на ${new Date().toLocaleDateString('bg-BG')}
                </p>
            </div>
        </div>`;
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
    
    // Проверка за PDF бутона и share бутоните след рендериране
    checkUserForPDF().then(user => {
        const pdfBtn = document.getElementById('pdfButton');
        const shareButtons = document.getElementById('shareButtons');
        
        if (user) {
            // Логнат потребител - показва share бутоните
            if (shareButtons) shareButtons.classList.remove('hidden');
        } else {
            // Гост - disable PDF и скрива share бутоните
            if (pdfBtn) {
                pdfBtn.disabled = true;
                pdfBtn.classList.add('opacity-50', 'cursor-not-allowed');
                pdfBtn.title = 'Влезте в профила си за да експортвате в PDF';
            }
            if (shareButtons) shareButtons.classList.add('hidden');
        }
    });
}

/**
 * Обработка на PDF клик
 */
window.handlePDFClick = async function(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    
    if (!user) {
        const shouldLogin = confirm(
            "🔒 PDF експорт е достъпен само за регистрирани потребители!\n\n" +
            "✨ Влезте в профила си или се регистрирайте безплатно за да:\n" +
            "• Изтегляте програмите си в PDF формат\n" +
            "• Запазвате неограничен брой планове\n" +
            "• Достъпвате ги от всяко устройство\n\n" +
            "Искате ли да се влезете/регистрирате сега?"
        );
        
        if (shouldLogin) {
            openModal();
        }
        return;
    }
    
    // Ако е логнат, извиква PDF функцията
    saveToPDF(dest);
}

/**
 * ЕКСПОРТ И ЗАПИС
 */
window.saveToPDF = async function(n) {
    const el = document.getElementById('pdfArea');
    if (!el) {
        alert('Грешка: Не може да се намери програмата за експорт!');
        return;
    }
    
    // Показване на loading индикатор
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdfLoading';
    loadingDiv.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.95); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
            <div style="background: white; padding: 40px; border-radius: 24px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                <div style="width: 60px; height: 60px; border: 6px solid #3b82f6; border-top-color: transparent; border-radius: 50%; margin: 0 auto 20px; animation: spin 1s linear infinite;"></div>
                <p style="color: #1e293b; font-weight: bold; font-size: 16px; margin-bottom: 8px;">Генериране на PDF...</p>
                <p style="color: #64748b; font-size: 12px;">Моля изчакайте, създаваме вашия документ</p>
            </div>
        </div>
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
        </style>
    `;
    document.body.appendChild(loadingDiv);
    
    try {
        // Премахване на data-html2canvas-ignore атрибутите
        const ignoreElements = el.querySelectorAll('[data-html2canvas-ignore]');
        ignoreElements.forEach(elem => {
            elem.dataset.originalDisplay = elem.style.display;
            elem.style.display = 'none';
        });
        
        // Показване на footer
        const footerElements = el.querySelectorAll('[data-html2canvas-show]');
        footerElements.forEach(elem => {
            elem.dataset.originalDisplay = elem.style.display || '';
            elem.style.display = 'block';
        });
        
        // Премахване на line-clamp за пълен текст
        const clampedElements = el.querySelectorAll('.line-clamp-2');
        clampedElements.forEach(elem => {
            elem.classList.remove('line-clamp-2');
            elem.dataset.hadClamp = 'true';
        });
        
        // Временно премахване на padding от pdfArea за правилно PDF генериране
        const originalPadding = el.style.paddingBottom;
        el.style.paddingBottom = '0';
        
        const opt = {
            margin: [8, 10, 8, 10],
            filename: `ITINERFLAI_${n}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { 
                type: 'jpeg', 
                quality: 0.95
            },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true,
                allowTaint: false,
                backgroundColor: '#ffffff',
                imageTimeout: 15000,
                windowHeight: el.scrollHeight,
                y: 0
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait',
                compress: true
            },
            pagebreak: { 
                mode: ['avoid-all', 'css'],
                before: ['.text-2xl'],
                after: [],
                avoid: ['img', '.bg-white', '.rounded-\\[2\\.5rem\\]', '.shadow-md']
            }
        };
        
        await html2pdf().set(opt).from(el).save();
        
        // Връщане на padding
        el.style.paddingBottom = originalPadding;
        
        // Връщане на оригиналния вид
        ignoreElements.forEach(elem => {
            elem.style.display = elem.dataset.originalDisplay || '';
            delete elem.dataset.originalDisplay;
        });
        
        footerElements.forEach(elem => {
            elem.style.display = elem.dataset.originalDisplay || '';
            delete elem.dataset.originalDisplay;
        });
        
        clampedElements.forEach(elem => {
            if (elem.dataset.hadClamp) {
                elem.classList.add('line-clamp-2');
                delete elem.dataset.hadClamp;
            }
        });
        
        // Премахване на loading индикатор с успех съобщение
        loadingDiv.querySelector('div > div').innerHTML = `
            <div style="width: 60px; height: 60px; background: #10b981; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-check" style="color: white; font-size: 30px;"></i>
            </div>
            <p style="color: #1e293b; font-weight: bold; font-size: 16px; margin-bottom: 8px;">PDF създаден успешно!</p>
            <p style="color: #64748b; font-size: 12px;">Файлът се изтегля автоматично</p>
        `;
        
        setTimeout(() => {
            document.getElementById('pdfLoading')?.remove();
        }, 1500);
        
    } catch (error) {
        console.error('PDF грешка:', error);
        loadingDiv.querySelector('div > div').innerHTML = `
            <div style="width: 60px; height: 60px; background: #ef4444; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-times" style="color: white; font-size: 30px;"></i>
            </div>
            <p style="color: #1e293b; font-weight: bold; font-size: 16px; margin-bottom: 8px;">Грешка при създаване!</p>
            <p style="color: #64748b; font-size: 12px;">Моля опитайте отново</p>
        `;
        
        setTimeout(() => {
            document.getElementById('pdfLoading')?.remove();
        }, 2000);
    }
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Моля, влезте в профила!");
    
    const content = document.getElementById('pdfArea').innerHTML;
    const { error } = await sbClient.from('itineraries').insert([{ 
        user_id: user.id, 
        destination: dest, 
        content: content 
    }]);
    
    if (!error) {
        alert("Запазено! ✨"); 
        loadUserItineraries();
    } else {
        alert("Грешка при запис: " + error.message);
    }
}

/**
 * EVENT LISTENERS
 */
document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
    
    // Задаване на текущата година
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    // Затваряне на модала при клик извън него
    window.onclick = function(event) {
        const modal = document.getElementById('authModal');
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});

/**
 * MODAL ФУНКЦИИ
 */
window.openModal = function() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = "block";
};

window.closeModal = function() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = "none";
};

/**
 * ЕЗИКОВА ФУНКЦИЯ
 */
const translations = {
    bg: {
        'hero-tag': 'Бъдещето на пътуванията',
        'hero-title': 'Твоят личен AI архитект',
        'hero-desc': 'Създаваме перфектния план за теб само за секунди с ITINERFLAI.',
        'dest': 'Дестинация',
        'dest-placeholder': 'напр. Париж, Лондон, Рим...',
        'date': 'Начална дата',
        'days': 'Дни',
        'style': 'Стил',
        'style-balanced': 'Балансиран',
        'style-dynamic': 'Динамичен',
        'style-relaxed': 'Релаксиращ',
        'travelers': 'Пътуващи',
        'budget': 'Бюджет',
        'currency': 'Валута',
        'btn-generate': 'Генерирай план',
        'login': 'Вход',
        'my-trips': 'Моите запазени програми',
        'loading': 'AI планира...',
        'benefits-title': 'Защо да се регистрирам?',
        'benefits-desc': 'Отключи пълния потенциал на ITINERFLAI',
        'icon-routes': 'Маршрути',
        'icon-restaurants': 'Ресторанти',
        'icon-hotels': 'Хотели',
        'icon-attractions': 'Атракции',
        'auth-title': 'Вход',
        'auth-email': 'Email',
        'auth-password': 'Парола',
        'auth-main-btn': 'Влез',
        'auth-toggle-btn': 'Регистрация',
        'auth-close': 'Затвори',
        'benefit-unlimited-title': 'Неограничени програми',
        'benefit-unlimited-desc': 'Създавай колкото искаш пътни планове',
        'benefit-cloud-title': 'Облачно запазване',
        'benefit-cloud-desc': 'Достъп от всяко устройство, по всяко време',
        'benefit-pdf-title': 'PDF експорт',
        'benefit-pdf-desc': 'Изтегляй и споделяй програмите си',
        'benefit-cta': 'Започни безплатно',
        'benefit-note': 'Без кредитна карта • Регистрация за секунди',
        'placeholder-title': 'Готови за приключение?',
        'placeholder-desc': 'Попълнете формата отляво и нашият AI ще създаде перфектния пътен план специално за вас за секунди! ✨',
        'footer-tagline': 'Вашият AI туристически архитект',
        'footer-contact': 'Свържете се с нас',
        'footer-rights': 'Всички права запазени',
        'footer-powered': 'Създадено с ❤️ и AI технология',
        'destinations-title': 'Примерни дестинации',
        'destinations-desc': 'Вдъхновете се от нашите готови AI-генерирани пътни програми за най-популярните дестинации в света',
        'dest-paris-title': 'Париж',
        'dest-paris-subtitle': 'Градът на светлината',
        'dest-paris-desc': '2-дневна романтична програма из сърцето на Франция. Ейфелова кула, Лувър, Нотр Дам и автентични френски ресторанти.',
        'dest-dubai-title': 'Дубай',
        'dest-dubai-subtitle': 'Градът на бъдещето',
        'dest-dubai-desc': '2-дневна луксозна програма в най-модерния град. Бурж Халифа, Desert Safari, Mall of Emirates и световна кухня.',
        'dest-tokyo-title': 'Токио',
        'dest-tokyo-subtitle': 'Където традиция среща технология',
        'dest-tokyo-desc': '2-дневна културна програма в столицата на Япония. Храмове, неонови улици, суши пазари и технологични чудеса.',
        'dest-days': '2 дни',
        'dest-people': '2 души',
        'back-home': 'Назад към началото',
        'footer-terms': 'Общи условия',
        'footer-privacy': 'Политика за поверителност',
        'terms-title': 'Общи условия',
        'terms-updated': 'Последна актуализация: Февруари 2026 г.',
        'terms-service-title': '1. Описание на услугата',
        'terms-service-desc': 'ITINERFLAI е базирана на изкуствен интелект платформа за генериране на примерни туристически маршрути. Информацията се генерира в реално време чрез технологията на OpenAI.',
        'terms-liability-title': '2. Ограничаване на отговорността',
        'terms-liability-desc': 'Генерираните маршрути са само с информативна цел. ITINERFLAI не гарантира точността на работно време, цени или наличност на обектите. Потребителите трябва да потвърждават информацията директно с доставчиците на услуги.',
        'terms-affiliate-title': '3. Партньорски връзки (Affiliate Disclosure)',
        'terms-affiliate-desc': 'Сайтът съдържа афилиейт линкове към Booking.com и други партньори. При резервация чрез тези линкове, ние може да получим комисионна без допълнителни разходи за Вас.',
        'terms-usage-title': '4. Използване на платформата',
        'terms-usage-desc': 'Регистрирайки се в ITINERFLAI, Вие се съгласявате да използвате платформата само за легални цели и да не злоупотребявате с генерираното съдържание.',
        'terms-data-title': '5. Данни и поверителност',
        'terms-data-desc': 'Вашите лични данни се обработват съгласно нашата <a href="privacy.html" class="text-blue-600 underline">Политика за поверителност</a> и в съответствие с GDPR разпоредбите.',
        'terms-law-title': '6. Приложимо право',
        'terms-law-desc': 'Тези условия се регулират от законите на Република България и Европейския съюз.',
        'terms-contact-title': '7. Контакт',
        'terms-contact-desc': 'За въпроси относно тези условия, моля свържете се с нас на:',
        'privacy-title': 'Политика за поверителност',
        'privacy-updated': 'Последна актуализация: Февруари 2026 г.',
        'privacy-collect-title': '1. Информация, която събираме',
        'privacy-collect-intro': 'В <strong>ITINERFLAI</strong> събираме минимално количество данни, необходими за предоставяне на нашите AI услуги:',
        'privacy-collect-account': 'Информация за акаунта:',
        'privacy-collect-account-desc': 'Имейл адрес (чрез Supabase), ако решите да се регистрирате.',
        'privacy-collect-queries': 'Заявки за търсене:',
        'privacy-collect-queries-desc': 'Дестинации и дати на пътуване, предоставени за генериране на маршрути.',
        'privacy-collect-usage': 'Данни за употреба:',
        'privacy-collect-usage-desc': 'Бисквитки (cookies) и анализи за подобряване на работата на сайта.',
        'privacy-use-title': '2. Как използваме Вашите данни',
        'privacy-use-intro': 'Вашите данни се използват за:',
        'privacy-use-itinerary': 'Генериране на персонализирани туристически маршрути чрез AI моделите на OpenAI (GPT).',
        'privacy-use-sync': 'Запазване и синхронизиране на Вашите планове за пътуване между различни устройства.',
        'privacy-use-recommend': 'Предоставяне на подходящи препоръки за хотели чрез нашите афилиейт партньори (напр. Booking.com).',
        'privacy-third-title': '3. Трети страни и услуги',
        'privacy-third-intro': 'Ние работим с доверени партньори за предоставяне на услугите ни:',
        'privacy-third-openai': 'Обработва заявките за търсене (анонимно), за да генерира текст.',
        'privacy-third-supabase': 'Осигурява сигурна аутентикация и съхранение на базата данни.',
        'privacy-third-affiliate': 'Използват се за проследяване на афилиейт линкове и резервации.',
        'privacy-cookies-title': '4. Бисквитки (Cookies)',
        'privacy-cookies-desc': 'Използваме основни бисквитки, за да поддържаме сесията Ви активна, както и проследяващи бисквитки на нашите партньори, за да получим комисионна за направени резервации. Можете да изключите бисквитките от настройките на Вашия браузър по всяко време.',
        'privacy-security-title': '5. Сигурност на данните',
        'privacy-security-desc': 'Вашите данни се съхраняват сигурно чрез Supabase и се защитават с индустриални стандарти за криптиране. Ние не споделяме Вашата лична информация с трети страни без Ваше съгласие.',
        'privacy-rights-title': '6. Вашите права (GDPR)',
        'privacy-rights-desc': 'Съгласно GDPR разпоредбите, Вие имате право на:',
        'privacy-rights-access': 'Достъп до Вашите лични данни',
        'privacy-rights-correct': 'Коригиране на неточни данни',
        'privacy-rights-delete': 'Изтриване на Вашия акаунт и данни',
        'privacy-rights-export': 'Експортиране на Вашите данни',
        'privacy-contact-title': '7. Контакт с нас',
        'privacy-contact-desc': 'Ако имате въпроси относно тази политика, можете да се свържете с нас на:'
    },
    en: {
        'hero-tag': 'The Future of Travel',
        'hero-title': 'Your Personal AI Architect',
        'hero-desc': 'We create the perfect plan for you in seconds with ITINERFLAI.',
        'dest': 'Destination',
        'dest-placeholder': 'e.g. Paris, London, Rome...',
        'date': 'Start Date',
        'days': 'Days',
        'style': 'Style',
        'style-balanced': 'Balanced',
        'style-dynamic': 'Dynamic',
        'style-relaxed': 'Relaxed',
        'travelers': 'Travelers',
        'budget': 'Budget',
        'currency': 'Currency',
        'btn-generate': 'Generate Plan',
        'login': 'Login',
        'my-trips': 'My Saved Itineraries',
        'loading': 'AI is planning...',
        'benefits-title': 'Why register?',
        'benefits-desc': 'Unlock the full potential of ITINERFLAI',
        'icon-routes': 'Routes',
        'icon-restaurants': 'Restaurants',
        'icon-hotels': 'Hotels',
        'icon-attractions': 'Attractions',
        'auth-title': 'Login',
        'auth-email': 'Email',
        'auth-password': 'Password',
        'auth-main-btn': 'Login',
        'auth-toggle-btn': 'Register',
        'auth-close': 'Close',
        'benefit-unlimited-title': 'Unlimited Plans',
        'benefit-unlimited-desc': 'Create as many travel plans as you want',
        'benefit-cloud-title': 'Cloud Storage',
        'benefit-cloud-desc': 'Access from any device, anytime',
        'benefit-pdf-title': 'PDF Export',
        'benefit-pdf-desc': 'Download and share your itineraries',
        'benefit-cta': 'Start for Free',
        'benefit-note': 'No credit card • Sign up in seconds',
        'placeholder-title': 'Ready for Adventure?',
        'placeholder-desc': 'Fill out the form on the left and our AI will create the perfect travel plan just for you in seconds! ✨',
        'footer-tagline': 'Your AI Travel Architect',
        'footer-contact': 'Contact Us',
        'footer-rights': 'All Rights Reserved',
        'footer-powered': 'Built with ❤️ and AI Technology',
        'destinations-title': 'Sample Destinations',
        'destinations-desc': 'Get inspired by our ready-made AI-generated travel programs for the world\'s most popular destinations',
        'dest-paris-title': 'Paris',
        'dest-paris-subtitle': 'The City of Light',
        'dest-paris-desc': '2-day romantic program through the heart of France. Eiffel Tower, Louvre, Notre Dame and authentic French restaurants.',
        'dest-dubai-title': 'Dubai',
        'dest-dubai-subtitle': 'The City of the Future',
        'dest-dubai-desc': '2-day luxury program in the most modern city. Burj Khalifa, Desert Safari, Mall of Emirates and world cuisine.',
        'dest-tokyo-title': 'Tokyo',
        'dest-tokyo-subtitle': 'Where Tradition Meets Technology',
        'dest-tokyo-desc': '2-day cultural program in the capital of Japan. Temples, neon streets, sushi markets and technological wonders.',
        'dest-days': '2 days',
        'dest-people': '2 people',
        'back-home': 'Back to Home',
        'footer-terms': 'Terms of Service',
        'footer-privacy': 'Privacy Policy',
        'terms-title': 'Terms of Service',
        'terms-updated': 'Last Updated: February 2026',
        'terms-service-title': '1. Service Description',
        'terms-service-desc': 'ITINERFLAI is an AI-powered platform for generating sample travel itineraries. Information is generated in real-time using OpenAI technology.',
        'terms-liability-title': '2. Limitation of Liability',
        'terms-liability-desc': 'Generated itineraries are for informational purposes only. ITINERFLAI does not guarantee the accuracy of opening hours, prices, or availability of venues. Users must confirm information directly with service providers.',
        'terms-affiliate-title': '3. Affiliate Links (Disclosure)',
        'terms-affiliate-desc': 'The site contains affiliate links to Booking.com and other partners. When booking through these links, we may receive a commission at no additional cost to you.',
        'terms-usage-title': '4. Platform Usage',
        'terms-usage-desc': 'By registering with ITINERFLAI, you agree to use the platform only for legal purposes and not to misuse the generated content.',
        'terms-data-title': '5. Data and Privacy',
        'terms-data-desc': 'Your personal data is processed according to our <a href="privacy.html" class="text-blue-600 underline">Privacy Policy</a> and in compliance with GDPR regulations.',
        'terms-law-title': '6. Governing Law',
        'terms-law-desc': 'These terms are governed by the laws of the Republic of Bulgaria and the European Union.',
        'terms-contact-title': '7. Contact',
        'terms-contact-desc': 'For questions about these terms, please contact us at:',
        'privacy-title': 'Privacy Policy',
        'privacy-updated': 'Last Updated: February 2026',
        'privacy-collect-title': '1. Information We Collect',
        'privacy-collect-intro': 'At <strong>ITINERFLAI</strong>, we collect minimal data necessary to provide our AI services:',
        'privacy-collect-account': 'Account Information:',
        'privacy-collect-account-desc': 'Email address (via Supabase) if you choose to register.',
        'privacy-collect-queries': 'Search Queries:',
        'privacy-collect-queries-desc': 'Destinations and travel dates provided to generate itineraries.',
        'privacy-collect-usage': 'Usage Data:',
        'privacy-collect-usage-desc': 'Cookies and analytics to improve site performance.',
        'privacy-use-title': '2. How We Use Your Data',
        'privacy-use-intro': 'Your data is used to:',
        'privacy-use-itinerary': 'Generate personalized travel itineraries using OpenAI GPT models.',
        'privacy-use-sync': 'Save and sync your travel plans across devices.',
        'privacy-use-recommend': 'Provide relevant hotel recommendations via affiliate partners (e.g., Booking.com).',
        'privacy-third-title': '3. Third-Party Services',
        'privacy-third-intro': 'We work with trusted partners to deliver our services:',
        'privacy-third-openai': 'Processes search queries (anonymously) to generate text.',
        'privacy-third-supabase': 'Provides secure authentication and database storage.',
        'privacy-third-affiliate': 'Used for affiliate link tracking and bookings.',
        'privacy-cookies-title': '4. Cookies',
        'privacy-cookies-desc': 'We use essential cookies to keep you logged in and tracking cookies from our partners to receive commissions for bookings. You can disable cookies in your browser settings at any time.',
        'privacy-security-title': '5. Data Security',
        'privacy-security-desc': 'Your data is stored securely via Supabase and protected with industry-standard encryption. We do not share your personal information with third parties without your consent.',
        'privacy-rights-title': '6. Your Rights (GDPR)',
        'privacy-rights-desc': 'Under GDPR regulations, you have the right to:',
        'privacy-rights-access': 'Access your personal data',
        'privacy-rights-correct': 'Correct inaccurate data',
        'privacy-rights-delete': 'Delete your account and data',
        'privacy-rights-export': 'Export your data',
        'privacy-contact-title': '7. Contact Us',
        'privacy-contact-desc': 'If you have questions about this policy, please contact us at:'
    }
};

window.setLanguage = function(lang) {
    currentLanguage = lang;
    
    // Промяна на активния език
    document.querySelectorAll('[id^="lang-"]').forEach(btn => {
        btn.classList.remove('lang-active');
        btn.classList.add('text-slate-500');
    });
    document.getElementById('lang-' + lang).classList.add('lang-active');
    document.getElementById('lang-' + lang).classList.remove('text-slate-500');
    
    // Прилагане на преводите
    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        if (translations[lang][key]) {
            elem.textContent = translations[lang][key];
        }
    });
    
    // Превод на placeholder текстове
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            elem.placeholder = translations[lang][key];
        }
    });
    
    // Превод на option елементи
    document.querySelectorAll('[data-i18n-option]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-option');
        if (translations[lang][key]) {
            elem.textContent = translations[lang][key];
        }
    });
};

/**
 * ФУНКЦИИ ЗА СПОДЕЛЯНЕ
 */
window.shareToFacebook = function(dest) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Вижте моята пътна програма за ${dest}! 🌍✨`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'width=600,height=400');
};

window.shareToTwitter = function(dest) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Вижте моята пътна програма за ${dest} създадена с ITINERFLAI! 🌍✨`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
};

window.shareToLinkedIn = function(dest) {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=600,height=400');
};

window.shareViaCopy = function(dest) {
    const url = window.location.href;
    
    // Модерен начин за копиране
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            // Показване на success съобщение
            const btn = document.querySelector('[onclick*="shareViaCopy"]');
            if (btn) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check text-sm"></i>';
                btn.classList.add('bg-green-600');
                btn.classList.remove('bg-slate-700');
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.classList.remove('bg-green-600');
                    btn.classList.add('bg-slate-700');
                }, 2000);
            }
        }).catch(err => {
            // Fallback метод
            copyTextFallback(url);
        });
    } else {
        // Fallback за стари браузъри
        copyTextFallback(url);
    }
};

function copyTextFallback(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        const btn = document.querySelector('[onclick*="shareViaCopy"]');
        if (btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check text-sm"></i>';
            btn.classList.add('bg-green-600');
            btn.classList.remove('bg-slate-700');
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('bg-green-600');
                btn.classList.add('bg-slate-700');
            }, 2000);
        }
    } catch (err) {
        alert('Моля копирайте линка ръчно: ' + text);
    }
    document.body.removeChild(textArea);
}
