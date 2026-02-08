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
    } catch (e) { console.error("Грешка:", e); }
}
init();

// ВЪЗСТАНОВЕНА ФУНКЦИЯ ВХОД
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
        } catch (err) { alert("Грешка при вход: " + err.message); }
    };
}

async function checkUser() {
    const { data: { user } } = await sbClient.auth.getUser();
    const status = document.getElementById('userStatus');
    if (user && status) {
        status.innerHTML = `
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

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Направи елитен план за ${dest} за ${days} дни на БЪЛГАРСКИ. 
    БЕЗ СИМВОЛИ # ИЛИ *. 
    1. ХОТЕЛИ: Дай точно 4 различни хотела (Лукс, Бутик, Бюджет, Апартамент). Формат: "ХОТЕЛ: [Тип] - [Име]"
    2. ПРОГРАМА: За всяко хранене или забележителност ползвай формат: "[Икона] [Заглавие]: [Описание]"
    ЗАДЪЛЖИТЕЛНО включвай за всеки ден: ☕ ЗАКУСКА, 🏛️ ЗАБЕЛЕЖИТЕЛНОСТИ (минимум 3 обекта), 🍴 ОБЯД, 📸 ЗАБЕЛЕЖИТЕЛНОСТИ (още 3 обекта), 🌙 ВЕЧЕРЯ.`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си професионален агент. Пиши чисто, без Маркдаун. Всеки ред от програмата да започва с емоджи."}, {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка при генериране!"); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

function renderUI(dest, md) {
    const res = document.getElementById('result');
    let hotelsHtml = "";
    let programHtml = "";
    
    // Чистим текста от нежелани текстове и звездички
    const lines = md.replace(/[*#]/g, '').split('\n').filter(l => l.trim() !== "");

    lines.forEach(line => {
        // ПАРСВАНЕ НА ХОТЕЛИ
        if (line.toUpperCase().includes('ХОТЕЛ:')) {
            const content = line.split(':')[1];
            const [type, name] = content.split('-');
            const hotelUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest + " " + (name || ""))}&aid=701816`;
            hotelsHtml += `
            <div class="bg-white p-5 rounded-[2rem] flex justify-between items-center border border-slate-100 shadow-sm hover:shadow-md transition">
                <div><p class="text-[9px] font-black text-blue-600 uppercase mb-1">${type || "Хотел"}</p><p class="font-bold text-slate-800 text-xs">${name || "Препоръчан"}</p></div>
                <a href="${hotelUrl}" target="_blank" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Резервирай</a>
            </div>`;
        }
        // ПАРСВАНЕ НА ДНИ
        else if (line.toUpperCase().includes('ДЕН')) {
            programHtml += `<div class="text-3xl font-black text-slate-900 border-b-8 border-blue-600/20 mt-16 mb-8 uppercase italic pb-2">${line}</div>`;
        }
        // ПАРСВАНЕ НА ПРОГРАМА (Всичко с емоджи става карта)
        else if (/[\u{1F300}-\u{1F9FF}]/u.test(line) && line.includes(':')) {
            const [titlePart, descPart] = line.split(':');
            const cleanTitle = titlePart.replace(/[\u{1F300}-\u{1F9FF}]/u, '').trim();
            const tpUrl = `https://tp.media/r?marker=701816&trs=1&p=3959&u=https%3A%2F%2Fwww.wayaway.io%2Fsearch%3Fquery%3D${encodeURIComponent(dest + " " + cleanTitle)}`;
            
            programHtml += `
            <div class="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-50 mb-6 flex justify-between items-center group transition hover:border-blue-200">
                <div class="flex gap-6 items-start">
                    <div class="flex flex-col">
                        <b class="text-slate-900 font-extrabold text-xl block mb-1 tracking-tight">${titlePart.trim()}</b>
                        <p class="text-slate-500 text-sm leading-relaxed max-w-xl">${descPart ? descPart.trim() : ""}</p>
                    </div>
                </div>
                <a href="${tpUrl}" target="_blank" class="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:bg-blue-600 transition">
                    <i class="fas fa-external-link-alt text-xl"></i>
                </a>
            </div>`;
        }
    });

    res.innerHTML = `
        <div id="pdfArea" class="max-w-5xl mx-auto pb-24 bg-slate-50/30 p-4 md:p-8 rounded-[4rem]">
            <div class="bg-slate-900 p-12 rounded-[3.5rem] text-white mb-12 flex justify-between items-center shadow-2xl border-b-[12px] border-blue-600">
                <div><h2 class="text-5xl font-black italic uppercase tracking-tighter">${dest}</h2><p class="text-xs opacity-50 tracking-[0.4em] mt-2 font-light">PREMIUM GUIDE BY ITINERFLAI</p></div>
                <div class="flex gap-3">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition">PDF</button>
                </div>
            </div>

            <div class="mb-16 px-4">
                <h4 class="text-sm font-black text-slate-400 mb-6 uppercase tracking-[0.3em] italic underline decoration-blue-500 decoration-4">ПРЕПОРЪЧАНО НАСТАНЯВАНЕ</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">${hotelsHtml}</div>
            </div>

            <div class="px-4">${programHtml}</div>
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
    alert("Запазено! ✨");
}

document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
});
