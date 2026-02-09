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

    const prompt = `Направи премиум план за ${dest} за ${days} дни на БЪЛГАРСКИ. 
    БЕЗ СИМВОЛИ # ИЛИ *. 
    1. ХОТЕЛИ: Дай точно 4 реда: "ХОТЕЛ: [Име]".
    2. ПРОГРАМА: Всеки ден ЗАДЪЛЖИТЕЛНО започва с "ДЕН: [Номер]".
    За всеки ден дай на отделни редове (с емоджи и описание):
    ☕ [Закуска] - [Описание]
    🏛️ [Обект 1] - [Описание]
    🏛️ [Обект 2] - [Описание]
    🍴 [Обяд] - [Описание]
    📸 [Обект 3] - [Описание]
    🌙 [Вечеря] - [Описание]`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си премиум гид. НИКОГА не групирай обекти. Всеки обект на нов ред с емоджи, име и описание."}, {role: "user", content: prompt}]
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
    let hCount = 0;
    
    const lines = md.replace(/[*#]/g, '').split('\n').filter(l => l.trim() !== "");

    lines.forEach(line => {
        const l = line.trim();
        const upper = l.toUpperCase();
        
        if (upper.startsWith('ХОТЕЛ:') && hCount < 4) {
            const name = l.split(':')[1].trim();
            const hotelUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest + " " + name)}&aid=701816`;
            hotelsHtml += `
            <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100 shadow-sm">
                <div><p class="text-[8px] font-black text-blue-600 uppercase mb-0.5">Хотел</p><p class="font-bold text-slate-800 text-[11px]">${name}</p></div>
                <a href="${hotelUrl}" target="_blank" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase">Резервирай</a>
            </div>`;
            hCount++;
        }
        else if (upper.includes('ДЕН:')) {
            programHtml += `<div class="text-2xl font-black text-slate-900 border-b-4 border-blue-600/20 mt-10 mb-6 uppercase italic pb-1">${l}</div>`;
        }
        else if (/[\u{1F300}-\u{1F9FF}]/u.test(l)) {
            const separator = l.includes(' - ') ? ' - ' : ':';
            const parts = l.split(separator);
            const titleWithEmoji = parts[0].trim();
            const desc = parts.slice(1).join(separator).trim();
            const cleanTitle = titleWithEmoji.replace(/[\u{1F300}-\u{1F9FF}]/u, '').trim();
            
            // КОРЕКТЕН ЛИНК (Фикс traffic_source)
            const tpUrl = `https://wayaway.tp.st/search?marker=701816&query=${encodeURIComponent(dest + " " + cleanTitle)}&subid=itinerflai`;
            
            programHtml += `
            <div class="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-50 mb-4 flex justify-between items-center group">
                <div class="flex flex-col pr-4">
                    <b class="text-slate-900 font-extrabold text-base block mb-1">${titleWithEmoji}</b>
                    <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-3">${desc}</p>
                </div>
                <a href="${tpUrl}" target="_blank" class="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition">
                    <i class="fas fa-external-link-alt text-sm"></i>
                </a>
            </div>`;
        }
    });

    res.innerHTML = `
        <div id="pdfArea" class="max-w-5xl mx-auto pb-24 p-4 md:p-8 rounded-[4rem] bg-white">
            <div class="bg-slate-900 p-8 rounded-[2.5rem] text-white mb-10 flex justify-between items-center shadow-xl border-b-[8px] border-blue-600">
                <div><h2 class="text-3xl font-black italic uppercase tracking-tighter">${dest}</h2><p class="text-[9px] opacity-50 uppercase tracking-widest">Premium Itinerary</p></div>
                <div class="flex gap-2" data-html2canvas-ignore="true">
                    <button onclick="saveToCloud('${dest}')" class="bg-emerald-500 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase">Запази</button>
                    <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase">PDF</button>
                </div>
            </div>
            <div class="mb-10 px-2">
                <h4 class="text-[10px] font-black text-slate-400 mb-4 uppercase border-l-4 border-blue-500 pl-3 italic">НАСТАНЯВАНЕ</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${hotelsHtml}</div>
            </div>
            <div class="px-2">${programHtml}</div>
        </div>`;
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

window.saveToPDF = function(n) {
    const el = document.getElementById('pdfArea');
    const opt = { 
        margin: [0, 0, 0, 0], 
        filename: n+'.pdf', 
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Моля, влезте в профила!");
    const content = document.getElementById('pdfArea').innerHTML;
    const { error } = await sbClient.from('itineraries').insert([{ 
        user_id: user.id, 
        destination: dest, 
        content: content 
    }]);
    if (error) { console.error(error); alert("Грешка при запис!"); }
    else { alert("Програмата е запазена успешно! ✨"); }
}

document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('planForm');
    if (f) f.onsubmit = generatePlan;
});
