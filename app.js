// 1. КОНФИГУРАЦИЯ И СЪСТОЯНИЕ
let S_URL, S_KEY, O_KEY, sbClient;

async function init() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        S_URL = config.supabaseUrl;
        S_KEY = config.supabaseKey;
        O_KEY = config.openaiKey;

        if (window.supabase) {
            sbClient = window.supabase.createClient(S_URL, S_KEY);
            setupAuthHandlers();
            checkUser();
        }
    } catch (e) { console.error("Грешка при старт:", e); }
}
init();

// 2. АВТЕНТИКАЦИЯ (Фикс за бутона "Продължи")
function setupAuthHandlers() {
    const btn = document.getElementById('realSubmitBtn');
    if (btn) {
        btn.onclick = async () => {
            const email = document.getElementById('authEmail').value;
            const pass = document.getElementById('authPassword').value;
            const isReg = document.getElementById('toggleBtn').innerText.includes('Вход');
            
            try {
                const { data, error } = isReg 
                    ? await sbClient.auth.signUp({ email, password: pass })
                    : await sbClient.auth.signInWithPassword({ email, password: pass });
                
                if (error) throw error;
                alert(isReg ? "Проверете имейла си за потвърждение!" : "Успешен вход!");
                location.reload();
            } catch (err) { alert("Грешка: " + err.message); }
        };
    }
}

// 3. ГЕНЕРИРАНЕ НА ПРОГРАМА
async function generatePlan(e) {
    e.preventDefault();
    if (!O_KEY) return;

    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    const style = document.getElementById('travelStyle').value;
    const lang = document.getElementById('langSwitch').value;
    const affId = "304442";

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Създай подробен туристически план за ${dest} за ${days} дни. Език: ${lang === 'bg' ? 'Български' : 'English'}.
    
    СТРУКТУРА:
    1. НАЙ-ОТГОРЕ: Секция "ПРЕПОРЪЧАНО НАСТАНЯВАНЕ" с 4 обекта: Луксозен, Бутиков, Бюджетен и Апартамент. Всеки с име и линк: https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    2. ПРОГРАМА ПО ДНИ: За всеки ден раздели на СУТРИН, ОБЕД, СЛЕДОБЕД и ВЕЧЕР.
    3. ИЗПОЛЗВАЙ ИСТИНСКИ ИМЕНА на ресторанти и забележителности.
    4. ЛИНКОВЕ: Слагай [Карта/Билети](линк) към Google Maps за всеки обект.`;

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си професионален гид. Отговаряш в красив Markdown."}, {role: "user", content: prompt}]
            })
        });
        const data = await res.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка при генериране."); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

// 4. ДИЗАЙН И РЕНДИРАНЕ
function renderUI(dest, md) {
    const res = document.getElementById('result');
    
    // Форматиране на Markdown към красиви карти
    let html = md
        .replace(/### (.*)/g, '<h3 class="text-2xl font-black text-blue-600 mt-10 mb-4 uppercase italic border-b-2 border-blue-100">$1</h3>')
        .replace(/СУТРИН:/g, '<b><i class="fas fa-sun text-orange-400 mr-2"></i>СУТРИН:</b>')
        .replace(/ОБЕД:/g, '<b><i class="fas fa-utensils text-emerald-500 mr-2"></i>ОБЕД:</b>')
        .replace(/СЛЕДОБЕД:/g, '<b><i class="fas fa-camera text-blue-400 mr-2"></i>СЛЕДОБЕД:</b>')
        .replace(/ВЕЧЕР:/g, '<b><i class="fas fa-moon text-purple-500 mr-2"></i>ВЕЧЕР:</b>');

    res.innerHTML = `
        <div id="pdfArea" class="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-100 animate-fade-in">
            <div class="bg-slate-900 p-8 rounded-[2rem] text-white mb-10 flex justify-between items-center border-b-8 border-blue-600">
                <h2 class="text-4xl font-black italic uppercase">${dest}</h2>
                <i class="fas fa-map-marked-alt text-blue-500 text-3xl"></i>
            </div>
            
            <div class="prose max-w-none text-slate-700">
                ${html}
            </div>

            <div class="mt-16 flex flex-wrap gap-4 justify-center border-t pt-10">
                <button onclick="saveToCloud('${dest}')" class="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-900 transition">
                    <i class="fas fa-cloud mr-2"></i> Запази в Облака
                </button>
                <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-900 transition">
                    <i class="fas fa-file-pdf mr-2"></i> Свали PDF
                </button>
            </div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

// 5. ФУНКЦИИ ЗА ЗАПАЗВАНЕ И ТРИЕНЕ
async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Моля, влезте в профила си първо!");

    const content = document.getElementById('pdfArea').innerHTML;
    const { error } = await sbClient.from('itineraries').insert([{ 
        user_id: user.id, 
        destination: dest, 
        content: content 
    }]);

    if (error) alert("Грешка при запис.");
    else alert("Успешно запазено в облака! ✨");
}

window.saveToPDF = function(name) {
    const element = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: `${name}-plan.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save();
};

async function checkUser() {
    const { data: { user } } = await sbClient.auth.getUser();
    if (user) {
        document.getElementById('userStatus').innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-[9px] font-black uppercase text-slate-500">${user.email}</span>
                <button onclick="sbClient.auth.signOut().then(() => location.reload())" class="bg-red-50 text-red-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase">Изход</button>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('planForm');
    if (form) form.onsubmit = generatePlan;
    
    // Логика за превключване Вход/Регистрация
    const toggle = document.getElementById('toggleBtn');
    if (toggle) {
        toggle.onclick = () => {
            const title = document.getElementById('authTitle');
            const isLogin = title.innerText === 'Вход';
            title.innerText = isLogin ? 'Регистрация' : 'Вход';
            toggle.innerText = isLogin ? 'Имам профил - Вход' : 'Нямам профил - Регистрация';
        };
    }
});
