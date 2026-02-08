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
    if (!O_KEY) return alert("Системата се зарежда, моля изчакайте 2 секунди...");

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('result').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    const dest = document.getElementById('destination').value;
    const lang = document.getElementById('langSwitch').value;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "user", content: `Направи подробен туристически план за ${dest} на ${lang === 'bg' ? 'български' : 'английски'}. Включи хотели, ресторанти и забележителности.`}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) {
        alert("Грешка при генериране на плана.");
    } finally {
        document.getElementById('loader').classList.add('hidden');
    }
}

function renderUI(dest, content) {
    const res = document.getElementById('result');
    if (!res) return;
    res.innerHTML = `
        <div id="pdfArea" class="animate-fade-in">
            <div class="result-header flex justify-between items-center shadow-2xl mb-8 p-6 bg-slate-900 text-white rounded-3xl">
                <div>
                    <h2 class="text-4xl font-black uppercase italic">${dest}</h2>
                    <p class="text-[10px] opacity-70 uppercase tracking-widest mt-2">Генериран от ITINERFLAI AI</p>
                </div>
                <button onclick="html2pdf().from(document.getElementById('pdfArea')).save('${dest}-itinerflai.pdf')" class="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-white/40 transition">
                    <i class="fas fa-file-pdf text-xl"></i>
                </button>
            </div>
            <div class="bg-white p-10 rounded-[3rem] shadow-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                ${content}
            </div>
        </div>`;
    res.classList.remove('hidden');
}
