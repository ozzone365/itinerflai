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
    if (!O_KEY) return alert("Системата се зарежда...");

    const dest = document.getElementById('destination').value;
    const style = document.getElementById('travelStyle').value;
    const days = document.getElementById('days').value;
    const lang = document.getElementById('langSwitch').value;

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('result').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    // ТУК ДОБАВИ ТВОЯ АФИЛИЕЙТ ID
    const affId = "ТВОЯ_ID"; 

    const prompt = `Направи професионален и визуален туристически план за ${dest} за ${days} дни, стил: ${style}. 
    Език: ${lang === 'bg' ? 'Български' : 'English'}.
    
    СТРУКТУРА ЗА ВСЕКИ ДЕН:
    - Заглавие: "Ден X: [Име на темата]"
    - Закуска, Обяд и Вечеря: Конкретни места с описание.
    - Забележителности: С кратки любопитни факти.
    
    ВАЖНО: 
    1. За всеки хотел или апартамент добавяй линк: [Виж тук](https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId})
    2. За всяка забележителност добавяй линк към Google Maps: [Карта](https://www.google.com/maps/search/${dest}+[име])
    3. Използвай Markdown за заглавия (###) и подчертаване (**).`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си професионален травъл дизайнер. Отговаряш в красив Markdown формат."}, 
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
    
    // Превръщаме Markdown символите в красиви икони и лесно четим текст
    const formattedContent = content
        .replace(/###/g, '<h3 class="text-xl font-black text-blue-600 mt-6 mb-2 uppercase italic">')
        .replace(/Закуска:/g, '<span><i class="fas fa-coffee mr-2 text-orange-400"></i><b>Закуска:</b></span>')
        .replace(/Обяд:/g, '<span><i class="fas fa-utensils mr-2 text-emerald-500"></i><b>Обяд:</b></span>')
        .replace(/Вечеря:/g, '<span><i class="fas fa-moon mr-2 text-purple-500"></i><b>Вечеря:</b></span>');

    res.innerHTML = `
        <div id="pdfArea" class="animate-fade-in space-y-6">
            <div class="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl flex justify-between items-center border-b-4 border-blue-600">
                <div>
                    <h2 class="text-4xl font-black uppercase italic tracking-tighter">${dest}</h2>
                    <p class="text-[10px] opacity-60 uppercase tracking-widest mt-1">Персонализиран AI План</p>
                </div>
                <div class="bg-blue-600 p-4 rounded-2xl shadow-lg">
                    <i class="fas fa-route text-2xl"></i>
                </div>
            </div>

            <div class="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl text-slate-700 leading-relaxed border border-slate-100">
                <div class="prose prose-blue max-w-none">
                    ${formattedContent}
                </div>
                
                <div class="mt-12 pt-8 border-t flex flex-col md:flex-row gap-4 justify-between items-center">
                    <button onclick="window.print()" class="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition">
                        <i class="fas fa-print mr-2"></i>Принтирай
                    </button>
                    
                    <button onclick="exportToPDF('${dest}')" class="bg-emerald-500 hover:bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition shadow-lg flex items-center gap-3">
                        <i class="fas fa-file-pdf text-lg"></i> Запази Програмата (PDF)
                    </button>
                </div>
            </div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

// Помощна функция за PDF
window.exportToPDF = function(name) {
    const element = document.getElementById('pdfArea');
    const opt = {
        margin: 10,
        filename: `${name}-itinerflai.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
};

