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
    } catch (e) { console.error("Грешка при старт:", e); }
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
        else { alert(isReg ? "Виж си мейла!" : "Успешен вход!"); location.reload(); }
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

    const prompt = `Създай елитен туристически план за ${dest} за ${days} дни. 
    1. ПЪРВО: Секция ПРЕПОРЪЧАНО НАСТАНЯВАНЕ с 4 хотела (Лукс, Бутик, Бюджет, Апартамент). Формат: [ТИП]: [ИМЕ] | [ЛИНК: https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}]
    2. ПРОГРАМА: За всеки ден ползвай СУТРИН, ОБЕД, СЛЕДОБЕД, ВЕЧЕР.
    3. ЛИНКОВЕ: Всяко място да има [Карта](URL към Google Maps).`;

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си професионален гид. Пиши структурирано."}, {role: "user", content: prompt}]
            })
        });
        const data = await res.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка в AI връзката!"); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

// --- ВИЗУАЛЕН ДИЗАЙН ---
function renderUI(dest, content) {
    const res = document.getElementById('result');
    
    // Превръщаме суровия текст в графични елементи
    let formatted = content
        .replace(/### (.*)/g, '<h3 class="text-2xl font-black text-blue-600 border-b-2 border-blue-100 mt-8 mb-4 uppercase italic">$1</h3>')
        .replace(/(.*?) \| (https:\/\/www\.booking\.com.*)/g, '<div class="bg-indigo-50 p-3 rounded-xl mb-2 flex justify-between items-center text-xs"><span>$1</span><a href="$2" target="_blank" class="bg-indigo-600 text-white px-3 py-1 rounded-lg font-bold">РЕЗЕРВИРАЙ</a></div>')
        .replace(/СУТРИН:/g, '<div class="mt-4 text-sm font-bold"><i class="fas fa-sun text-orange-400 mr-2"></i>СУТРИН:</div>')
        .replace(/ОБЕД:/g, '<div class="mt-4 text-sm font-bold"><i class="fas fa-utensils text-emerald-500 mr-2"></i>ОБЕД:</div>')
        .replace(/ВЕЧЕР:/g, '<div class="mt-4 text-sm font-bold"><i class="fas fa-moon text-purple-500 mr-2"></i>ВЕЧЕР:</div>')
        .replace(/\[Карта\]\((.*?)\)/g, '<a href="$1" target="_blank" class="inline-flex items-center gap-1 text-blue-500 underline ml-2"><i class="fas fa-map-marker-alt"></i> Карта</a>');

    res.innerHTML = `
        <div id="pdfArea" class="bg-white p-10 rounded-[3rem] shadow-2xl border-t-[15px] border-blue-600 max-w-4xl mx-auto">
            <div class="flex justify-between items-end mb-10">
                <div>
                    <h2 class="text-5xl font-black italic text-slate-900 uppercase tracking-tighter">${dest}</h2>
                    <p class="text-[10px] uppercase tracking-widest text-slate-400 mt-2">Personalized AI Architect</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-[10px] shadow-lg hover:bg-slate-900 transition uppercase">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] shadow-lg hover:bg-slate-900 transition uppercase">PDF</button>
                </div>
            </div>
            <div class="text-slate-700 leading-relaxed text-sm">${formatted}</div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'-plan.pdf', html2canvas: { scale: 2 } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Влезте в профила си!");
    const content = document.getElementById('pdfArea').innerHTML;
    const { error } = await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    if (error) alert("Грешка при запис."); else alert("Запазено успешно! ✨");
}
