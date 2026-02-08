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
            checkUser();
        }
    } catch (e) { console.error("Грешка:", e); }
}
init();

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
            <div class="flex items-center gap-3 bg-slate-800 p-2 px-4 rounded-xl border border-slate-700">
                <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">${user.email}</span>
                <button onclick="sbClient.auth.signOut().then(() => location.reload())" class="text-white hover:text-red-500 transition"><i class="fas fa-sign-out-alt"></i></button>
            </div>`;
    }
}

async function generatePlan(e) {
    e.preventDefault();
    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    const affId = "701816"; // Твоето Travelpayouts ID

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Направи богат план за ${dest} за ${days} дни. 
    ФОРМАТ ХОТЕЛИ:
    HOTEL_START
    Лукс: [Име] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    Бутик: [Име] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    Бюджет: [Име] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    Апартамент: [Име] | https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    HOTEL_END

    ПРОГРАМА (Минимум 3 забележителности на секция с описания):
    ### Ден [X]
    ☕ ЗАКУСКА: [Място] | [Описание] | [URL]
    🏛️ СУТРИН: [Обект1, Обект2, Обект3] | [Подробно описание на маршрута] | [URL]
    🍴 ОБЯД: [Ресторант] | [Защо да го посетите] | [URL]
    📸 СЛЕДОБЕД: [Обект1, Обект2, Обект3] | [Интересни факти] | [URL]
    🌙 ВЕЧЕРЯ: [Ресторант] | [Атмосфера] | [URL]`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си елитен травъл агент. Генерирай реални места. Линковете за ресторанти да са към TripAdvisor или Google с твоя афилиейт параметър където може."}, {role: "user", content: prompt}]
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
    
    // Прецизно извличане на хотелите
    const hotelMatch = md.match(/HOTEL_START([\s\S]*?)HOTEL_END/);
    let hotelsHtml = "";
    if (hotelMatch) {
        const lines = hotelMatch[1].trim().split('\n');
        hotelsHtml = lines.map(line => {
            if(!line.includes('|')) return '';
            const [type, rest] = line.split(':');
            const [name, url] = rest.split('|');
            return `
            <div class="bg-blue-50/50 p-4 rounded-2xl flex justify-between items-center border border-blue-100 shadow-sm">
                <div><p class="text-[9px] font-black text-blue-500 uppercase">${type.trim()}</p><p class="font-bold text-slate-800 text-xs">${name.trim()}</p></div>
                <a href="${url.trim()}" target="_blank" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Резервирай</a>
            </div>`;
        }).join('');
    }

    let programMd = md.replace(/HOTEL_START[\s\S]*?HOTEL_END/, "").replace(/#+/g, "###");

    let formatted = programMd
        .replace(/### Ден (.*)/g, '<div class="text-2xl font-black text-blue-600 border-b-2 border-blue-100 mt-12 mb-6 uppercase italic pb-2">Ден $1</div>')
        .replace(/(☕|🏛️|🍴|📸|🌙) (.*?): (.*?) \| (.*?) \| (.*)/g, `
            <div class="py-6 border-b border-slate-50 hover:bg-blue-50/20 px-3 transition rounded-xl">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-start gap-4">
                        <span class="text-3xl mt-1">$1</span>
                        <div>
                            <b class="text-[10px] uppercase text-slate-400 block tracking-widest">$2</b>
                            <span class="text-slate-900 font-bold text-xl leading-tight block mb-1">$3</span>
                            <p class="text-slate-500 text-sm leading-relaxed">$4</p>
                        </div>
                    </div>
                    <a href="$5" target="_blank" class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition flex-shrink-0"><i class="fas fa-map-marker-alt"></i></a>
                </div>
            </div>
        `);

    res.innerHTML = `
        <div id="pdfArea" class="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border-t-[15px] border-blue-600 max-w-5xl mx-auto">
            <div class="bg-slate-900 p-10 rounded-[2.5rem] text-white mb-10 flex justify-between items-center shadow-xl">
                <div><h2 class="text-4xl font-black italic uppercase tracking-tighter">${dest}</h2><p class="text-[9px] opacity-40 uppercase tracking-[0.3em] mt-1 italic">Premium Experience by Itinerflai</p></div>
                <div class="flex gap-2">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-800 transition">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-800 transition">PDF</button>
                </div>
            </div>
            <div class="mb-14">
                <h4 class="text-[12px] font-black uppercase text-blue-600 mb-6 tracking-[0.2em] flex items-center gap-2"><i class="fas fa-hotel"></i> ПРЕПОРЪЧАНО НАСТАНЯВАНЕ</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${hotelsHtml}</div>
            </div>
            <div class="itinerary-body">${formatted}</div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'-itinerary.pdf', html2canvas: { scale: 2 }, jsPDF: { format: 'a4' } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Моля, влезте в профила си!");
    const content = document.getElementById('pdfArea').innerHTML;
    await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    alert("Програмата е запазена в облака! ✨");
}

document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
});
