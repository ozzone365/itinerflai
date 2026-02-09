let S_URL, S_KEY, O_KEY, sbClient;

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

init();

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
            const isLogin = authTitle.innerText.includes('Вход');
            if (isLogin) {
                authTitle.innerText = 'Регистрация';
                mainBtn.innerText = 'Регистрирай се';
                toggleBtn.innerText = 'Вече имам профил';
            } else {
                authTitle.innerText = 'Вход';
                mainBtn.innerText = 'Влез';
                toggleBtn.innerText = 'Регистрация';
            }
        };
        
        mainBtn.onclick = async () => {
            const email = document.getElementById('authEmail').value;
            const pass = document.getElementById('authPassword').value;
            const isReg = authTitle.innerText.includes('Регистрация');
            
            try {
                const { error } = isReg 
                    ? await sbClient.auth.signUp({ email, password: pass })
                    : await sbClient.auth.signInWithPassword({ email, password: pass });
                
                if (error) throw error;
                
                // Скриваме модала при успех
                const modal = document.getElementById('authModal');
                if (modal) modal.style.display = 'none'; 
                
                checkUser();
            } catch (err) { 
                alert(err.message); 
            }
        };
    }
}

async function checkUser() {
    const { data: { user } } = await sbClient.auth.getUser();
    const statusDiv = document.getElementById('userStatus');
    const benefitsBox = document.getElementById('benefitsBox');
    
    if (user && statusDiv) {
        statusDiv.innerHTML = `
            <div class="flex items-center gap-3 bg-slate-800 p-2 px-4 rounded-xl border border-slate-700">
                <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">${user.email}</span>
                <button onclick="sbClient.auth.signOut().then(() => location.reload())" class="text-white hover:text-red-500 transition px-2">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>`;
        
        // Скриване на benefitsBox при влязъл потребител
        if (benefitsBox) benefitsBox.classList.add('hidden');
        
        loadUserItineraries(); 
    } else {
        // Показване на benefitsBox при невлязъл потребител
        if (benefitsBox) benefitsBox.classList.remove('hidden');
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
    if (!container) return;

    if (data && data.length > 0) {
        container.innerHTML = data.map(item => `
            <div class="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between group hover:border-blue-500 transition h-full">
                <div class="mb-4">
                    <h5 class="text-white font-bold text-base uppercase tracking-tight mb-2">${item.destination}</h5>
                    <p class="text-[9px] text-slate-500">
                        <i class="fas fa-calendar-alt mr-1"></i>
                        ${new Date(item.created_at).toLocaleDateString('bg-BG')}
                    </p>
                </div>
                <div class="flex gap-2">
                    <button onclick="viewSaved('${item.id}')" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-500 transition">
                        <i class="fas fa-eye mr-1"></i> Преглед
                    </button>
                    <button onclick="deleteSaved('${item.id}')" class="bg-red-500/20 text-red-400 p-2 px-3 rounded-xl text-[10px] hover:bg-red-500 hover:text-white transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } else {
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
 * AI ГЕНЕРИРАНЕ: OpenAI Integration
 */
async function generatePlan(e) {
    e.preventDefault();
    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    
    const placeholder = document.getElementById('placeholder');
    if (placeholder) placeholder.classList.add('hidden');
    
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Направи елитен план за ${dest} за ${days} дни на БЪЛГАРСКИ. БЕЗ СИМВОЛИ # ИЛИ *. 
    ХОТЕЛ: [Име] (Дай 4 такива в началото)
    ДЕН: [Номер]
    ☕ЗАКУСКА: [Име] - [Описание]
    🏛️ [Име] - [Описание]
    🏛️ [Име] - [Описание]
    🍴 ОБЯД: [Име] - [Описание]
    📸 [Име] - [Описание]
    📸 [Име] - [Описание]
    🌙 ВЕЧЕРЯ: [Име] - [Описание]`;

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
                    {role: "system", content: "Ти си професионален гид. Всеки обект на нов ред с емоджи и описание след тире."},
                    {role: "user", content: prompt}
                ]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) {
        alert("Грешка при генериране на плана!");
    } finally {
        document.getElementById('loader').classList.add('hidden');
    }
}

/**
 * UI РЕНДЕРИРАНЕ: Превръщане на текста в HTML карти
 */
function renderUI(dest, md) {
    const res = document.getElementById('result');
    let hotelsHtml = ""; let programHtml = ""; let hCount = 0;
    
    const lines = md.replace(/[*#]/g, '').split('\n').filter(l => l.trim() !== "");

    lines.forEach(line => {
        const l = line.trim(); 
        const upper = l.toUpperCase();
        
        if (upper.startsWith('ХОТЕЛ:') && hCount < 4) {
            const name = l.split(':')[1].trim();
            const hotelUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest + " " + name)}&aid=701816`;
            hotelsHtml += `
                <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100 shadow-sm">
                    <div>
                        <p class="text-[8px] font-black text-blue-600 uppercase mb-0.5">Настаняване</p>
                        <p class="font-bold text-slate-800 text-[11px] leading-tight">${name}</p>
                    </div>
                    <a href="${hotelUrl}" target="_blank" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-md flex-shrink-0">Резервирай</a>
                </div>`;
            hCount++;
        }
        else if (upper.includes('ДЕН:')) {
            programHtml += `<div class="text-2xl font-black text-slate-900 border-b-4 border-blue-600/20 mt-10 mb-6 uppercase italic pb-1">${l}</div>`;
        }
        else if (/[\u{1F300}-\u{1F9FF}]/u.test(l)) {
            const parts = l.split('-'); 
            const title = parts[0].trim(); 
            const desc = parts[1] ? parts[1].trim() : "";
            const cleanTitle = title.replace(/[\u{1F300}-\u{1F9FF}]/u, '').trim();
            const gMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest + " " + cleanTitle)}`;
            
            programHtml += `
                <div class="bg-white p-5 rounded-[2.5rem] shadow-md border border-slate-50 mb-4 flex justify-between items-center group transition hover:border-blue-200" style="page-break-inside: avoid;">
                    <div class="flex flex-col pr-4">
                        <b class="text-slate-900 font-extrabold text-base block mb-0.5 tracking-tight">${title}</b>
                        <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-2">${desc}</p>
                    </div>
                    <a href="${gMapsUrl}" target="_blank" class="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:bg-blue-600 transition">
                        <i class="fas fa-map-marker-alt text-sm"></i>
                    </a>
                </div>`;
        }
    });

    res.innerHTML = `
        <div id="pdfArea" class="max-w-5xl mx-auto pb-24 bg-white p-4 md:p-8 rounded-[4rem]">
            <div class="bg-slate-900 p-8 rounded-[2.5rem] text-white mb-10 flex justify-between items-center shadow-xl border-b-[8px] border-blue-600">
                <div>
                    <h2 class="text-3xl font-black italic uppercase tracking-tighter">${dest}</h2>
                    <p class="text-[9px] opacity-50 tracking-[0.3em] font-light">PREMIUM GUIDE</p>
                </div>
                <div class="flex gap-2" data-html2canvas-ignore="true">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">PDF</button>
                </div>
            </div>
            <div class="mb-10 px-2">
                <h4 class="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em] italic border-l-4 border-blue-500 pl-3">НАСТАНЯВАНЕ</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${hotelsHtml}</div>
            </div>
            <div class="px-2">${programHtml}</div>
        </div>`;
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
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
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; border-radius: 20px; text-align: center;">
                <div style="width: 50px; height: 50px; border: 5px solid #3b82f6; border-top-color: transparent; border-radius: 50%; margin: 0 auto 20px; animation: spin 1s linear infinite;"></div>
                <p style="color: #1e293b; font-weight: bold; font-size: 14px;">Генериране на PDF...</p>
            </div>
        </div>
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
        </style>
    `;
    document.body.appendChild(loadingDiv);
    
    try {
        const opt = {
            margin: [15, 10, 15, 10],
            filename: n + '_itinerary.pdf',
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { 
                scale: 2, 
                useCORS: true,
                logging: false,
                scrollY: -window.scrollY,
                windowWidth: el.scrollWidth,
                windowHeight: el.scrollHeight
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait',
                compress: true
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        
        await html2pdf().set(opt).from(el).save();
        
        // Премахване на loading индикатор
        setTimeout(() => {
            document.getElementById('pdfLoading')?.remove();
        }, 500);
        
    } catch (error) {
        console.error('PDF грешка:', error);
        alert('Възникна грешка при генерирането на PDF файла!');
        document.getElementById('pdfLoading')?.remove();
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
window.setLanguage = function(lang) {
    // Промяна на активния език
    document.querySelectorAll('[id^="lang-"]').forEach(btn => {
        btn.classList.remove('lang-active');
        btn.classList.add('text-slate-500');
    });
    document.getElementById('lang-' + lang).classList.add('lang-active');
    document.getElementById('lang-' + lang).classList.remove('text-slate-500');
    
    // Тук можете да добавите логика за превод
};
