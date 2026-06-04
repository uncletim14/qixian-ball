'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSIONS = [
  { id: 'mon', label: '週一場' },
  { id: 'fri', label: '週五場' },
  { id: 'sat', label: '週六場' }
];

export default function Home() {
  const [day, setDay] = useState('mon');
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', count: '1', password: '' });

  const load = async () => {
    // 這裡改對應到 newrookie 表
    const { data } = await supabase.from('newrookie').select('*').order('created_at', { ascending: true });
    if (data) setList(data.filter(item => item.session_id === day));
  };

  useEffect(() => { load(); }, [day]);

  const submit = async () => {
    if (!form.name || form.password.length !== 4) { alert('請輸入暱稱與4位密碼'); return; }
    // 這裡改對應到 newrookie 表
    const { error } = await supabase.from('newrookie').insert([{
      name: form.name, count: parseInt(form.count), password: form.password, session_id: day, created_at: new Date().toISOString()
    }]);
    if (error) alert('報名失敗：' + error.message);
    else { alert('報名成功！'); setForm({ name: '', count: '1', password: '' }); load(); }
  };

  return (
    <main className="min-h-screen bg-[#090d16] text-white p-8">
      {/* (下方 UI 維持不變) */}
      <div className="max-w-md mx-auto space-y-10">
        <h1 className="text-5xl font-black text-center">七賢國小匹克球</h1>
        {/* ... (其餘 UI 與上面提供的版本一致) ... */}
      </div>
    </main>
  );
}