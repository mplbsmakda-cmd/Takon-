
import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, Class, AppConfig } from '../types';
import Toast, { ToastType } from '../components/Toast';

const PublicPortal: React.FC = () => {
  const [userName, setUserName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [toast, setToast] = useState<{msg: string, type: ToastType} | null>(null);
  
  const [eventInfo, setEventInfo] = useState<AppConfig>({ 
    title: 'Sesi Tanya Jawab', 
    desc: 'Silakan isi formulir aspirasi.', 
    isOpen: true,
    brandColor: '#4f46e5'
  });
  
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); 

  const showToast = (msg: string, type: ToastType = 'success') => setToast({ msg, type });

  useEffect(() => {
    if (sessionStorage.getItem('tp_submitted')) {
      setSubmitted(true);
      setLoading(false);
      return;
    }

    const unsubConfig = onSnapshot(doc(db, "settings", "eventConfig"), (doc) => {
      if (doc.exists()) {
        setEventInfo(doc.data() as AppConfig);
      }
    });

    const qQuery = query(collection(db, "questions"), where("active", "==", true));
    const unsubQuestions = onSnapshot(qQuery, (snapshot) => {
      const allActive = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Question[];
      setQuestions(allActive);
      setLoading(false);
    });

    const unsubClasses = onSnapshot(collection(db, "classes"), (snapshot) => {
      const sorted = snapshot.docs.map(d => ({ id: d.id, name: d.data().name })) as Class[];
      setClasses(sorted.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => { unsubQuestions(); unsubClasses(); unsubConfig(); };
  }, []);

  useEffect(() => {
    if (selectedClass) {
      const filtered = questions.filter(q => 
        q.targetType === 'global' || 
        (q.targetType === 'specific' && q.targetClasses?.includes(selectedClass))
      );
      setFilteredQuestions(filtered);
    }
  }, [selectedClass, questions]);

  const handleAnswerChange = (qId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [qId]: value })); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventInfo.isOpen) return showToast("Sesi pendaftaran sudah ditutup.", "error");
    
    // Check if all questions answered
    const unanswered = filteredQuestions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) return showToast(`Harap lengkapi ${unanswered.length} pertanyaan lagi.`, "error");

    setLoading(true);
    try {
      await addDoc(collection(db, "submissions"), {
        userName: userName.trim(),
        className: selectedClass,
        answers,
        timestamp: Date.now()
      });
      sessionStorage.setItem('tp_submitted', 'true');
      setSubmitted(true);
      showToast("Berhasil mengirim aspirasi!");
    } catch (err) {
      showToast("Gagal mengirim, periksa koneksi internet.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading && step === 1) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!eventInfo.isOpen && !submitted) return (
    <div className="max-w-md mx-auto mt-20 bg-white p-14 rounded-[4rem] shadow-2xl text-center border border-slate-50 animate-in zoom-in">
      <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-amber-100">
        <i className="fas fa-lock text-4xl"></i>
      </div>
      <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Pendaftaran Ditutup</h2>
      <p className="text-slate-500 font-medium leading-relaxed">Terima kasih atas minat Anda. Sesi pengambilan data untuk saat ini telah berakhir.</p>
    </div>
  );

  if (submitted) return (
    <div className="max-w-md mx-auto mt-20 bg-white p-14 rounded-[4rem] shadow-2xl text-center border border-slate-50 animate-in zoom-in">
      <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-emerald-100">
        <i className="fas fa-check-double text-4xl"></i>
      </div>
      <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Terima Kasih!</h2>
      <p className="text-slate-500 font-medium leading-relaxed">Data Anda telah kami terima dengan aman. Aspirasi Anda sangat berharga bagi kemajuan sekolah.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex justify-between items-center mb-10 px-6">
        <div className="flex gap-2.5">
            {[1, 2, 3].map(s => (
                <div key={s} className={`h-2.5 rounded-full transition-all duration-700 ${step >= s ? 'w-14 shadow-lg' : 'w-5 bg-slate-200 opacity-50'}`} style={{backgroundColor: step >= s ? eventInfo.brandColor : undefined}}></div>
            ))}
        </div>
        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tahap {step} dari 3</div>
      </div>

      <div className="bg-white/90 backdrop-blur-2xl p-10 md:p-16 rounded-[4.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-white">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center gap-6 mb-10">
                {eventInfo.logoUrl && <img src={eventInfo.logoUrl} className="w-20 h-20 rounded-[2rem] object-cover shadow-2xl border-4 border-white" alt="School" />}
                <div>
                    <h1 className="text-4xl font-black text-slate-900 leading-none tracking-tight mb-2">{eventInfo.title}</h1>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Portal Aspirasi Digital</span>
                </div>
            </div>
            <p className="text-slate-500 mb-12 text-lg leading-relaxed font-medium">{eventInfo.desc}</p>
            <div className="space-y-6">
              <div className="relative group">
                <i className="fas fa-user-edit absolute left-7 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
                <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Masukkan nama lengkap Anda"
                    className="w-full pl-16 pr-8 py-6 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-[2rem] outline-none font-bold text-slate-700 placeholder:text-slate-300 transition-all focus:bg-white focus:shadow-xl"
                />
              </div>
              <button 
                disabled={!userName.trim()}
                onClick={() => setStep(2)}
                className="w-full py-6 text-white rounded-[2rem] font-black shadow-2xl shadow-indigo-200 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-30 disabled:grayscale"
                style={{backgroundColor: eventInfo.brandColor}}
              >
                MULAI SEKARANG <i className="fas fa-arrow-right ml-3 text-xs"></i>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-4xl font-black text-slate-900 mb-10 tracking-tight">Pilih Kelas</h2>
            <div className="grid grid-cols-2 gap-4 mb-12 max-h-[45vh] overflow-y-auto scrollbar-hide p-2">
              {classes.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClass(c.name)}
                  className={`p-6 rounded-[2.5rem] border-2 font-black text-sm transition-all flex items-center justify-between group ${
                    selectedClass === c.name 
                    ? 'shadow-2xl scale-[1.02]' 
                    : 'border-slate-50 bg-slate-50/50 text-slate-500 hover:bg-slate-50 hover:border-slate-100'
                  }`}
                  style={{ 
                    borderColor: selectedClass === c.name ? eventInfo.brandColor : undefined,
                    color: selectedClass === c.name ? eventInfo.brandColor : undefined
                  }}
                >
                  {c.name}
                  <i className={`fas fa-check-circle transition-all ${selectedClass === c.name ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}></i>
                </button>
              ))}
              {classes.length === 0 && <p className="col-span-2 text-center py-20 text-slate-300 italic font-bold">Daftar kelas belum tersedia.</p>}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 py-6 text-slate-400 font-black hover:text-slate-600 transition-colors">KEMBALI</button>
              <button 
                disabled={!selectedClass}
                onClick={() => setStep(3)}
                className="flex-[2] py-6 text-white rounded-[2.5rem] font-black shadow-2xl disabled:opacity-30 transition-all active:scale-95"
                style={{backgroundColor: eventInfo.brandColor}}
              >
                KONFIRMASI <i className="fas fa-chevron-right ml-2 text-xs"></i>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-12">
            <div className="flex items-end justify-between border-b border-slate-50 pb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pertanyaan</h2>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-2">{selectedClass} • {userName}</p>
                </div>
                <div className="text-right">
                    <span className="text-4xl font-black text-slate-100 leading-none">{filteredQuestions.length}</span>
                </div>
            </div>

            <div className="space-y-16 max-h-[50vh] overflow-y-auto pr-6 scrollbar-thin scrollbar-thumb-slate-200">
              {filteredQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-6">
                  <label className="block text-xl font-black text-slate-800 leading-snug">
                    <span className="text-slate-200 mr-3 text-2xl">#{idx + 1}</span> {q.text}
                  </label>
                  
                  {q.type === 'rating' ? (
                    <div className="flex justify-between gap-3">
                      {[1, 2, 3, 4, 5].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAnswerChange(q.id, val)}
                          className={`flex-1 py-5 rounded-[1.5rem] font-black text-xl transition-all border-2 ${
                            answers[q.id] === val 
                            ? 'text-white shadow-xl scale-[1.08] z-10' 
                            : 'bg-slate-50 border-transparent text-slate-300 hover:bg-slate-100 hover:text-slate-400'
                          }`}
                          style={{
                            backgroundColor: answers[q.id] === val ? eventInfo.brandColor : undefined,
                            borderColor: answers[q.id] === val ? eventInfo.brandColor : undefined
                          }}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea 
                      required
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      className="w-full px-8 py-6 bg-slate-50 border-2 border-transparent focus:border-indigo-50 focus:bg-white focus:shadow-xl rounded-[2.5rem] outline-none h-40 resize-none font-bold text-slate-700 transition-all placeholder:text-slate-200"
                      placeholder="Bagikan pemikiranmu di sini secara lengkap..."
                    ></textarea>
                  )}
                </div>
              ))}
              {filteredQuestions.length === 0 && (
                <div className="py-20 text-center">
                    <i className="fas fa-info-circle text-4xl text-slate-100 mb-4"></i>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada pertanyaan untuk kelas Anda.</p>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-6 text-slate-400 font-black hover:text-slate-600 transition-colors">KEMBALI</button>
              <button 
                type="submit"
                disabled={loading || filteredQuestions.length === 0}
                className="flex-[2] py-6 text-white rounded-[2.5rem] font-black shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] transition-all active:scale-95 disabled:opacity-30"
                style={{ 
                    backgroundColor: eventInfo.brandColor,
                    boxShadow: `0 20px 40px -10px ${eventInfo.brandColor}40`
                }}
              >
                {loading ? 'MENGIRIM...' : 'SELESAI & KIRIM'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PublicPortal;
