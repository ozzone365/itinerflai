// 1. Глобални променливи и защита срещу повторно деклариране
if (typeof sbClient === 'undefined') {
    var S_URL, S_KEY, O_KEY, sbClient;
}

// 2. Функция за зареждане на ключове от Vercel API
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error("API Route not found");
        const config = await response.json();
        
        S_URL = config.supabaseUrl;
        S_KEY = config.supabaseKey;
        O_KEY = config.openaiKey;

        if (window.supabase) {
            sbClient = window.supabase.createClient(S_URL, S_KEY);
            console.log("Системата е готова!");
            // Тук може да се извика checkUser(), ако имаш такава функция за сесия
        }
    } catch (err) {
        console.error("Грешка при зареждане на конфигурация:", err);
    }
}

// Стартираме зареждането веднага
loadConfig();

// 3. Основна функция за генериране на плана
async function generatePlan(e) {
    e.preventDefault();
    if (!O_KEY) return alert("Системата все още се зарежда, моля изчакайте 2 секунди...");

    const dest = document.getElementById('destination').value;
    const style = document.getElementById('travelStyle').value;
    const days = document.getElementById('days').value;
    const lang = document.getElementById('langSwitch').value;

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('result').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    const affId = "304442"; // Тук постави твоя афилиейт ID от Booking

    const prompt = `Направи луксозен туристически план за ${dest} за ${days} дни, стил: ${style}. 
    Език: ${lang === 'bg' ? 'Български' : 'English'}.
    
    СТРУКТУРА НА ОТГОВОРА:
    За ВСЕКИ ДЕН използвай точно този формат:
    ### ДЕН [X]
    ХОТЕЛ: [Име на хотел] | [https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}]
    ЗАКУСКА: [Място]
    ОБЯД: [Място]
    ВЕЧЕРЯ: [Място]
    ПРОГРАМА: [Описание на деня с акцент върху преживяванията]
    КАРТА: [Име на основната забележителност] | [https://www.google.com/maps/search/?api=1&query=${dest}+[име]]`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${O_KEY}` 
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {role: "system", content: "Ти си елитен травъл дизайнер. Отговаряш САМО в зададения структуриран формат с икони."}, 
                    {role: "user", content: prompt}
                ]
            })
        });
        const data = await response.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) {
        alert("Грешка при генериране на плана.");
    } finally {
        document.getElementById('loader').classList.add('hidden');
    }
}

// 4. Рендиране на UI - ДИЗАЙНЪТ С КАРТИ И ИКОНИ
function renderUI(dest, content) {
    const res = document.getElementById('result');
    const daysData = content.split('###').filter(d => d.trim() !== "");

    let daysHtml = daysData.map(dayText => {
        const lines = dayText.split('\n');
        const dayTitle = lines[0].trim();
        
        const getLink = (line, label, icon) => {
            if (!line.includes('|')) return "";
            const parts = line.split('|');
            const url = parts[1].trim();
            return `<a href="${url}" target="_blank" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition flex items-center gap-2 shadow-lg">
                        <i class="${icon}"></i> ${label}
                    </a>`;
        };

        const hotelLine = lines.find(l => l.includes('ХОТЕЛ:')) || "";
        const breakfast = lines.find(l => l.includes('ЗАКУСКА:')) || "";
        const lunch = lines.find(l => l.includes('ОБЯД:')) || "";
        const dinner = lines.find(l => l.includes('ВЕЧЕРЯ:')) || "";
        const program = lines.find(l => l.includes('ПРОГРАМА:')) || "";
        const mapLine = lines.find(l => l.includes('КАРТА:')) || "";

        return `
        <div class="bg-white rounded-[3rem] p-8 md:p-12 mb-10 shadow-xl border border-slate-50 animate-fade-in relative overflow-hidden">
            <div class="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
            
            <h3 class="text-3xl font-black italic uppercase text-slate-900 mb-8 tracking-tighter border-b pb-4">${dayTitle}</h3>
            
            <div class="bg-blue-50/50 p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row justify-between items-center gap-4 border border-blue-100">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                        <i class="fas fa-hotel text-xl"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-blue-400 uppercase tracking-widest">Препоръчан Хотел</p>
                        <p class="font-bold text-slate-800">${hotelLine.split('|')[0].replace('ХОТЕЛ:', '').trim()}</p>
                    </div>
                </div>
                ${getLink(hotelLine, "Резервирай", "fas fa-external-link-alt")}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-slate-50 p-5 rounded-2xl">
                    <i class="fas fa-coffee text-orange-400 mb-2 text-xl"></i>
                    <p class="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Закуска</p>
                    <p class="text-sm font-bold text-slate-700">${breakfast.replace('ЗАКУСКА:', '').trim()}</p>
                </div>
                <div class="bg-slate-50 p-5 rounded-2xl">
                    <i class="fas fa-utensils text-emerald-500 mb-2 text-xl"></i>
                    <p class="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Обяд</p>
                    <p class="text-sm font-bold text-slate-700">${lunch.replace('ОБЯД:', '').trim()}</p>
                </div>
                <div class="bg-slate-50 p-5 rounded-2xl">
                    <i class="fas fa-moon text-purple-500 mb-2 text-xl"></i>
                    <p class="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Вечеря</p>
                    <p class="text-sm font-bold text-slate-700">${dinner.replace('ВЕЧЕРЯ:', '').trim()}</p>
                </div>
            </div>

            <div class="bg-slate-900 text-white/90 p-8 rounded-[2rem] mb-8 text-sm leading-relaxed italic relative">
                <i class="fas fa-quote-left absolute top-4 left-4 opacity-10 text-4xl"></i>
                ${program.replace('ПРОГРАМА:', '').trim()}
            </div>

            <div class="flex justify-end">
                ${getLink(mapLine, "Виж локация в карта", "fas fa-map-marker-alt")}
            </div>
        </div>`;
    }).join('');

    res.innerHTML = `
        <div id="pdfArea" class="max-w-5xl mx-auto pb-20">
            <div class="bg-slate-900 p-12 rounded-[4rem] text-white shadow-2xl mb-12 flex justify-between items-center border-b-[12px] border-blue-600">
                <div>
                    <h2 class="text-6xl font-black uppercase italic tracking-tighter leading-none">${dest}</h2>
                    <p class="text-[10px] opacity-40 uppercase tracking-[0.5em] mt-4 font-bold">Generated by ITINERFLAI AI Architect</p>
                </div>
                <div class="hidden md:flex w-24 h-24 bg-white/5 rounded-3xl items-center justify-center text-5xl text-blue-500">
                    <i class="fas fa-route"></i>
                </div>
            </div>
            
            ${daysHtml}

            <div class="flex flex-col items-center gap-4 mt-16 animate-bounce">
                <button onclick="saveToPDF('${dest}')" class="bg-blue-600 hover:bg-slate-900 text-white px-16 py-8 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.3em] transition-all shadow-2xl flex items-center gap-6 group">
                    <i class="fas fa-file-pdf text-2xl group-hover:rotate-12 transition"></i> 
                    Запази PDF Програма
                </button>
                <p class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Готови сте за път!</p>
            </div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

// 5. Функция за PDF експорт
window.saveToPDF = function(name) {
    const element = document.getElementById('pdfArea');
    const opt = {
        margin: 5,
        filename: `${name}-itinerflai.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
};

// 6. Инициализация на събития
document.addEventListener('DOMContentLoaded', () => {
    const planForm = document.getElementById('planForm');
    if (planForm) {
        planForm.onsubmit = generatePlan;
    }
});
