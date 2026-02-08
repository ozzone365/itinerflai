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
    } catch (e) { console.error("Грешка при старт:", e); }
}
init();

// --- ВХОД (СКРИВА ПРОЗОРЕЦА И ОБНОВЯВА МЕЙЛА) ---
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
        } catch (err) { alert("Грешка: " + err.message); }
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

// --- ГЕНЕРИРАНЕ (С ПРАВИЛНИ ТРАВЕЛПАЙОУТС ЛИНКОВЕ) ---
async function generatePlan(e) {
    e.preventDefault();
    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    const affId = "701816"; // Твоят Travelpayouts ID

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Направи елитен план за ${dest} за ${days} дни. 
    1. ХОТЕЛИ: Дай 4 опции (Лукс, Бутик, Бюджет, Апартамент). ЛИНК: https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    2. ПРОГРАМА: Поне 3 забележителности на секция. Формат:
    ### Ден [X]
    ☕ ЗАКУСКА: [Място] | [Описание 2 изречения] | https://www.google.com/maps/search/${dest}+[Място]
    🏛️ СУТРИН: [Обект1, Обект2, Обект3] | [Описание на маршрута] | https://www.google.com/maps/search/${dest}+[Обекти]
    🍴 ОБЯД: [Ресторант] | [Защо си струва] | https://www.google.com/maps/search/${dest}+[Ресторант]
    📸 СЛЕДОБЕД: [Обект1, Обект2, Обект3] | [Инфо и история] | https://www.google.com/maps/search/${dest}+[Обекти]
    🌙 ВЕЧЕРЯ: [Ресторант] | [Атмосфера] | https://www.google.com/maps/search/${dest}+[Ресторант]`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си професионален гид. Генерирай само РЕАЛНИ локации."}, {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("AI Грешка!"); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

function renderUI(dest, md) {
    const res = document.getElementById('result');
    const affId = "701816";

    // Обработка на хотели
    const hotelLines = md.match(/(Лукс|Бутик|Бюджет|Апартамент): (.*?) \| (https.*?)\n/g) || [];
    let hotelsHtml = hotelLines.map(line => {
        const [type, rest] = line.split(':');
        const [name, url] = rest.split('|');
        return `
        <div class="bg-indigo-50/50 p-4 rounded-2xl flex justify-between items-center border border-indigo-100 shadow-sm">
            <div><p class="text-[9px] font-black text-indigo-500 uppercase">${type.trim()}</p><p class="font-bold text-slate-800 text-xs">${name.trim()}</p></div>
            <a href="${url.trim()}" target="_blank" rel="noopener noreferrer" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-slate-900 transition">Резервирай</a>
        </div>`;
    }).join('');

    // Обработка на програмата (реда под ред с икони)
    let formatted = md
        .replace(/### (.*)/g, '<div class="text-xl font-black text-blue-600 border-b-2 border-blue-100 mt-12 mb-6 uppercase italic pb-2">$1</div>')
        .replace(/(☕|🏛️|🍴|📸|🌙) (.*?): (.*?) \| (.*?) \| (https.*?)/g, `
            <div class="py-6 border-b border-slate-50 hover:bg-blue-50/20 px-3 transition rounded-2xl group">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-start gap-4">
                        <span class="text-3xl mt-1">$1</span>
                        <div>
                            <b class="text-[9px] uppercase text-slate-400 block tracking-widest">$2</b>
                            <span class="text-slate-900 font-bold text-lg leading-tight block mb-1">$3</span>
                            <p class="text-slate-500 text-xs leading-relaxed italic">$4</p>
                        </div>
                    </div>
                    <a href="$5" target="_blank" rel="noopener noreferrer" class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition flex-shrink-0"><i class="fas fa-map-marker-alt"></i></a>
                </div>
            </div>
        `);

    res.innerHTML = `
        <div id="pdfArea" class="bg-white p-6 md:p-12 rounded-[4rem] shadow-2xl border-t-[15px] border-blue-600 max-w-5xl mx-auto">
            <div class="bg-slate-900 p-10 rounded-[3rem] text-white mb-10 flex justify-between items-center border-b-4 border-blue-500 shadow-xl">
                <div><h2 class="text-5xl font-black italic uppercase tracking-tighter">${dest}</h2><p class="text-[10px] opacity-40 uppercase tracking-[0.4em] mt-1 italic">Premium Architect by Itinerflai</p></div>
                <div class="flex gap-2">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-800 transition">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-800 transition">PDF</button>
                </div>
            </div>
            
            <div class="mb-14">
                <h4 class="text-[12px] font-black uppercase text-indigo-500 mb-6 tracking-[0.3em] flex items-center gap-2"><i class="fas fa-hotel"></i> ПРЕПОРЪЧАНО НАСТАНЯВАНЕ</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${hotelsHtml}</div>
            </div>

            <div class="itinerary-body text-slate-700">${formatted.substring(formatted.indexOf('<div class="text-xl'))}</div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'-plan.pdf', html2canvas: { scale: 2 }, jsPDF: { format: 'a4', orientation: 'portrait' } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Влезте в профила си!");
    const content = document.getElementById('pdfArea').innerHTML;
    await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    alert("Програмата е запазена успешно! ✨");
}

document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
});
