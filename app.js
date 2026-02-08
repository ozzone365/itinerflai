let S_URL, S_KEY, O_KEY, sbClient;

async function init() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        S_URL = config.supabaseUrl; S_KEY = config.supabaseKey; O_KEY = config.openaiKey;
        if (window.supabase && !sbClient) {
            sbClient = window.supabase.createClient(S_URL, S_KEY);
            setupAuth();
            checkUser();
        }
    } catch (e) { console.error("Старт грешка:", e); }
}
init();

// --- ВХОД / ИЗХОД ---
function setupAuth() {
    const btn = document.getElementById('realSubmitBtn');
    if (!btn) return;
    btn.onclick = async () => {
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPassword').value;
        const isReg = document.getElementById('authTitle').innerText === 'Регистрация';
        try {
            const { error } = isReg 
                ? await sbClient.auth.signUp({ email, password: pass })
                : await sbClient.auth.signInWithPassword({ email, password: pass });
            if (error) throw error;
            document.getElementById('authModal').classList.add('hidden');
            checkUser();
        } catch (err) { alert(err.message); }
    };
}

async function checkUser() {
    const { data: { user } } = await sbClient.auth.getUser();
    if (user) {
        document.getElementById('userStatus').innerHTML = `
            <div class="flex items-center gap-3 bg-slate-800 p-2 px-4 rounded-xl border border-slate-700 shadow-lg">
                <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">${user.email}</span>
                <button onclick="sbClient.auth.signOut().then(() => location.reload())" class="text-white hover:text-red-500 transition"><i class="fas fa-sign-out-alt"></i></button>
            </div>`;
    }
}

// --- ГЕНЕРИРАНЕ ---
async function generatePlan(e) {
    e.preventDefault();
    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    const affId = "701816"; 

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Направи богат план за ${dest} за ${days} дни на БЪЛГАРСКИ. 
    ХОТЕЛИ (4 ОПЦИИ):
    H: Лукс | [Име] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    H: Бутик | [Име] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    H: Бюджет | [Име] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    H: Апартамент | [Име] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}

    ПРОГРАМА (Минимум 3 обекта на секция с описания):
    ### Ден [X]
    ITEM: ☕ ЗАКУСКА | [Място] | [Описание 2 изречения] | https://www.google.com/maps/search/${dest}+[Място]
    ITEM: 🏛️ СУТРИН | [Обект1, Обект2, Обект3] | [Детайлен маршрут] | https://www.google.com/maps/search/${dest}+Sights
    ITEM: 🍴 ОБЯД | [Ресторант] | [Защо си струва] | https://www.google.com/maps/search/${dest}+Restaurant
    ITEM: 📸 СЛЕДОБЕД | [Обект1, Обект2, Обект3] | [Инфо и история] | https://www.google.com/maps/search/${dest}+Photo
    ITEM: 🌙 ВЕЧЕРЯ | [Ресторант] | [Атмосфера] | https://www.google.com/maps/search/${dest}+Dinner`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си елитен травъл дизайнер. Пиши само в зададения формат."}, {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка при AI!"); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

function renderUI(dest, md) {
    const res = document.getElementById('result');
    
    // 1. Поправка на Хотелите (Карти)
    const hotelMatches = [...md.matchAll(/H: (.*?) \| (.*?) \| (https.*?)\n/g)];
    let hotelsHtml = hotelMatches.map(m => `
        <div class="bg-white p-5 rounded-3xl flex justify-between items-center border border-slate-100 shadow-sm hover:shadow-md transition">
            <div><p class="text-[10px] font-black text-blue-600 uppercase mb-1">${m[1]}</p><p class="font-bold text-slate-800 text-sm">${m[2]}</p></div>
            <a href="${m[3]}" target="_blank" rel="noopener noreferrer" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Резервирай</a>
        </div>`).join('');

    // 2. Поправка на Програмата (Бели карти)
    let formatted = md
        .replace(/### (.*)/g, '<div class="text-3xl font-black text-slate-900 border-b-8 border-blue-600/20 mt-16 mb-8 uppercase italic pb-2">$1</div>')
        .replace(/ITEM: (.*?) \| (.*?) \| (.*?) \| (https.*?)/g, `
            <div class="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 mb-6 flex justify-between items-center group transition hover:border-blue-200">
                <div class="flex gap-6 items-start">
                    <span class="text-4xl mt-1">$1</span>
                    <div>
                        <b class="text-slate-900 font-extrabold text-xl block mb-2 tracking-tight">$2</b>
                        <p class="text-slate-500 text-sm leading-relaxed max-w-xl">$3</p>
                    </div>
                </div>
                <a href="$4" target="_blank" rel="noopener noreferrer" class="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:bg-slate-900 transition"><i class="fas fa-map-marker-alt text-xl"></i></a>
            </div>
        `);

    res.innerHTML = `
        <div id="pdfArea" class="max-w-5xl mx-auto pb-24 bg-slate-50/50 p-4 md:p-8 rounded-[4rem]">
            <div class="bg-slate-900 p-12 rounded-[3.5rem] text-white mb-12 flex justify-between items-center shadow-2xl border-b-[12px] border-blue-600">
                <div><h2 class="text-6xl font-black italic uppercase tracking-tighter">${dest}</h2><p class="text-xs opacity-50 tracking-[0.4em] mt-2 font-light">EXCLUSIVELY BY ITINERFLAI</p></div>
                <div class="flex gap-3">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition">PDF</button>
                </div>
            </div>

            <div class="mb-16 px-4">
                <h4 class="text-sm font-black text-slate-400 mb-6 uppercase tracking-[0.3em] flex items-center gap-3"><i class="fas fa-hotel text-blue-500"></i> ПРЕПОРЪЧАНО НАСТАНЯВАНЕ (ID: 701816)</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">${hotelsHtml}</div>
            </div>

            <div class="px-4">${formatted.substring(formatted.indexOf('<div class="text-3xl'))}</div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'.pdf', html2canvas: { scale: 3 }, jsPDF: { format: 'a4' } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Влезте в профила!");
    const content = document.getElementById('pdfArea').innerHTML;
    await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    alert("Успешно запазено в твоя профил! ✨");
}

document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
});
