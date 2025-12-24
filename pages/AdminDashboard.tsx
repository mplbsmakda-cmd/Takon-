
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, addDoc, deleteDoc, doc, updateDoc, setDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Question, Submission, Class } from '../types';
import { analyzeSentiment, suggestQuestions } from '../services/geminiService';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'statistik' | 'pertanyaan' | 'jawaban' | 'kelas' | 'ai' | 'pengaturan'>('statistik');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [filterClass, setFilterClass] = useState('Semua Kelas');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'rating'>('text');
  const [newClass, setNewClass] = useState('');
  const [eventConfig, setEventConfig] = useState({ title: 'TanyaPintar Siswa', desc: 'Silakan isi pertanyaan.', isOpen: true });
  
  const [aiInsight, setAiInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    const unsubQ = onSnapshot(query(collection(db, "questions"), orderBy("createdAt", "desc")), (snap) => {
      setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Question[]);
    });

    const unsubS = onSnapshot(query(collection(db, "submissions"), orderBy("timestamp", "desc")), (snap) => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Submission[]);
    });

    const unsubC = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, name: d.data().name })) as Class[]);
    });

    const unsubConf = onSnapshot(doc(db, "settings", "eventConfig"), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as any;
        setEventConfig({ 
          title: data.title || 'TanyaPintar Siswa', 
          desc: data.desc || 'Silakan isi pertanyaan.',
          isOpen: data.isOpen !== undefined ? data.isOpen : true 
        });
      }
    });

    return () => { unsubQ(); unsubS(); unsubC(); unsubConf(); };
  }, []);

  const handleSuggest = async () => {
    const topic = prompt("Masukkan topik (Contoh: Kebersihan Kantin):");
    if (!topic) return;
    setSuggesting(true);
    try {
      const suggestions = await suggestQuestions(topic);
      for (const s of suggestions) {
        await addDoc(collection(db, "questions"), {
          text: s.text,
          type: s.type,
          active: false,
          createdAt: Date.now()
        });
      }
      alert("3 Saran pertanyaan telah ditambahkan sebagai draft!");
    } catch (err) {
      alert("AI Gagal memberikan saran.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleExportCSV = () => {
    const header = ["Waktu", "Nama", "Kelas", ...questions.map(q => q.text)];
    const rows = filteredSubmissions.map(s => [
      new Date(s.timestamp).toLocaleString(),
      s.userName,
      s.className,
      ...questions.map(q => s.answers[q.id] || "")
    ]);

    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `data_tanyapintar_${Date.now()}.csv`);
    link.click();
  };

  const handleResetData = async () => {
    const code = Math.random().toString(36).substring(7).toUpperCase();
    const confirmCode = prompt(`PERINGATAN! Ketik "${code}" untuk MENGHAPUS SEMUA JAWABAN:`);
    if (confirmCode === code) {
      setLoading(true);
      try {
        const batch = writeBatch(db);
        submissions.forEach(s => batch.delete(doc(db, "submissions", s.id)));
        await batch.commit();
        alert("Semua jawaban berhasil dihapus.");
      } catch (err) {
        alert("Gagal meriset data.");
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredSubmissions = submissions.filter(s => {
    const matchesClass = filterClass === 'Semua Kelas' || s.className === filterClass;
    const matchesSearch = s.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const ratingQuestions = questions.filter(q => q.type === 'rating');
  const ratingAverages = ratingQuestions.map(q => {
    const relevantAnswers = submissions.filter(s => s.answers[q.id] !== undefined).map(s => Number(s.answers[q.id]));
    const avg = relevantAnswers.length > 0 ? (relevantAnswers.reduce((a, b) => a + b, 0) / relevantAnswers.length).toFixed(1) : '0.0';
    return { text: q.text, avg };
  });

  const participationData = classes.map(c => ({
    name: c.name,
    count: submissions.filter(s => s.className === c.name).length
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Admin Console</h1>
          <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-[10px]">Management Control v4.0 PRO</p>
        </div>
        <div className="flex gap-4">
          <button onClick={handleExportCSV} className="px-6 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs hover:bg-emerald-100 transition shadow-sm border border-emerald-100 flex items-center gap-2">
            <i className="fas fa-file-export"></i> EKSPOR CSV
          </button>
          <button onClick={() => signOut(auth)} className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition shadow-2xl">
            LOGOUT
          </button>
        </div>
      </header>

      <nav className="flex gap-1 mb-10 bg-slate-100 p-1.5 rounded-[2.5rem] w-full overflow-x-auto scrollbar-hide border border-slate-200">
        {(['statistik', 'pertanyaan', 'jawaban', 'kelas', 'ai', 'pengaturan'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab ? 'bg-white text-indigo-600 shadow-xl scale-[1.05]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="animate-in fade-in duration-700">
        {activeTab === 'statistik' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Respon', val: submissions.length, icon: 'fa-users', color: 'indigo' },
                    { label: 'Rata-rata Respon', val: (submissions.length / (classes.length || 1)).toFixed(1), icon: 'fa-chart-line', color: 'emerald' },
                    { label: 'Soal Aktif', val: questions.filter(q => q.active).length, icon: 'fa-question-circle', color: 'amber' },
                    { label: 'Kelas Terdaftar', val: classes.length, icon: 'fa-school', color: 'rose' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                        <i className={`fas ${stat.icon} absolute -right-4 -bottom-4 text-8xl opacity-5 group-hover:scale-110 transition-transform duration-700`}></i>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{stat.label}</p>
                        <p className="text-5xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-10">
              <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm">
                <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center gap-3">
                  <i className="fas fa-chart-pie text-indigo-400"></i> Partisipasi Kelas
                </h3>
                <div className="space-y-8">
                  {participationData.map(c => (
                    <div key={c.name} className="space-y-3">
                      <div className="flex justify-between text-xs font-black uppercase">
                        <span className="text-slate-700">{c.name}</span>
                        <span className="text-indigo-600">{c.count} Siswa</span>
                      </div>
                      <div className="h-8 w-full bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl transition-all duration-1000 shadow-inner shadow-white/20" style={{ width: `${(c.count / (submissions.length || 1)) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                  {classes.length === 0 && <p className="text-center py-10 text-slate-300 italic">Belum ada data partisipasi.</p>}
                </div>
              </div>

              <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm">
                <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center gap-3">
                  <i className="fas fa-star text-amber-400"></i> Nilai Rating Rata-rata
                </h3>
                <div className="space-y-6">
                  {ratingAverages.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <span className="font-bold text-slate-700 text-sm line-clamp-1 flex-1 pr-4">{r.text}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-indigo-600">{r.avg}</span>
                        <div className="flex text-amber-400 text-[10px]">
                           {Array.from({length: 5}).map((_, j) => (
                             <i key={j} className={`${j < Math.round(Number(r.avg)) ? 'fas' : 'far'} fa-star`}></i>
                           ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {ratingAverages.length === 0 && <p className="text-center py-10 text-slate-300 italic">Gunakan pertanyaan tipe 'Rating' untuk melihat statistik ini.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pertanyaan' && (
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm sticky top-24">
                <h3 className="font-black text-slate-900 mb-8 flex items-center justify-between">
                   <span>Input Editor</span>
                   <button 
                    disabled={suggesting}
                    onClick={handleSuggest} 
                    className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-100 transition"
                   >
                     {suggesting ? '...' : 'AI Suggest'}
                   </button>
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); if(newQuestion.trim()) { addDoc(collection(db, "questions"), { text: newQuestion.trim(), type: newQuestionType, active: true, createdAt: Date.now() }); setNewQuestion(''); } }} className="space-y-5">
                  <textarea 
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="Contoh: Seberapa puas kamu dengan..."
                    className="w-full px-7 py-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 h-44 resize-none font-bold text-slate-700"
                  />
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                    <button type="button" onClick={() => setNewQuestionType('text')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition ${newQuestionType === 'text' ? 'bg-white shadow-md' : 'text-slate-400'}`}>Teks</button>
                    <button type="button" onClick={() => setNewQuestionType('rating')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition ${newQuestionType === 'rating' ? 'bg-white shadow-md' : 'text-slate-400'}`}>Rating (1-5)</button>
                  </div>
                  <button className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition">PUBLISH</button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex justify-between items-center group shadow-sm hover:shadow-xl transition-all">
                  <div className="flex items-center gap-6">
                    <span className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">{questions.length - idx}</span>
                    <div>
                      <p className="font-black text-slate-800">{q.text}</p>
                      <div className="flex gap-3 mt-2">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${q.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{q.active ? 'Aktif' : 'Draft'}</span>
                        <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-400">{q.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateDoc(doc(db, "questions", q.id), { active: !q.active })} className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition flex items-center justify-center"><i className={`fas ${q.active ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
                    <button onClick={() => deleteDoc(doc(db, "questions", q.id))} className="w-12 h-12 rounded-2xl bg-red-50 text-red-400 hover:bg-red-100 transition flex items-center justify-center"><i className="fas fa-trash"></i></button>
                  </div>
                </div>
              ))}
              {questions.length === 0 && <div className="text-center py-20 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 text-slate-300 font-bold">Belum ada pertanyaan. Mulai buat sekarang!</div>}
            </div>
          </div>
        )}

        {activeTab === 'jawaban' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
               <div className="relative flex-1 w-full">
                  <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama responden..."
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none font-bold text-slate-700"
                  />
               </div>
               <div className="flex items-center gap-4 w-full md:w-auto">
                 <i className="fas fa-filter text-indigo-400"></i>
                 <select 
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-[2rem] outline-none font-black text-slate-700 uppercase tracking-widest text-xs cursor-pointer flex-1"
                  >
                    <option>Semua Kelas</option>
                    {classes.map(c => <option key={c.id}>{c.name}</option>)}
                  </select>
               </div>
            </div>
            
            <div className="grid gap-8">
              {filteredSubmissions.map(s => (
                  <div key={s.id} className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm hover:border-indigo-100 transition-all group">
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-10 gap-4">
                      <div>
                        <h3 className="text-3xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{s.userName}</h3>
                        <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest flex items-center gap-2">
                           <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{s.className}</span>
                           <span>•</span>
                           <span>{new Date(s.timestamp).toLocaleString('id-ID')}</span>
                        </p>
                      </div>
                      <button onClick={() => deleteDoc(doc(db, "submissions", s.id))} className="w-12 h-12 bg-red-50 text-red-300 hover:text-red-500 rounded-2xl transition-colors flex items-center justify-center self-start"><i className="fas fa-trash-alt"></i></button>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(s.answers).map(([qId, answer]) => (
                        <div key={qId} className="p-7 bg-slate-50/50 rounded-3xl border border-slate-100">
                          <p className="text-[9px] font-black text-indigo-400 uppercase mb-3 opacity-60">
                            {questions.find(q => q.id === qId)?.text || 'Pertanyaan Terhapus'}
                          </p>
                          {typeof answer === 'number' ? (
                             <div className="flex items-center gap-3">
                               <span className="text-2xl font-black text-slate-800">{answer}</span>
                               <div className="flex text-amber-400 text-[10px]">
                                  {Array.from({length: 5}).map((_, j) => <i key={j} className={`${j < answer ? 'fas' : 'far'} fa-star`}></i>)}
                               </div>
                             </div>
                          ) : (
                            <p className="text-base text-slate-700 font-bold leading-relaxed">{answer || '-'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
              ))}
              {filteredSubmissions.length === 0 && <div className="text-center py-20 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 text-slate-300 font-bold">Tidak ada data jawaban yang cocok.</div>}
            </div>
          </div>
        )}

        {activeTab === 'kelas' && (
          <div className="grid md:grid-cols-2 gap-10">
            <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm self-start">
               <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                  <i className="fas fa-school text-indigo-400"></i> Tambah Kelas
               </h3>
               <form onSubmit={(e) => { e.preventDefault(); if(newClass.trim()){ addDoc(collection(db, "classes"), { name: newClass.trim().toUpperCase() }); setNewClass(''); } }} className="space-y-6">
                 <input 
                    type="text" 
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    placeholder="CONTOH: X - IPA 1"
                    className="w-full px-7 py-5 bg-slate-50 border border-slate-200 rounded-[2.5rem] outline-none font-black text-slate-700"
                  />
                  <button className="w-full bg-slate-900 text-white py-5 rounded-[2.5rem] font-black shadow-2xl hover:bg-slate-800 transition">REGRISTRASI KELAS</button>
               </form>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {classes.map(c => (
                <div key={c.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-all shadow-sm">
                  <span className="font-black text-slate-800 text-sm tracking-tight">{c.name}</span>
                  <button onClick={() => deleteDoc(doc(db, "classes", c.id))} className="text-slate-200 hover:text-red-500 transition-colors">
                    <i className="fas fa-times-circle text-2xl"></i>
                  </button>
                </div>
              ))}
              {classes.length === 0 && <div className="col-span-2 text-center py-10 text-slate-300 italic">Daftar kelas masih kosong.</div>}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-10">
             <div className="bg-gradient-to-br from-slate-900 to-indigo-900 p-20 rounded-[5rem] text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="grid grid-cols-12 h-full gap-4 p-10">
                        {Array.from({length: 48}).map((_, i) => <div key={i} className="bg-white rounded-full h-2 w-2"></div>)}
                    </div>
                </div>
                <h3 className="text-4xl font-black text-white mb-6">Analisis Strategis AI</h3>
                <p className="max-w-xl mx-auto text-indigo-100/60 font-medium mb-12 text-lg">Gunakan Gemini 3 Pro untuk mengekstrak poin-poin penting dari ratusan aspirasi siswa secara instan.</p>
                <button 
                  disabled={loading || submissions.length === 0}
                  onClick={async () => { setLoading(true); const insight = await analyzeSentiment(submissions); setAiInsight(insight); setLoading(false); }}
                  className="px-16 py-6 bg-white text-indigo-950 rounded-[2.5rem] font-black text-sm shadow-2xl hover:scale-[1.05] transition-transform disabled:opacity-50"
                >
                  {loading ? 'MEMPROSES DATA...' : 'JALANKAN ANALISIS GEMINI'}
                </button>
             </div>
             {aiInsight && (
               <div className="bg-white p-16 rounded-[5rem] border border-indigo-100 shadow-2xl shadow-indigo-100/50 animate-in slide-in-from-bottom-10">
                 <div className="flex items-center justify-between mb-10">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-full">Laporan Analisis Otomatis</span>
                    <button onClick={() => setAiInsight('')} className="text-slate-300 hover:text-slate-600 transition"><i className="fas fa-times-circle text-2xl"></i></button>
                 </div>
                 <div className="prose prose-indigo max-w-none text-slate-700 font-bold text-lg leading-loose whitespace-pre-wrap">
                   {aiInsight}
                 </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'pengaturan' && (
           <div className="grid md:grid-cols-2 gap-10">
              <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm space-y-12">
                 <h3 className="text-2xl font-black text-slate-900">Branding & Akses</h3>
                 <div className="space-y-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Portal Status</label>
                      <button 
                        onClick={() => setDoc(doc(db, "settings", "eventConfig"), { ...eventConfig, isOpen: !eventConfig.isOpen })}
                        className={`w-full py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-4 ${eventConfig.isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
                      >
                         <i className={`fas ${eventConfig.isOpen ? 'fa-unlock' : 'fa-lock'}`}></i>
                         {eventConfig.isOpen ? 'PORTAL TERBUKA (MAHASISWA BISA MENGISI)' : 'PORTAL TERTUTUP (MAHASISWA TIDAK BISA MENGISI)'}
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Judul Event</label>
                      <input 
                        type="text" 
                        value={eventConfig.title}
                        onChange={(e) => setEventConfig({...eventConfig, title: e.target.value})}
                        className="w-full px-7 py-5 bg-slate-50 border border-slate-200 rounded-[2.5rem] outline-none font-black text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Instruksi Form</label>
                      <textarea 
                        value={eventConfig.desc}
                        onChange={(e) => setEventConfig({...eventConfig, desc: e.target.value})}
                        className="w-full px-7 py-5 bg-slate-50 border border-slate-200 rounded-[2.5rem] outline-none h-40 resize-none font-bold text-slate-600 leading-relaxed"
                      />
                    </div>
                    <button 
                      onClick={() => { setLoading(true); setDoc(doc(db, "settings", "eventConfig"), eventConfig).then(() => { setLoading(false); alert("Berhasil disimpan!"); }); }}
                      className="w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition"
                    >
                      SIMPAN KONFIGURASI
                    </button>
                 </div>
              </div>

              <div className="space-y-10">
                <div className="bg-red-50 p-14 rounded-[4rem] border border-red-100 shadow-xl shadow-red-100/50">
                  <h3 className="text-2xl font-black text-red-600 mb-6 flex items-center gap-3">
                    <i className="fas fa-trash-restore"></i> Data Wipeout
                  </h3>
                  <p className="text-sm font-bold text-red-800/60 leading-relaxed mb-10">
                    Fitur ini akan menghapus seluruh database jawaban secara permanen. Pastikan Anda telah melakukan ekspor CSV terlebih dahulu sebelum melakukan tindakan ini.
                  </p>
                  <button 
                    onClick={handleResetData}
                    className="w-full py-6 bg-red-600 text-white rounded-[2.5rem] font-black shadow-2xl hover:bg-red-700 transition"
                  >
                    RESET SEMUA JAWABAN
                  </button>
                </div>
                
                <div className="bg-indigo-950 p-14 rounded-[4rem] text-white shadow-2xl">
                   <h3 className="text-2xl font-black mb-6">Info Sistem</h3>
                   <div className="space-y-4 text-sm font-medium opacity-70">
                      <div className="flex justify-between"><span>Versi App</span><span>4.0.0-PRO</span></div>
                      <div className="flex justify-between"><span>Mode Database</span><span>Persistence Active</span></div>
                      <div className="flex justify-between"><span>AI Model</span><span>Gemini-3-Pro-Preview</span></div>
                      <div className="flex justify-between"><span>Hosting</span><span>Firebase Stable</span></div>
                   </div>
                </div>
              </div>
           </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[100]">
           <div className="text-center">
              <div className="w-20 h-20 border-8 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
              <p className="text-white font-black tracking-[0.5em] text-xs">PROCESSING REQUEST</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
