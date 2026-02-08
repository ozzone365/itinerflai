if (typeof sbClient === 'undefined') {
    var S_URL, S_KEY, O_KEY, sbClient;
}

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        S_URL = config.supabaseUrl;
        S_KEY = config.supabaseKey;
        O_KEY = config.openaiKey;
        if (window.supabase) sbClient = window.supabase.createClient(S_URL, S_KEY);
    } catch (err) { console.error("Грешка при конфиг:", err); }
}
loadConfig();

async function generatePlan(e) {
    e.preventDefault();
    if (!O_KEY) return alert("Зареждам ключове...");

    const dest = document.getElementById('destination').value;
    const style = document.getElementById('travelStyle').value;
    const days = document.getElementById('days').value;
    const lang = document.getElementById('langSwitch').value;

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('result').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    const affId = "304442"; // Твоят афилиейт ID

    const prompt = `Направи елитен туристически план за ${dest} за ${days} дни. Език: ${lang === 'bg' ? 'Български' : 'English'}.
    
    ЗАДЪЛЖИТЕЛНА СТРУКТУРА ЗА ВСЕКИ ДЕН:
    ### ДЕН [X]
    
    ВЪЗМОЖНОСТИ ЗА НАСТАНЯВАНЕ (4 опции):
    1. Луксозен: [Име] | [https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}]
    2. Бутиков: [Име] | [https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}]
    3. Бюджетен: [Име] | [https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}]
    4. Апартамент: [Име] | [https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}]

    ХРАНЕНЕ (с линкове):
    ЗАКУСКА: [Място] | [https://www.google.com/search?q=${dest}+${lang === 'bg' ? 'закуска' : 'breakfast'}+[име]]
    ОБЯД: [Място] | [https://www.google.com/search?q=${dest}+${lang === 'bg' ? 'обяд' : 'lunch'}+[име]]
    ВЕЧЕРЯ: [Място] | [https://www.google.com/search?q=${dest}+${lang === 'bg' ? 'вечеря' : 'dinner'}+[име]]

    ЗАБЕЛЕЖИТЕЛНОСТИ И БИЛЕТИ:
    - [Име]: [Описание]. Билети/Карта: | [https://www.google.com/maps/search/?api=1&query=${dest}+[име]]`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си премиум травъл агент. Използваш точно зададения формат с вертикални черти | за линковете."}, {role: "user", content: prompt}]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка при генериране."); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

function renderUI(dest, content) {
    const res = document.getElementById('result');
    const daysData = content.split('###').filter(d => d.trim() !== "");

    let daysHtml = daysData.map(dayText => {
        const lines = dayText.split('\n');
        const dayTitle = lines[0].trim();
        
        const createBtn = (line, icon, color = "blue") => {
            if (!line.includes('|')) return "";
            const parts = line.split('|');
            const label = parts[0].split(':')[1] || parts[0];
            const url = parts[1].trim();
            return `<a href="${url}" target="_blank" class="flex items-center gap-2 bg-${color}-600 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter hover:bg-slate-900 transition shadow-md">
                <i class="${icon}"></i> ${label.trim()}
            </a>`;
        };

        const accommodations = lines.filter(l => l.match(/^\d\./)).map(l => createBtn(l, "fas fa-bed", "indigo")).join('');
        const breakfast = lines.find(l => l.includes('ЗАКУСКА:')) || "";
        const lunch = lines.find(l => l.includes('ОБЯД:')) || "";
        const dinner = lines.find(l => l.includes('ВЕЧЕРЯ:')) || "";
        const sights = lines.filter(l => l.startsWith('-')).map(l => createBtn(l, "fas fa-ticket", "emerald")).join('');

        return `
        <div class="bg-white rounded-[3rem] p-8 md:p-10 mb-12 shadow-2xl border border-slate-100 animate-fade-in border-t-[12px] border-t-blue-600">
            <h3 class="text-3xl font-black italic uppercase text-slate-900 mb-8 tracking-tighter">${dayTitle}</h3>
            
            <p class="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Къде да отседнете:</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">${accommodations}</div>

            <p class="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Гурме преживявания:</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div class="bg-orange-50 p-4 rounded-2xl border border-orange-100">${createBtn(breakfast, "fas fa-coffee", "orange")}</div>
                <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">${createBtn(lunch, "fas fa-utensils", "emerald")}</div>
                <div class="bg-purple-50 p-4 rounded-2xl border border-purple-100">${createBtn(dinner, "fas fa-moon", "purple")}</div>
            </div>

            <p class="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Програма & Билети:</p>
            <div class="space-y-3">${sights}</div>
        </div>`;
    }).join('');

    res.innerHTML = `
        <div id="pdfArea" class="max-w-5xl mx-auto">
            <div class="bg-slate-900 p-12 rounded-[4rem] text-white shadow-2xl mb-12 flex justify-between items-center">
                <div>
                    <h2 class="text-5xl font-black uppercase italic tracking-tighter">${dest}</h2>
                    <p class="text-[10px] opacity-40 uppercase tracking-[0.5em] mt-2 italic">Official AI Itinerary</p>
                </div>
                <i class="fas fa-bolt text-blue-500 text-5xl"></i>
            </div>
            ${daysHtml}
            <div class="flex justify-center py-10">
                <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-12 py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-slate-900 transition-all flex items-center gap-4">
                    <i class="fas fa-file-pdf"></i> Запази Програмата
                </button>
            </div>
        </div>`;
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

window.saveToPDF = function(name) {
    const element = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: `${name}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save();
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('planForm');
    if (form) form.onsubmit = generatePlan;
});
