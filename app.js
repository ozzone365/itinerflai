// 1. КОНФИГУРАЦИЯ И ФИКС ЗА ВХОДА
let S_URL, S_KEY, O_KEY, sbClient;

async function init() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        S_URL = config.supabaseUrl;
        S_KEY = config.supabaseKey;
        O_KEY = config.openaiKey;

        // Фикс за грешката от screen8: проверяваме дали вече има инстанция
        if (window.supabase && !sbClient) {
            sbClient = window.supabase.createClient(S_URL, S_KEY);
            setupAuthHandlers();
            checkUserSession();
        }
    } catch (e) { console.error("Грешка при старт:", e); }
}
init();

// 2. ФУНКЦИЯ ЗА ВХОД (РАБОТЕЩА)
function setupAuthHandlers() {
    const submitBtn = document.getElementById('realSubmitBtn');
    if (submitBtn) {
        submitBtn.onclick = async () => {
            const email = document.getElementById('authEmail').value;
            const pass = document.getElementById('authPassword').value;
            const isReg = document.getElementById('authTitle').innerText === 'Регистрация';
            
            try {
                const { data, error } = isReg 
                    ? await sbClient.auth.signUp({ email, password: pass })
                    : await sbClient.auth.signInWithPassword({ email, password: pass });
                
                if (error) throw error;
                alert(isReg ? "Проверете имейла си!" : "Успешен вход!");
                location.reload();
            } catch (err) { alert("Грешка: " + err.message); }
        };
    }
}

// 3. ГЕНЕРИРАНЕ С АФИЛИЕЙТ ЛИНКОВЕ
async function generatePlan(e) {
    e.preventDefault();
    const dest = document.getElementById('destination').value;
    const days = document.getElementById('days').value;
    const affId = "304442"; // Твоят афилиейт ID

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');

    const prompt = `Направи елитен туристически план за ${dest} за ${days} дни. 
    1. ХОТЕЛИ (НАЙ-ОТГОРЕ): Дай 4 опции: Лукс, Бутик, Бюджет, Апартамент. Формат: [ТИП]: [ИМЕ] | [https://www.booking.com/searchresults.html?ss=${dest}&aid=${affId}]
    2. ПРОГРАМА: Раздели всеки ден на СУТРИН, ОБЕД, СЛЕДОБЕД, ВЕЧЕР. Използвай истински имена.
    3. ЛИНКОВЕ: Слагай [Карта/Билети](линк) за всяка локация.`;

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${O_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{role: "system", content: "Ти си професионален травъл дизайнер. Използвай | за линковете в секция Хотели."}, {role: "user", content: prompt}]
            })
        });
        const data = await res.json();
        renderUI(dest, data.choices[0].message.content);
    } catch (err) { alert("Грешка при AI."); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

// 4. ДИЗАЙНЪТ (ВЪЗСТАНОВЕН КАТО НА 000000001.jpg)
function renderUI(dest, content) {
    const res = document.getElementById('result');
    const sections = content.split('###').filter(s => s.trim() !== "");
    
    // Първата секция е с хотелите
    const hotelsText = sections.shift();
    const hotelLines = hotelsText.split('\n').filter(l => l.includes('|'));
    
    let hotelsHtml = hotelLines.map(line => {
        const [type, rest] = line.split(':');
        const [name, url] = rest.split('|');
        return `
        <div class="bg-blue-50/50 p-4 rounded-2xl flex justify-between items-center border border-blue-100">
            <div>
                <p class="text-[9px] font-black text-blue-500 uppercase">${type.trim()}</p>
                <p class="font-bold text-slate-800">${name.trim()}</p>
            </div>
            <a href="${url.trim()}" target="_blank" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-slate-900 transition">РЕЗЕРВИРАЙ</a>
        </div>`;
    }).join('');

    // Останалите секции са дните
    let daysHtml = sections.map(dayText => {
        let dayContent = dayText
            .replace(/СУТРИН:/g, '<div class="mt-4"><b><i class="fas fa-sun text-orange-400 mr-2"></i>СУТРИН:</b>')
            .replace(/ОБЕД:/g, '<div class="mt-4"><b><i class="fas fa-utensils text-emerald-500 mr-2"></i>ОБЕД:</b>')
            .replace(/СЛЕДОБЕД:/g, '<div class="mt-4"><b><i class="fas fa-camera text-blue-400 mr-2"></i>СЛЕДОБЕД:</b>')
            .replace(/ВЕЧЕР:/g, '<div class="mt-4"><b><i class="fas fa-moon text-purple-500 mr-2"></i>ВЕЧЕР:</b>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="ml-2 bg-slate-100 px-2 py-1 rounded text-[10px] text-blue-600 font-bold underline"><i class="fas fa-map-marker-alt"></i> $1</a>');

        return `<div class="bg-white rounded-[2.5rem] p-8 mb-8 shadow-xl border border-slate-50 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                    ${dayContent}
                </div>`;
    }).join('');

    res.innerHTML = `
        <div id="pdfArea" class="max-w-4xl mx-auto">
            <div class="bg-slate-900 p-10 rounded-[3rem] text-white mb-10 border-b-8 border-blue-600">
                <h2 class="text-5xl font-black italic uppercase">${dest}</h2>
                <p class="text-[10px] opacity-40 uppercase tracking-widest mt-2">Personalized AI Itinerary</p>
            </div>

            <div class="bg-white rounded-[2.5rem] p-8 mb-10 shadow-xl border border-blue-100">
                <h4 class="text-sm font-black uppercase text-blue-600 mb-6 italic tracking-widest">Препоръчано настаняване</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${hotelsHtml}</div>
            </div>

            ${daysHtml}

            <div class="flex flex-wrap justify-center gap-6 mt-12 pb-20">
                <button onclick="saveToCloud('${dest}')" class="bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:bg-slate-900 transition flex items-center gap-3">
                    <i class="fas fa-cloud"></i> Запази в Профила
                </button>
                <button onclick="saveToPDF('${dest}')" class="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:bg-slate-900 transition flex items-center gap-3">
                    <i class="fas fa-file-pdf"></i> Свали PDF Програма
                </button>
            </div>
        </div>`;
    
    res.classList.remove('hidden');
    res.scrollIntoView({ behavior: 'smooth' });
}

// 5. ФУНКЦИИ ЗА PDF И ОБЛАК
window.saveToPDF = function(name) {
    const el = document.getElementById('pdfArea');
    html2pdf().set({ margin: 10, filename: name+'.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(el).save();
};

async function saveToCloud(dest) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return alert("Влезте в профила!");
    const content = document.getElementById('pdfArea').innerHTML;
    await sbClient.from('itineraries').insert([{ user_id: user.id, destination: dest, content }]);
    alert("Успешно запазено!");
}
