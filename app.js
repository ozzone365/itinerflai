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

function setupAuth() {
    const btn = document.getElementById('realSubmitBtn');
    if (!btn) return;
    btn.onclick = async () => {
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPassword').value;
        const isReg = document.getElementById('authTitle').innerText.includes('Регистрация');
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
    if (user && document.getElementById('userStatus')) {
        document.getElementById('userStatus').innerHTML = `
            <div class="flex items-center gap-3 bg-slate-800 p-2 px-4 rounded-xl border border-slate-700">
                <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">${user.email}</span>
                <button onclick="sbClient.auth.signOut().then(() => location.reload())" class="text-white hover:text-red-500 transition px-2"><i class="fas fa-sign-out-alt"></i></button>
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

    // СТРИКТЕН ПРОМПТ ЗА ГАРАНТИРАНИ ЗАКУСКИ
    const prompt = `Направи елитен план за ${dest} за ${days} дни на БЪЛГАРСКИ. 
    БЕЗ СИМВОЛИ # ИЛИ *. 
    СТРУКТУРА ЗА ВСЕКИ ДЕН (БЕЗ ИЗКЛЮЧЕНИЯ):
    ХОТЕЛ: [Тип] - [Име] (Дай 4 такива в началото на целия план)
    ДЕН: [Номер]
    ☕ ЗАКУСКА: [Име на заведение] | [Описание]
    🏛️ ЗАБЕЛЕЖИТЕЛНОСТИ: [Обекти] | [Описание]
    🍴 ОБЯД: [Име на ресторант] | [Описание]
    📸 ЗАБЕЛЕЖИТЕЛНОСТИ: [Обекти] | [Описание]
    🌙 ВЕЧЕРЯ: [Име на ресторант] | [Описание]`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си професионален гид. Всеки елемент от програмата ЗАДЪЛЖИТЕЛНО започва с емоджи и съдържа ':' за разделител. Пиши кратко."}, {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка!"); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

function renderUI(dest, md) {
    const res = document.getElementById('result');
    let hotelsHtml = "";
    let programHtml = "";
    
    const lines = md.replace(/[*#]/g, '').split('\n').filter(l => l.trim() !== "");

    lines.forEach(line => {
        // ХОТЕЛИ
        if (line.toUpperCase().startsWith('ХОТЕЛ:')) {
            const content = line.split(':')[1].trim();
            const name = content.includes('-') ? content.split('-')[1].trim() : content;
            const hotelUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest + " " + name)}&aid=701816`;
            hotelsHtml += `
            <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100 shadow-sm">
                <div><p class="text-[8px] font-black text-blue-600 uppercase mb-0.5">Настаняване</p><p class="font-bold text-slate-800 text-[11px] leading-tight">${name}</p></div>
                <a href="${hotelUrl}" target="_blank" rel="noopener noreferrer" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-md flex-shrink-0">Резервирай</a>
            </div>`;
        }
        // ДНИ
        else if (line.toUpperCase().includes('ДЕН:')) {
            programHtml += `<div class="text-2xl font-black text-slate-900 border-b-4 border-blue-600/20 mt-10 mb-6 uppercase italic pb-1">${line.trim()}</div>`;
        }
        // ПРОГРАМА (ЗАКУСКИ, ОБЯДИ, ВЕЧЕРИ, ОБЕКТИ)
        else if (/[\u{1F300}-\u{1F9FF}]/u.test(line) && line.includes(':')) {
            const parts = line.split(':');
            const title = parts[0].trim();
            const desc = parts[1] ? parts[1].trim() : "";
            const cleanTitle = title.replace(/[\u{1F300}-\u{1F9FF}]/u, '').trim();
            
            // ФИКСИРАН АФИЛИЕЙТ ЛИНК КЪМ WAYAWAY С ТВОЕТО ID 701816
            const tpUrl = `https://wayaway.tp.st/search?marker=701816&query=${encodeURIComponent(dest + " " + cleanTitle)}&subid=itinerflai`;
            
            programHtml += `
            <div class="bg-white p-5 rounded-[2.5rem] shadow-md border border-slate-50 mb-4 flex justify-between items-center group transition hover:border-blue-200">
                <div class="flex flex-col pr-4">
                    <b class="text-slate-900 font-extrabold text-base block mb-0.5 tracking-tight">${title}</b>
                    <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-2">${desc}</p>
                </div>
                <a href="${tpUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:bg-blue-600 transition">
                    <i class="fas fa-external-link-alt text-sm"></i>
                </a>
            </div>`;
        }
    });

    res.innerHTML = `
        <div id="pdfArea" class="max-w-5xl mx-auto pb-24 bg-slate-50/30 p-4 md:p-8 rounded-[4rem]">
            <div class="bg-slate-900 p-8 rounded-[2.5rem] text-white mb-10 flex justify-between items-center shadow-xl border-b-[8px] border-blue-600">
                <div><h2 class="text-3xl font-black italic uppercase tracking-tighter">${dest}</h2><p class="text-[9px] opacity-50 tracking-[0.3em] font-light">PREMIUM GUIDE BY ITINERFLAI</p></div>
                <div class="flex gap-2">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">PDF</button>
                </div>
            </div>
            <div class="mb-10 px-2">
                <h4 class="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em] italic border-l-4 border-blue-500 pl-3">ПРЕПОРЪЧАНО НАСТАНЯВАНЕ</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${hotelsHtml}</div>
            </div>
            <div class="px-2">${programHtml}</div>
        </div>`;
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

// PDF и Cloud функциите са запазени без промяна
window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: n+'.pdf', html2canvas: { scale: 3 }, jsPDF: { format: 'a4' } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Моля, влезте в профила си!");
    const content = document.getElementById('pdfArea').innerHTML;
    await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    alert("Програмата е запазена! ✨");
}

document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
});
