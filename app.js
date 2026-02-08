// Проверяваме дали вече не е дефинирана, за да избегнем SyntaxError
if (typeof sbClient === 'undefined') {
    var S_URL, S_KEY, O_KEY, sbClient;
}

// Речник за преводи
const dictionary = {
    bg: {
        loginBtn: "Влез / Регистрация", 
        heroTitle: "Твоят личен", 
        heroSub: "AI Архитект",
        heroSlogan: "Открийте скритите съкровища на всяка дестинация с персонализиран маршрут, създаден за секунди.",
        iconHotels: "Хотели", iconFood: "Гурме", iconMap: "Програма", iconSmart: "Смарт",
        paramsTitle: "Параметри", labelDest: "Дестинация", labelDate: "Дата", labelDays: "Дни",
        labelTravelers: "Пътници", labelCurrency: "Валута", labelBudget: "Бюджет", labelStyle: "Стил",
        createBtn: "Създай План", benefitsTitle: "Предимства", benPdf: "PDF Експорт",
        benShare: "FB, X & WhatsApp", benCloud: "Облачен архив", placeholderTxt: "Очакваме дестинация...",
        modalTitle: "Вход", modalToggle: "Нямате акаунт? Регистрация"
    },
    en: {
        loginBtn: "Login / Register", 
        heroTitle: "Your Personal", 
        heroSub: "AI Architect",
        heroSlogan: "Discover the hidden gems of every destination with a personalized itinerary created in seconds.",
        iconHotels: "Hotels", iconFood: "Gourmet", iconMap: "Itinerary", iconSmart: "Smart",
        paramsTitle: "Parameters", labelDest: "Destination", labelDate: "Date", labelDays: "Days",
        labelTravelers: "Travelers", labelCurrency: "Currency", labelBudget: "Budget", labelStyle: "Style",
        createBtn: "Generate Plan", benefitsTitle: "Benefits", benPdf: "PDF Export",
        benShare: "FB, X & WhatsApp", benCloud: "Cloud Storage", placeholderTxt: "Awaiting destination...",
        modalTitle: "Login", modalToggle: "No account? Register"
    }
};

async function loadConfig() {
    try {
        console.log("Зареждане на конфигурация...");
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error("API Route not found");
        
        const config = await response.json();
        S_URL = config.supabaseUrl;
        S_KEY = config.supabaseKey;
        O_KEY = config.openaiKey;

        if (window.supabase) {
            sbClient = window.supabase.createClient(S_URL, S_KEY);
            console.log("Системата е готова и Supabase е свързан!");
            checkUser();
        } else {
            console.error("Supabase библиотеката не е заредена в HTML!");
        }
    } catch (err) {
        console.error("Критична грешка при зареждане:", err);
    }
}

window.updateLang = function() {
    const l = document.getElementById('langSwitch').value;
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (dictionary[l][key]) el.innerText = dictionary[l][key];
    });
};

async function checkUser() {
    if (!sbClient) return; 
    const { data: { user } } = await sbClient.auth.getUser();
    if (user) {
        const statusDiv = document.getElementById('userStatus');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="flex items-center gap-4 animate-fade-in">
                    <span class="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border border-blue-100">
                        <i class="fas fa-user mr-2"></i>${user.email.split('@')[0]}
                    </span>
                    <button onclick="logout()" class="text-red-500 hover:text-red-700 text-[10px] font-black uppercase underline transition">Изход</button>
                </div>`;
        }
    }
}

window.logout = async () => { 
    if (sbClient) await sbClient.auth.signOut(); 
    location.reload(); 
};

document.addEventListener('DOMContentLoaded', () => {
    loadConfig(); // Викаме го тук, когато DOM е готов

    const submitBtn = document.getElementById('realSubmitBtn');
    const toggleBtn = document.getElementById('toggleBtn');
    
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            const t = document.getElementById('authTitle');
            const lang = document.getElementById('langSwitch').value;
            const isLogin = t.innerText.includes("Вход") || t.innerText.includes("Login");
            t.innerText = isLogin ? (lang === 'bg' ? "Регистрация" : "Register") : (lang === 'bg' ? "Вход" : "Login");
            toggleBtn.innerText = isLogin ? (lang === 'bg' ? "Влез в акаунт" : "Back to Login") : (lang === 'bg' ? "Регистрация" : "Register");
        };
    }

    if (submitBtn) {
        submitBtn.onclick = async () => {
            if (!sbClient) return alert("Системата все още се зарежда...");
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const authTitle = document.getElementById('authTitle').innerText;
            const isReg = authTitle.includes("Регистр") || authTitle.includes("Register");
            
            try {
                const { data, error } = isReg 
                    ? await sbClient.auth.signUp({ email, password }) 
                    : await sbClient.auth.signInWithPassword({ email, password });
                
                if (error) throw error;
                if (isReg) alert("Успешно! Потвърдете имейла си.");
                else location.reload();
            } catch (e) { alert("Грешка: " + e.message); }
        };
    }

    const planForm = document.getElementById('planForm');
    if (planForm) planForm.onsubmit = generatePlan;
});

async function generatePlan(e) {
    e.preventDefault();
    if (!O_KEY) return alert("Системата все още се зарежда...");

    const dest = document.getElementById('destination').value;
    const style = document.getElementById('travelStyle').value;
    const days = document.getElementById('days').value;
    const lang = document.getElementById('langSwitch').value;

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('result').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    const affId = "ТВОЯ_ID"; // Сложи твоя афилиейт ID тук

    const prompt = `Направи луксозен туристически план за ${dest} за ${days} дни, стил: ${style}. 
    Език: ${lang === 'bg' ? 'Български' : 'English'}.
    
    СТРОГА СТРУКТУРА:
    ### Ден [X]: [Заглавие]
    [Кратко описание за деня]
    
    ХОТЕЛ: [Име на хотел]
    Линк за резервация: https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    
    ЗАКУСКА: [Място] - [Описание]
    ОБЯД: [Място] - [Описание]
    ВЕЧЕРЯ: [Място] - [Описание]
    
    ЗАБЕЛЕЖИТЕЛНОСТИ:
    - [Име]: [Инфо]. Карта: https://www.google.com/maps/search/${dest}+[име]`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си елитен травъл агент. Използвай главни букви за ЗАКУСКА, ОБЯД, ВЕЧЕРЯ и ХОТЕЛ."}, 
                           {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) {
        alert("Грешка при генериране.");
    } finally {
        document.getElementById('loader').classList.add('hidden');
    }
}
function renderUI(dest, content) {
    const res = document.getElementById('result');
    
    // Форматиране с икони и стил
    let html = content
        .replace(/### (.*)/g, '<div class="day-header mt-12 mb-6 text-2xl font-black text-blue-600 uppercase italic border-b-2 border-blue-100 pb-2">$1</div>')
        .replace(/ХОТЕЛ:/g, '<div class="bg-blue-50 p-4 rounded-2xl mb-4 border-l-4 border-blue-500"><b><i class="fas fa-hotel mr-2"></i>ПРЕПОРЪЧАН ХОТЕЛ:</b>')
        .replace(/ЗАКУСКА:/g, '<div class="mt-4"><b><i class="fas fa-coffee text-orange-400 mr-2"></i>ЗАКУСКА:</b>')
        .replace(/ОБЯД:/g, '<div class="mt-4"><b><i class="fas fa-utensils text-emerald-500 mr-2"></i>ОБЯД:</b>')
        .replace(/ВЕЧЕРЯ:/g, '<div class="mt-4"><b><i class="fas fa-moon text-purple-500 mr-2"></i>ВЕЧЕРЯ:</b>')
        .replace(/ЗАБЕЛЕЖИТЕЛНОСТИ:/g, '<div class="mt-6 font-black text-slate-400 uppercase text-xs tracking-widest">Топ локации за деня:</div>');

    res.innerHTML = `
        <div id="pdfArea" class="animate-fade-in">
            <div class="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl mb-8 flex justify-between items-end border-b-8 border-blue-600">
                <div>
                    <h2 class="text-5xl font-black uppercase italic tracking-tighter">${dest}</h2>
                    <p class="opacity-50 text-[10px] uppercase tracking-[0.3em] mt-2">Personalized AI Itinerary</p>
                </div>
                <div class="text-blue-500 text-4xl mb-2"><i class="fas fa-plane-departure"></i></div>
            </div>

            <div class="bg-white p-10 md:p-16 rounded-[4rem] shadow-xl text-slate-700 leading-relaxed border border-slate-50">
                <div class="itinerary-body">
                    ${html}
                </div>

                <div class="mt-16 pt-10 border-t border-slate-100 flex flex-col md:flex-row gap-6 items-center justify-between">
                    <button onclick="window.print()" class="text-slate-400 font-black uppercase text-[10px] hover:text-blue-600 transition">
                        <i class="fas fa-print mr-2"></i>Печат на страницата
                    </button>
                    
                    <button onclick="savePlan('${dest}')" class="bg-blue-600 hover:bg-slate-900 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-2xl hover:-translate-y-1">
                        <i class="fas fa-file-pdf mr-2"></i> Запази PDF Програма
                    </button>
                </div>
            </div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

// Помощна функция за PDF
window.savePlan = function(destName) {
    const element = document.getElementById('pdfArea');
    const options = {
        margin: 10,
        filename: `${destName}-plan.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(options).from(element).save();
};


