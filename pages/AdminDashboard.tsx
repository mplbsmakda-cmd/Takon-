
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, addDoc, deleteDoc, doc, updateDoc, setDoc, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Question, Submission, Class, AppConfig } from '../types';
import { analyzeSentiment, suggestQuestions, getQuickPulse } from '../services/geminiService';
import Toast, { ToastType } from '../components/Toast';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'statistik' | 'pertanyaan' | 'jawaban' | 'kelas' | 'ai' | 'pengaturan'>('statistik');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  // States
  const [filterClass, setFilterClass] = useState('Semua Kelas');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{msg: string, type: ToastType} | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  
  // New Question Form
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'rating'>('text');
  const [targetType, setTargetType] = useState<'global' | 'specific'>('global');
  const [selectedTargetClasses, setSelectedTargetClasses] = useState<string[]>([]);

  const [eventConfig, setEventConfig] = useState<AppConfig>({ 
    title: 'TanyaPintar Siswa', 
    desc: 'Silakan isi aspirasi Anda.', 
    isOpen: true,
    brandColor: '#4f46e5',
    logoUrl: ''
  });

  const [aiInsight, setAiInsight] = useState('');
  const [aiPulse, setAiPulse] = useState('Menganalisis suasana...');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const showToast = (msg: string, type: ToastType = 'success') => setToast({ msg, type });

  useEffect(() => {
    const unsubQ = onSnapshot(query(collection(db, "questions"), orderBy("createdAt", "desc")), (snap) => {
      setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Question[]);
    });

    const unsubS = onSnapshot(query(collection(db, "submissions"), orderBy("timestamp", "desc")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Submission[];
      setSubmissions(data);
      if (data.length > 0) {
        getQuickPulse(data).then(setAiPulse);
      }
    });

    const unsubC = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, name: d.data().name })) as Class[]);
    });

    const unsubConf = onSnapshot(doc(db, "settings", "eventConfig"), (doc) => {
      if (doc.exists()) {
        setEventConfig(doc.data() as AppConfig);
      }
    });

    return () => { unsubQ(); unsubS(); unsubC(); unsubConf(); };
  }, []);

  const handleExportCSV = () => {
    if (submissions.length === 0) return showToast("Tidak ada data untuk diekspor", "error");
    const headers = ['Timestamp', 'Nama', 'Kelas', ...questions.map(q => q.text)];
    const csvContent = [
      headers.join(','),
      ...submissions.map(s => {
        const row = [
          new Date(s.timestamp).toLocaleString(),
          `"${s.userName.replace(/"/g, '""')}"`,
          s.className,
          ...questions.map(q => {
            const ans = s.answers[q.id] || '';
            return `"${ans.toString().replace(/"/g, '""')}"`;
          })
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TanyaPintar_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    showToast("Data CSV berhasil diunduh");
  };

  const handleClearData = async () => {
    const confirmText = prompt("Ketik 'HAPUS' untuk menghapus semua data respon siswa:");
    if (confirmText !== 'HAPUS') return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const snap = await getDocs(collection(db, "submissions"));
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast("Seluruh data respon berhasil dibersihkan");
    } catch (e) {
      showToast("Gagal membersihkan data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    try {
      await updateDoc(doc(db, "questions", editingQuestion.id), {
        text: editingQuestion.text,
        type: editingQuestion.type,
        targetType: editingQuestion.targetType,
        targetClasses: editingQuestion.targetClasses
      });
      setEditingQuestion(null);
      showToast("Pertanyaan berhasil diperbarui");
    } catch (e) {
      showToast("Gagal memperbarui pertanyaan", "error");
    }
  };

  const handleCopyLink = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    showToast("Link portal berhasil disalin!");
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchesClass = filterClass === 'Semua Kelas' || s.className === filterClass;
      const matchesSearch = s.userName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [submissions, filterClass, searchQuery]);

  const statsByClass = useMemo(() => {
    const ratings = questions.filter(q => q.type === 'rating');
    return classes.map(c => {
      const classSubmissions = submissions.filter(s => s.className === c.name);
      let totalRating = 0;
      let count = 0;
      classSubmissions.forEach(s => {
        ratings.forEach(q => {
          if (s.answers[q.id]) {
            totalRating += Number(s.answers[q.id]);
            count++;
          }
        });
      });
      return {
        name: c.name,
        avg: count > 0 ? (totalRating / count).toFixed(1) : '0.0',
        count: classSubmissions.length
      };
    }).sort((a, b) => Number(b.avg) - Number(a.avg));
  }, [classes, submissions, questions]);

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
        <div className="flex items-center gap-4">
          {eventConfig.logoUrl && <img src={eventConfig.logoUrl} className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white" alt="Logo" />}
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Admin <span className="text-indigo-600">Platinum</span></h1>
            <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-[10px]">Cloud Management System v5.0</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleCopyLink} className="p-4 bg-white text-indigo-600 rounded-2xl font-black text-xs hover:bg-indigo-50 transition shadow-sm border border-slate-100 flex items-center gap-2">
            <i className="fas fa-link"></i> <span className="hidden sm:inline">SALIN LINK</span>
          </button>
          <button onClick={handleExportCSV} className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs hover:bg-emerald-100 transition flex items-center gap-2">
            <i className="fas fa-file-export"></i> <span className="hidden sm:inline">CSV</span>
          </button>
          <button onClick={() => signOut(auth)} className="p-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition shadow-xl">
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

      <div className="animate-in fade-in duration-500">
        {activeTab === 'statistik' && (
          <div className="space-y-10">
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
               <div className="relative z-10 max-w-2xl">
                 <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-black uppercase">Gemini AI Pulse</span>
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                 </div>
                 <h2 className="text-4xl font-black leading-tight tracking-tight italic">"{aiPulse}"</h2>
               </div>
               <i className="fas fa-brain absolute -right-8 -bottom-8 text-[12rem] opacity-10 group-hover:scale-110 transition-transform duration-1000"></i>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Respon', val: submissions.length, icon: 'fa-user-check', color: 'indigo' },
                    { label: 'Rata-rata Respon', val: (submissions.length / (classes.length || 1)).toFixed(1), icon: 'fa-chart-pie', color: 'emerald' },
                    { label: 'Soal Aktif', val: questions.filter(q => q.active).length, icon: 'fa-file-signature', color: 'amber' },
                    { label: 'Kepuasan (%)', val: (statsByClass.reduce((a, b) => a + Number(b.avg), 0) / (statsByClass.length || 1) * 20).toFixed(0) + '%', icon: 'fa-heart', color: 'rose' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{stat.label}</p>
                        <p className="text-5xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
                        <div className={`absolute top-0 right-0 w-16 h-16 bg-${stat.color}-50 rounded-bl-[3rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <i className={`fas ${stat.icon} text-lg text-${stat.color}-500`}></i>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <i className="fas fa-medal text-amber-500"></i> Leaderboard Kelas
                    </h3>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urutan berdasarkan Rating Tertinggi</div>
                </div>
                <div className="grid gap-4">
                  {statsByClass.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-8 p-6 bg-slate-50/50 rounded-3xl hover:bg-white hover:shadow-xl hover:scale-[1.01] transition-all border border-transparent hover:border-indigo-100">
                      <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-xs font-black text-slate-400">{i + 1}</div>
                      <div className="w-24 text-sm font-black text-slate-700">{c.name}</div>
                      <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000" 
                          style={{ width: `${(Number(c.avg) / 5) * 100}%` }}
                        ></div>
                      </div>
                      <div className="w-14 text-xl font-black text-indigo-600">{c.avg}</div>
                      <div className="text-[10px] font-bold text-slate-400 w-24 text-right uppercase tracking-tighter">{c.count} Respon</div>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'pertanyaan' && (
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm sticky top-24">
                <h3 className="font-black text-slate-900 mb-8 flex items-center justify-between">
                   <span className="text-xl tracking-tight">{editingQuestion ? 'Edit Pertanyaan' : 'Buat Baru'}</span>
                   {!editingQuestion && (
                        <button disabled={suggesting} onClick={async () => {
                            const topic = prompt("Topik apa?");
                            if(!topic) return;
                            setSuggesting(true);
                            const res = await suggestQuestions(topic);
                            for(const q of res) await addDoc(collection(db, "questions"), { ...q, active: false, createdAt: Date.now(), targetType: 'global' });
                            setSuggesting(false);
                            showToast("3 Draft AI berhasil ditambahkan");
                        }} className="text-[9px] bg-indigo-600 text-white px-3 py-1.5 rounded-full font-black uppercase hover:bg-indigo-700 transition">
                            <i className="fas fa-magic mr-1"></i> {suggesting ? '...' : 'AI'}
                        </button>
                   )}
                </h3>
                
                <form onSubmit={editingQuestion ? handleUpdateQuestion : async (e) => {
                  e.preventDefault();
                  if (!newQuestion.trim()) return;
                  await addDoc(collection(db, "questions"), {
                    text: newQuestion.trim(),
                    type: newQuestionType,
                    active: true,
                    createdAt: Date.now(),
                    targetType,
                    targetClasses: targetType === 'specific' ? selectedTargetClasses : []
                  });
                  setNewQuestion('');
                  setSelectedTargetClasses([]);
                  showToast("Pertanyaan berhasil dipublikasi");
                }} className="space-y-6">
                  <textarea 
                    value={editingQuestion ? editingQuestion.text : newQuestion} 
                    onChange={(e) => editingQuestion ? setEditingQuestion({...editingQuestion, text: e.target.value}) : setNewQuestion(e.target.value)} 
                    placeholder="Tuliskan pertanyaan di sini..." 
                    className="w-full px-6 py-5 bg-slate-50 rounded-3xl border border-slate-100 focus:ring-4 focus:ring-indigo-100 h-32 resize-none font-bold text-slate-700" 
                  />
                  
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tipe Konten</label>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                        {(['text', 'rating'] as const).map(t => (
                            <button 
                                key={t}
                                type="button" 
                                onClick={() => editingQuestion ? setEditingQuestion({...editingQuestion, type: t}) : setNewQuestionType(t)} 
                                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${
                                    (editingQuestion ? editingQuestion.type : newQuestionType) === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                                }`}
                            >
                                {t === 'text' ? 'Jawaban Teks' : 'Skala Rating'}
                            </button>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Distribusi Target</label>
                    <select 
                        value={editingQuestion ? editingQuestion.targetType : targetType} 
                        onChange={(e) => {
                            const val = e.target.value as any;
                            editingQuestion ? setEditingQuestion({...editingQuestion, targetType: val}) : setTargetType(val);
                        }} 
                        className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-700 appearance-none"
                    >
                      <option value="global">Seluruh Kelas (Global)</option>
                      <option value="specific">Pilih Kelas Spesifik</option>
                    </select>
                    
                    {(editingQuestion ? editingQuestion.targetType : targetType) === 'specific' && (
                      <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-3xl border border-slate-100 max-h-40 overflow-y-auto scrollbar-hide">
                        {classes.map(c => {
                          const isSel = (editingQuestion?.targetClasses || selectedTargetClasses).includes(c.name);
                          return (
                            <button 
                                key={c.id} 
                                type="button" 
                                onClick={() => {
                                    const list = editingQuestion ? (editingQuestion.targetClasses || []) : selectedTargetClasses;
                                    const newList = list.includes(c.name) ? list.filter(x => x !== c.name) : [...list, c.name];
                                    editingQuestion ? setEditingQuestion({...editingQuestion, targetClasses: newList}) : setSelectedTargetClasses(newList);
                                }} 
                                className={`px-3 py-3 rounded-xl text-[8px] font-black border transition-all ${
                                    isSel ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-[0.98]' : 'bg-white border-slate-100 text-slate-400'
                                }`}
                            >
                                {c.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {editingQuestion && (
                        <button type="button" onClick={() => setEditingQuestion(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black">BATAL</button>
                    )}
                    <button className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95">
                        {editingQuestion ? 'SIMPAN PERUBAHAN' : 'PUBLIKASIKAN'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center px-6 mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{questions.length} Total Pertanyaan</span>
                <div className="flex gap-4">
                    <button onClick={async () => {
                        const batch = writeBatch(db);
                        questions.forEach(q => batch.update(doc(db, "questions", q.id), { active: true }));
                        await batch.commit();
                        showToast("Semua pertanyaan diaktifkan");
                    }} className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Aktifkan Semua</button>
                    <button onClick={async () => {
                        const batch = writeBatch(db);
                        questions.forEach(q => batch.update(doc(db, "questions", q.id), { active: false }));
                        await batch.commit();
                        showToast("Semua pertanyaan dinonaktifkan");
                    }} className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Draft Semua</button>
                </div>
              </div>
              
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 group hover:shadow-2xl transition-all border-transparent hover:border-indigo-50">
                  <div className="flex items-center gap-6">
                    <span className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        {questions.length - idx}
                    </span>
                    <div>
                      <p className="font-black text-slate-800 text-lg leading-tight">{q.text}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${q.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {q.active ? 'Aktif' : 'Draft'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-400">{q.type}</span>
                        <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-600">
                            {q.targetType === 'global' ? '🌍 Global' : '🎯 Spesifik'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-auto">
                    <button onClick={() => setEditingQuestion(q)} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition flex items-center justify-center"><i className="fas fa-edit"></i></button>
                    <button onClick={() => updateDoc(doc(db, "questions", q.id), { active: !q.active })} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition flex items-center justify-center"><i className={`fas ${q.active ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
                    <button onClick={() => {
                        if(confirm("Hapus pertanyaan ini?")) {
                            deleteDoc(doc(db, "questions", q.id));
                            showToast("Pertanyaan dihapus", "info");
                        }
                    }} className="w-12 h-12 rounded-2xl bg-red-50 text-red-300 hover:text-red-500 transition flex items-center justify-center"><i className="fas fa-trash"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'jawaban' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
              <div className="relative flex-1 w-full">
                <i className="fas fa-search absolute left-8 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama responden..." className="w-full pl-16 pr-8 py-5 bg-slate-50 rounded-[2rem] outline-none font-bold text-slate-700 border-none focus:ring-4 focus:ring-indigo-100 transition-all" />
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="flex-1 md:flex-none bg-slate-50 border-none px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors">
                    <option>Semua Kelas</option>
                    {classes.map(c => <option key={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            
            <div className="grid gap-8">
              {filteredSubmissions.map(s => (
                <div key={s.id} className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-12 gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{s.userName}</h3>
                        <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">{s.className}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="far fa-clock"></i> {new Date(s.timestamp).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(s.answers).map(([qId, ans]) => (
                      <div key={qId} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100/50 group hover:bg-white hover:shadow-xl transition-all">
                        <p className="text-[9px] font-black text-indigo-400 uppercase mb-4 opacity-70 flex items-center gap-2">
                           <i className="fas fa-question-circle text-[10px]"></i>
                           <span className="line-clamp-1">{questions.find(q => q.id === qId)?.text || 'Pertanyaan Terhapus'}</span>
                        </p>
                        <p className="text-lg text-slate-700 font-bold leading-relaxed">{ans}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredSubmissions.length === 0 && (
                <div className="py-24 text-center">
                    <i className="fas fa-search text-6xl text-slate-100 mb-6"></i>
                    <p className="text-slate-400 font-bold">Tidak ada respon yang ditemukan.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-10">
             <div className="bg-slate-900 p-20 rounded-[5rem] text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                    <div className="absolute top-10 left-10 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] animate-pulse"></div>
                    <div className="absolute bottom-10 right-10 w-64 h-64 bg-violet-500 rounded-full blur-[100px] animate-pulse delay-700"></div>
                </div>
                <div className="relative z-10">
                    <h3 className="text-5xl font-black text-white mb-6 tracking-tighter">Strategic Insights</h3>
                    <p className="max-w-xl mx-auto text-slate-400 font-medium mb-12 text-lg">Ekstrak pola perilaku dan rekomendasi kebijakan sekolah secara cerdas menggunakan mesin Gemini 3 Pro.</p>
                    <button 
                    disabled={loading || submissions.length === 0}
                    onClick={async () => { 
                        setLoading(true); 
                        try {
                            const insight = await analyzeSentiment(submissions); 
                            setAiInsight(insight); 
                            showToast("Analisis AI Selesai");
                        } catch(e) { showToast("AI sedang sibuk, coba lagi", "error"); }
                        setLoading(false); 
                    }}
                    className="px-16 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-sm shadow-2xl hover:scale-[1.05] hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    {loading ? (
                        <span className="flex items-center gap-3">
                            <i className="fas fa-circle-notch animate-spin"></i> MEMPROSES DATA...
                        </span>
                    ) : 'JALANKAN ANALISIS SEKARANG'}
                    </button>
                    {submissions.length === 0 && <p className="mt-4 text-rose-400 text-xs font-bold uppercase tracking-widest">Minimal harus ada 1 respon</p>}
                </div>
             </div>
             {aiInsight && (
               <div className="bg-white p-16 rounded-[5rem] border border-indigo-100 shadow-2xl animate-in slide-in-from-bottom-10">
                 <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-50">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                        <i className="fas fa-file-alt text-xl"></i>
                    </div>
                    <h4 className="text-2xl font-black text-slate-900 tracking-tight">Executive Summary Report</h4>
                 </div>
                 <div className="prose prose-indigo max-w-none text-slate-700 font-bold text-lg leading-loose whitespace-pre-wrap">{aiInsight}</div>
                 <div className="mt-12 flex justify-end">
                    <button onClick={() => window.print()} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs hover:bg-slate-200 transition uppercase tracking-widest">Cetak Laporan</button>
                 </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'pengaturan' && (
          <div className="grid md:grid-cols-2 gap-10">
            <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm space-y-12">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3"><i className="fas fa-paint-brush text-indigo-400"></i> Identitas Visual</h3>
              <div className="space-y-8">
                <div className="flex gap-8 items-end">
                    <div className="flex-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Warna Utama Brand</label>
                        <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
                            <input type="color" value={eventConfig.brandColor} onChange={(e) => setEventConfig({...eventConfig, brandColor: e.target.value})} className="w-12 h-12 rounded-full cursor-pointer border-none p-0 overflow-hidden outline-none bg-transparent" />
                            <span className="font-black text-slate-700 font-mono">{eventConfig.brandColor}</span>
                        </div>
                    </div>
                    {eventConfig.logoUrl && <div className="w-20 h-20 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-center overflow-hidden"><img src={eventConfig.logoUrl} className="w-full h-full object-cover" /></div>}
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Logo Sekolah (URL Gambar)</label>
                  <input type="text" value={eventConfig.logoUrl} onChange={(e) => setEventConfig({...eventConfig, logoUrl: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="https://link-gambar-logo.com/logo.png" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Judul Portal Publik</label>
                  <input type="text" value={eventConfig.title} onChange={(e) => setEventConfig({...eventConfig, title: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" />
                </div>
                <button onClick={async () => {
                  setLoading(true);
                  await setDoc(doc(db, "settings", "eventConfig"), eventConfig);
                  setLoading(false);
                  showToast("Pengaturan brand disimpan");
                }} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black shadow-2xl hover:bg-slate-800 transition active:scale-95">SIMPAN PERUBAHAN BRAND</button>
              </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-6 transition-all ${eventConfig.isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        <i className={`fas ${eventConfig.isOpen ? 'fa-door-open' : 'fa-door-closed'}`}></i>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-4">Status Portal</h3>
                    <p className="text-slate-500 font-medium mb-10 max-w-xs">Matikan portal saat sesi berakhir untuk mencegah data ilegal masuk.</p>
                    <button 
                        onClick={() => {
                            const newState = !eventConfig.isOpen;
                            setDoc(doc(db, "settings", "eventConfig"), { ...eventConfig, isOpen: newState });
                            showToast(newState ? "Portal Dibuka" : "Portal Ditutup", newState ? "success" : "info");
                        }}
                        className={`px-12 py-5 rounded-[2.5rem] font-black transition-all shadow-xl ${eventConfig.isOpen ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                    >
                        {eventConfig.isOpen ? 'MATIKAN PORTAL' : 'AKTIFKAN PORTAL'}
                    </button>
                </div>

                <div className="bg-rose-50/30 p-12 rounded-[4rem] border border-rose-100 text-center">
                    <h4 className="text-rose-600 font-black text-lg mb-4">Danger Zone</h4>
                    <p className="text-rose-400 text-xs font-bold mb-8">Data yang sudah dihapus tidak dapat dikembalikan lagi. Harap ekspor CSV sebelum melakukan reset.</p>
                    <button onClick={handleClearData} className="px-10 py-4 bg-white text-rose-500 rounded-2xl font-black text-xs border border-rose-200 hover:bg-rose-500 hover:text-white transition-all">BERSIHKAN SEMUA DATA RESPON</button>
                </div>
            </div>
          </div>
        )}

        {/* Keeping Kelas Tab */}
        {activeTab === 'kelas' && (
          <div className="grid md:grid-cols-2 gap-10">
            <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm self-start">
               <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center gap-3"><i className="fas fa-users-cog text-indigo-400"></i> Kelola Daftar Kelas</h3>
               <form onSubmit={(e) => { 
                    e.preventDefault(); 
                    const c = (e.target as any).classNameInput.value; 
                    if(c.trim()){ 
                        addDoc(collection(db, "classes"), { name: c.trim().toUpperCase() }); 
                        (e.target as any).reset(); 
                        showToast("Kelas ditambahkan");
                    } 
                }} className="space-y-6">
                 <input name="classNameInput" type="text" placeholder="Masukkan Nama Kelas (Misal: XII IPA 1)" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2.5rem] outline-none font-black text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all uppercase" />
                  <button className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black shadow-2xl hover:bg-slate-800 transition active:scale-95">DAFTARKAN KELAS</button>
               </form>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
              {classes.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-all shadow-sm">
                  <span className="font-black text-slate-700 text-sm tracking-tight">{c.name}</span>
                  <button onClick={() => {
                        if(confirm(`Hapus kelas ${c.name}?`)) {
                            deleteDoc(doc(db, "classes", c.id));
                            showToast("Kelas dihapus", "info");
                        }
                    }} className="text-slate-200 hover:text-rose-500 transition-all transform hover:scale-125">
                        <i className="fas fa-minus-circle text-xl"></i>
                  </button>
                </div>
              ))}
              {classes.length === 0 && <div className="col-span-2 py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Belum ada kelas</div>}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in">
           <div className="flex flex-col items-center">
                <div className="w-20 h-20 border-[6px] border-indigo-600 border-t-transparent rounded-full animate-spin shadow-2xl"></div>
                <p className="mt-6 text-white font-black text-xs uppercase tracking-[0.3em] drop-shadow-lg">Memproses Cloud Data</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
