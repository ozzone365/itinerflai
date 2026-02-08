let S_URL, S_KEY, O_KEY, sbClient;

async function init() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        S_URL = config.supabaseUrl;
        S_KEY = config.supabaseKey;
        O_KEY = config.openaiKey;

        // Фикс за грешката "supabase is already defined"
        if (window.supabase && !sbClient) {
            sbClient = window.supabase.createClient(S_URL, S_KEY);
            setupAuth();
            checkUser();
        }
    } catch (e) { console.error("Грешка при старт:", e); }
}
init();

// --- ВХОД / РЕГИСТРАЦИЯ ---
function setupAuth() {
    const btn = document.getElementById('realSubmitBtn');
    if (!btn) return;
    btn.onclick = async () => {
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPassword').value;
        const isReg = document.getElementById('authTitle').innerText === 'Регистрация';
        
        const { data, error } = isReg 
            ? await sbClient.auth.signUp({ email, password: pass })
            : await sbClient.auth.signInWithPassword({ email, password: pass });
        
        if (error) alert("Грешка: " + error.message);
        else { alert(isReg ? "Виж си мейла!" : "Влязохте!"); location.reload(); }
    };
}

// --- ГЕНЕРИРАНЕ ---
async function generatePlan(e) {
    e.preventDefault();
    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    const affId = "304442";

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Направи елитен план за ${dest} за ${days} дни. 
    1. ХОТЕЛИ: Дай 4 опции: Лукс, Бутик, Бюджет, Апартамент. Всеки с име и линк: https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    2. ПРОГРАМА: За всеки ден ползвай строго този формат реда под ред:
    ### Ден [X]
    ☕ ЗАКУСКА: [Име] | [Линк]
    🏛️ СУТРИН: [Име] | [Линк]
    🍴 ОБЯД: [Име] | [Линк]
    📸 СЛЕДОБЕД: [Име] | [Линк]
    🌙 ВЕЧЕРЯ: [Име] | [Линк]
    Използвай само реални имена и Google Maps линкове.`;

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си елитен травъл агент. Отговаряш само със зададения формат, без излишни обяснения."}, {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка при AI."); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

// --- ДИЗАЙНЪТ ---
function renderUI(dest, md) {
    const res = document.getElementById('result');
    
    // 1. Форматиране на Хотелите в карти
    let formatted = md.replace(/(Лукс|Бутик|Бюджет|Апартамент): (.*?) \| (https:\/\/www\.booking\.com.*)/g, `
        <div class="bg-indigo-50 p-4 rounded-2xl mb-3 flex justify-between items-center border border-indigo-100">
            <div><p class="text-[9px] font-black text-indigo-500 uppercase">$1</p><p class="font-bold text-slate-800">$2</p></div>
            <a href="$3" target="_blank" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Резервирай</a>
        </div>
    `);

    // 2. Форматиране на Програмата реда под ред
    formatted = formatted
        .replace(/### (.*)/g, '<div class="text-2xl font-black text-blue-600 border-b-2 border-blue-100 mt-12 mb-6 uppercase italic pb-2">$1</div>')
        .replace(/(☕|🏛️|🍴|📸|🌙) (.*?): (.*?) \| (.*)/g, `
            <div class="flex items-center justify-between py-3 border-b border-slate-50">
                <div class="flex items-center gap-3">
                    <span class="text-xl">$1</span>
                    <div><b class="text-[10px] uppercase text-slate-400 block">$2</b><span class="text-slate-700 font-medium">$3</span></div>
                </div>
                <a href="$4" target="_blank" class="text-blue-500 text-lg"><i class="fas fa-map-marker-alt"></i></a>
            </div>
        `);

    res.innerHTML = `
        <div id="pdfArea" class="bg-white p-10 rounded-[3rem] shadow-2xl border-t-[15px] border-blue-600 max-w-5xl mx-auto">
            <div class="bg-slate-900 p-8 rounded-[2rem] text-white mb-10 flex justify-between items-center">
                <h2 class="text-4xl font-black italic uppercase">${dest}</h2>
                <div class="flex gap-3">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-900 transition">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-900 transition">PDF</button>
                </div>
            </div>
            
            <div class="mb-10">
                <h4 class="text-sm font-black uppercase text-indigo-600 mb-4 tracking-widest italic">Препоръчано настаняване</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${formatted.split('<div class="text-2xl')[0]}</div>
            </div>

            <div class="itinerary-list">
                ${formatted.includes('<div class="text-2xl') ? formatted.substring(formatted.indexOf('<div class="text-2xl')) : ''}
            </div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

// --- PDF И ОБЛАК ---
window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'.pdf', html2canvas: { scale: 2 } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Влезте в профила си!");
    const content = document.getElementById('pdfArea').innerHTML;
    await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    alert("Запазено успешно! ✨");
}
