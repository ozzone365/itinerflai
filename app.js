let S_URL, S_KEY, O_KEY, sbClient;

async function init() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        S_URL = config.supabaseUrl;
        S_KEY = config.supabaseKey;
        O_KEY = config.openaiKey;

        if (window.supabase) {
            // ФИКС: Проверка за съществуваща инстанция за избягване на грешката от screen8
            if (!sbClient) sbClient = window.supabase.createClient(S_URL, S_KEY);
            setupAuth();
            checkUser();
        }
    } catch (e) { console.error("Грешка:", e); }
}
init();

// --- АВТЕНТИКАЦИЯ ---
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
        
        if (error) alert(error.message);
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
    1. СЕКЦИЯ ХОТЕЛИ: Дай 4 реални хотела (Лукс, Бутик, Бюджет, Апартамент) с линкове https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}
    2. ПРОГРАМА: За всеки ден ползвай секции: СУТРИН, ОБЕД, СЛЕДОБЕД, ВЕЧЕР.
    3. ИМЕНА: Използвай само реални имена на места и ресторанти.
    4. ФОРМАТ: Използвай ### за Ден, ** за обекти и [Карта](линк) за локации.`;

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си елитен травъл дизайнер."}, {role: "user", content: prompt}]
            })
        });
        const data = await res.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка!"); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

// --- ДИЗАЙНЪТ, КОЙТО ИСКАШ ---
function renderUI(dest, md) {
    const res = document.getElementById('result');
    
    // Превръщаме текста в икони и карти
    let formatted = md
        .replace(/### (.*)/g, '<div class="text-2xl font-black text-blue-600 border-b-2 border-blue-100 mt-8 mb-4 uppercase italic">$1</div>')
        .replace(/СУТРИН:/g, '<div class="mt-4"><b><i class="fas fa-sun text-orange-400 mr-2"></i>СУТРИН:</b>')
        .replace(/ОБЕД:/g, '<div class="mt-4"><b><i class="fas fa-utensils text-emerald-500 mr-2"></i>ОБЕД:</b>')
        .replace(/ВЕЧЕР:/g, '<div class="mt-4"><b><i class="fas fa-moon text-purple-500 mr-2"></i>ВЕЧЕР:</b>')
        .replace(/\[Карта\]\((.*?)\)/g, '<a href="$1" target="_blank" class="ml-2 text-blue-500 underline"><i class="fas fa-map-marker-alt"></i></a>');

    res.innerHTML = `
        <div id="pdfArea" class="bg-white p-10 rounded-[3rem] shadow-2xl border-t-[12px] border-blue-600">
            <div class="flex justify-between items-center mb-10">
                <h2 class="text-5xl font-black italic text-slate-900 uppercase">${dest}</h2>
                <div class="flex gap-4">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg hover:bg-slate-900 transition"><i class="fas fa-cloud"></i> ЗАПАЗИ</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white p-4 rounded-2xl shadow-lg hover:bg-slate-900 transition"><i class="fas fa-file-pdf"></i> PDF</button>
                </div>
            </div>
            <div class="itinerary-content text-slate-700 leading-relaxed">${formatted}</div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'.pdf', html2canvas: { scale: 2 } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Влезте в профила!");
    const content = document.getElementById('pdfArea').innerHTML;
    await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    alert("Запазено в профила!");
}
