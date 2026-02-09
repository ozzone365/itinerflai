async function loadUserItineraries() {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    const { data, error } = await sbClient
        .from('itineraries')
        .select('id, destination, created_at') // Вземаме само метаданните за списъка
        .order('created_at', { ascending: false });

    const container = document.getElementById('savedItineraries');
    if (!container) return;

    if (error) {
        container.innerHTML = `<p class="text-red-500 text-xs text-center">Грешка при зареждане на базата.</p>`;
        return;
    }

    if (data && data.length > 0) {
        container.innerHTML = data.map(item => `
            <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-[2rem] flex justify-between items-center group hover:border-blue-500/50 transition-all shadow-xl">
                <div>
                    <span class="text-[8px] text-blue-500 font-black uppercase tracking-widest mb-1 block">Дестинация</span>
                    <h5 class="text-white font-bold text-base uppercase tracking-tight">${item.destination}</h5>
                    <p class="text-[10px] text-slate-500 mt-1 italic">${new Date(item.created_at).toLocaleDateString('bg-BG')}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="viewSaved('${item.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition shadow-lg shadow-blue-900/20">
                        Отвори
                    </button>
                    <button onclick="deleteSaved('${item.id}')" class="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2 px-3 rounded-xl text-[10px] transition border border-red-500/20">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = `
            <div class="col-span-full border-2 border-dashed border-slate-800 p-10 rounded-[3rem] text-center">
                <p class="text-slate-600 text-[11px] uppercase font-black italic tracking-widest">Все още нямате запазени програми</p>
            </div>`;
    }
}
