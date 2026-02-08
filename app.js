let S_URL, S_KEY, O_KEY, sbClient;

async function init() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        S_URL = config.supabaseUrl;
        S_KEY = config.supabaseKey;
        O_KEY = config.openaiKey;

        if (window.supabase && !sbClient) {
            sbClient = window.supabase.createClient(S_URL, S_KEY);
            setupAuth();
            checkUser(); // Проверява сесията веднага
        }
    } catch (e) { console.error("Грешка при старт:", e); }
}
init();

// --- ВХОД / РЕГИСТРАЦИЯ (С АВТОМАТИЧНО СКРИВАНЕ) ---
function setupAuth() {
    const btn = document.getElementById('realSubmitBtn');
    if (!btn) return;
    btn.onclick = async () => {
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPassword').value;
        const isReg = document.getElementById('authTitle').innerText === 'Регистрация';
        
        try {
            const { data, error } = isReg 
                ? await sbClient.auth.signUp({ email, password: pass })
                : await sbClient.auth.signInWithPassword({ email, password: pass });
            
            if (error) throw error;

            if (isReg) {
                alert("Проверете имейла си за потвърждение!");
            } else {
                // СКРИВА прозореца веднага
                document.getElementById('authModal').classList.add('hidden');
                checkUser(); // Обновява хедъра
            }
        } catch (err) { alert("Грешка: " + err.message); }
    };
}

// --- ПРОВЕРКА НА ПОТРЕБИТЕЛ И ОБНОВЯВАНЕ НА ХЕДЪРА ---
async function checkUser() {
    const { data: { user } } = await sbClient.auth.getUser();
    const statusDiv = document.getElementById('userStatus');
    if (user) {
        statusDiv.innerHTML = `
            <div class="flex items-center gap-4 bg-slate-900 p-2 px-4 rounded-2xl border border-slate-700 shadow-inner">
                <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">${user.email}</span>
                <button onclick="logout()" class="text-white hover:text-red-500 transition"><i class="fas fa-sign-out-alt"></i></button>
            </div>`;
        // Скриваме бутона "Вход", ако все още се вижда
        const loginTrigger = document.querySelector('[onclick*="authModal"]');
        if (loginTrigger) loginTrigger.classList.add('hidden');
    }
}

async function logout() {
    await sbClient.auth.signOut();
    location.reload();
}

// --- ГЕНЕРИРАНЕ НА ПРОГРАМА ---
async function generatePlan(e) {
    e.preventDefault();
    if (!O_KEY) return;

    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    const affId = "304442";

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Направи елитен план за ${dest} за ${days} дни. 
    ВАЖНО: Започни със секция ХОТЕЛИ: Дай 4 опции (Лукс, Бутик, Бюджет, Апартамент) с линкове https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    След това ПРОГРАМА за всеки ден в този формат:
    ### Ден [X]
    ☕ ЗАКУСКА: [Име] | [Линк]
    🏛️ СУТРИН: [Име] | [Линк]
    🍴 ОБЯД: [Име] | [Линк]
    📸 СЛЕДОБЕД: [Име] | [Линк]
    🌙 ВЕЧЕРЯ: [Име] | [Линк]`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си елитен травъл дизайнер. Пиши само по зададения формат."}, {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { 
        console.error(err);
        alert("Грешка при генериране."); 
    } finally { 
        document.getElementById('loader').classList.add('hidden'); 
    }
}

// --- ДИЗАЙН И РЕНДИРАНЕ ---
function renderUI(dest, md) {
    const res = document.getElementById('result');
    
    // Форматиране на Хотелите
    let formatted = md.replace(/(Лукс|Бутик|Бюджет|Апартамент): (.*?) \| (https:\/\/www\.booking\.com.*)/g, `
        <div class="bg-indigo-50/50 p-4 rounded-2xl flex justify-between items-center border border-indigo-100 shadow-sm">
            <div><p class="text-[9px] font-black text-indigo-500 uppercase">$1</p><p class="font-bold text-slate-800 text-xs">$2</p></div>
            <a href="$3" target="_blank" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-slate-900 transition">Резервирай</a>
        </div>
    `);

    // Форматиране на Програмата
    formatted = formatted
        .replace(/### (.*)/g, '<div class="text-xl font-black text-blue-600 border-b-2 border-blue-100 mt-12 mb-6 uppercase italic pb-2">$1</div>')
        .replace(/(☕|🏛️|🍴|📸|🌙) (.*?): (.*?) \| (.*)/g, `
            <div class="flex items-center justify-between py-4 border-b border-slate-50 hover:bg-slate-50/50 px-2 transition">
                <div class="flex items-center gap-4">
                    <span class="text-xl">$1</span>
                    <div><b class="text-[9px] uppercase text-slate-400 block tracking-widest">$2</b><span class="text-slate-800 font-bold text-sm">$3</span></div>
                </div>
                <a href="$4" target="_blank" class="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition"><i class="fas fa-map-marker-alt"></i></a>
            </div>
        `);

    res.innerHTML = `
        <div id="pdfArea" class="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border-t-[15px] border-blue-600 max-w-5xl mx-auto">
            <div class="bg-slate-900 p-8 rounded-[2.5rem] text-white mb-10 flex justify-between items-center border-b-4 border-blue-500">
                <div>
                    <h2 class="text-4xl font-black italic uppercase tracking-tighter">${dest}</h2>
                    <p class="text-[9px] opacity-40 uppercase tracking-[0.3em] mt-1">Premium AI Itinerary</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:scale-105 transition">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:scale-105 transition">PDF</button>
                </div>
            </div>
            
            <div class="mb-12">
                <h4 class="text-[11px] font-black uppercase text-indigo-500 mb-5 tracking-[0.2em] flex items-center gap-2">
                    <i class="fas fa-bed"></i> ПРЕПОРЪЧАНО НАСТАНЯВАНЕ
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${formatted.split('<div class="text-xl')[0]}</div>
            </div>

            <div class="itinerary-body">
                ${formatted.includes('<div class="text-xl') ? formatted.substring(formatted.indexOf('<div class="text-xl')) : ''}
            </div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

// --- PDF И ОБЛАК ---
window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'-itinerflai.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Моля, влезте в профила си!");
    const content = document.getElementById('pdfArea').innerHTML;
    const { error } = await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    if (error) alert("Грешка при запис."); else alert("Успешно запазено! ✨");
}

// Свързване на формата
document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
});
