// Зарежда списъка от базата
async function loadUserItineraries() {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    const { data, error } = await sbClient
        .from('itineraries')
        .select('*')
        .order('created_at', { ascending: false });

    const container = document.getElementById('savedItineraries');
    if (!container) return;

    if (data && data.length > 0) {
        container.innerHTML = data.map(item => `
            <div class="glass p-5 rounded-3xl flex justify-between items-center group hover:border-blue-500/30 transition">
                <div>
                    <h5 class="text-white font-bold text-sm uppercase italic">${item.destination}</h5>
                    <p class="text-[9px] text-slate-500 mt-1">${new Date(item.created_at).toLocaleDateString('bg-BG')}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="viewSaved('${item.id}')" class="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase transition">Виж</button>
                    <button onclick="deleteSaved('${item.id}')" class="text-slate-600 hover:text-red-500 transition px-2"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `).join('');
    }
}

// Показва стара програма в основното поле
window.viewSaved = async (id) => {
    const { data } = await sbClient.from('itineraries').select('*').eq('id', id).single();
    if (data) {
        const res = document.getElementById('result');
        res.innerHTML = data.content;
        res.classList.remove('hidden');
        res.scrollIntoView({ behavior: 'smooth' });
    }
};

// Изтрива програма
window.deleteSaved = async (id) => {
    if (!confirm("Сигурни ли сте?")) return;
    await sbClient.from('itineraries').delete().eq('id', id);
    loadUserItineraries();
};
