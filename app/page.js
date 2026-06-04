return (
    <main className="min-h-screen bg-[#090d16] text-white p-8">
      <div className="max-w-md mx-auto space-y-12">
        {/* 標題區域：調整字體大小與層級 */}
        <div className="text-center bg-slate-900 p-8 rounded-3xl border border-emerald-500/30">
          <h1 className="text-5xl font-black mb-2">七賢國小匹克球</h1>
          <p className="text-2xl text-emerald-400 font-bold">新手免費體驗報名</p>
        </div>

        {/* 日期選擇：下方加上時間標記 */}
        <div className="grid grid-cols-3 gap-4">
          {SESSIONS.map(s => (
            <button key={s.id} onClick={() => setDay(s.id)} className={`py-4 rounded-xl font-bold flex flex-col items-center ${day === s.id ? 'bg-emerald-500 text-black' : 'bg-slate-800'}`}>
              <span className="text-2xl">{s.label}</span>
              <span className="text-sm mt-1 opacity-80">19:00-21:20</span>
            </button>
          ))}
        </div>

        {/* 報名表單 */}
        <div className="bg-slate-900 p-8 rounded-3xl space-y-6">
          <input className="w-full p-6 bg-black rounded-2xl text-2xl" placeholder="輸入暱稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <select className="w-full p-6 bg-black rounded-2xl text-2xl" value={form.count} onChange={e => setForm({...form, count: e.target.value})}>
            <option value="1">1 位</option><option value="2">2 位</option>
          </select>
          <input className="w-full p-6 bg-black rounded-2xl text-2xl" type="password" placeholder="4位數取消密碼" maxLength={4} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <button className="w-full bg-emerald-500 p-6 rounded-2xl font-black text-black text-3xl" onClick={submit}>確認報名</button>
        </div>

        {/* 報名清單 */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">目前人數：{list.length} / 9</h2>
          {list.map((item, i) => (
            <div key={item.id} className="bg-slate-900 p-6 rounded-2xl flex justify-between items-center text-xl">
              <span>{item.name} ({item.count}位)</span>
              <button className="text-rose-400 font-bold" onClick={() => {
                const p = prompt('請輸入取消密碼');
                if(p === item.password) { supabase.from('pickleball_registrations').delete().eq('id', item.id).then(load); }
              }}>取消</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );