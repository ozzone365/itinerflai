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

    const prompt = `Make a rich travel plan for ${dest} for ${days} days. 
    FORMAT HOTELS:
    H: Luxury | [Name] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    H: Boutique | [Name] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    H: Budget | [Name] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    H: Apartment | [Name] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}

    PROGRAM FORMAT:
    ### Ден [X]
    ITEM: ☕ ЗАКУСКА | [Място] | [Описание 2 изречения] | https://www.google.com/maps/search/${dest}+[Място]
    ITEM: 🏛️ СУТРИН | [3-4 обекта] | [Описание на маршрута] | https://www.google.com/maps/search/${dest}+Sightseeing
    ITEM: 🍴 ОБЯД | [Място] | [Защо си струва] | https://www.google.com/maps/search/${dest}+Restaurant
    ITEM: 📸 СЛЕДОБЕД | [3-4 обекта] | [Интересни факти] | https://www.google.com/maps/search/${dest}+Attractions
    ITEM: 🌙 ВЕЧЕРЯ | [Място] | [Атмосфера] | https://www.google.com/maps/search/${dest}+Dinner`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Пиши на БЪЛГАРСКИ. Използвай само зададения формат."}, {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка!"); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

function renderUI(dest, md) {
    const res = document.getElementById('result');
    
    // 1. Обработка на хотели
    const hotelMatches = [...md.matchAll(/H: (.*?) \| (.*?) \| (https.*?)\n/g)];
    let hotelsHtml = hotelMatches.map(m => `
        <div class="bg-blue-50/50 p-4 rounded-2xl flex justify-between items-center border border-blue-100 shadow-sm">
            <div><p class="text-[9px] font-black text-blue-500 uppercase">${m[1]}</p><p class="font-bold text-slate-800 text-xs">${m[2]}</p></div>
            <a href="${m[3]}" target="_blank" rel="noopener" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Резервирай</a>
        </div>`).join('');

    // 2. Обработка на програмата
    let formatted = md
        .replace(/### (.*)/g, '<div class="text-2xl font-black text-slate-900 border-b-4 border-blue-600 mt-12 mb-6 uppercase italic pb-2">$1</div>')
        .replace(/ITEM: (.*?) \| (.*?) \| (.*?) \| (https.*?)/g, `
            <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-4 flex justify-between items-center group hover:shadow-md transition">
                <div class="flex gap-4 items-start">
                    <span class="text-3xl">$1</span>
                    <div>
                        <b class="text-slate-900 font-bold text-lg block">$2</b>
                        <p class="text-slate-500 text-xs leading-relaxed mt-1 italic">$3</p>
                    </div>
                </div>
                <a href="$4" target="_blank" rel="noopener" class="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition"><i class="fas fa-map-marker-alt"></i></a>
            </div>
        `);

    res.innerHTML = `
        <div id="pdfArea" class="max-w-4xl mx-auto pb-20">
            <div class="bg-slate-900 p-10 rounded-[3rem] text-white mb-8 flex justify-between items-center shadow-2xl border-b-8 border-blue-600">
                <div><h2 class="text-5xl font-black italic uppercase">${dest}</h2><p class="text-[10px] opacity-50 tracking-[0.3em]">PREMIUM TRAVEL GUIDE</p></div>
                <div class="flex gap-2">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">ЗАПАЗИ</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">PDF</button>
                </div>
            </div>

            <div class="mb-10">
                <h4 class="text-[12px] font-black text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2"><i class="fas fa-hotel"></i> Препоръчани Хотели</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${hotelsHtml}</div>
            </div>

            <div class="space-y-4">${formatted.substring(formatted.indexOf('<div class="text-2xl'))}</div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'.pdf', html2canvas: { scale: 2 }, jsPDF: { format: 'a4' } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Влезте в профила!");
    const content = document.getElementById('pdfArea').innerHTML;
    await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    alert("Запазено! ✨");
}

document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
});
