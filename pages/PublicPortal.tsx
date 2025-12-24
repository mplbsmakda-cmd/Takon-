
import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, Class } from '../types';

const PublicPortal: React.FC = () => {
  const [userName, setUserName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [eventInfo, setEventInfo] = useState({ title: 'Sesi Tanya Jawab', desc: 'Silakan isi formulir.', isOpen: true });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); 

  useEffect(() => {
    if (sessionStorage.getItem('tp_submitted')) {
      setSubmitted(true);
      setLoading(false);
      return;
    }

    const unsubConfig = onSnapshot(doc(db, "settings", "eventConfig"), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as any;
        setEventInfo({ 
          title: data.title || 'Sesi Tanya Jawab', 
          desc: data.desc || 'Silakan isi formulir.',
          isOpen: data.isOpen !== undefined ? data.isOpen : true 
        });
      }
    });

    const qQuery = query(collection(db, "questions"), where("active", "==", true));
    const unsubQuestions = onSnapshot(qQuery, (snapshot) => {
      setQuestions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Question[]);
      setLoading(false);
    });

    const unsubClasses = onSnapshot(collection(db, "classes"), (snapshot) => {
      setClasses(snapshot.docs.map(d => ({ id: d.id, name: d.data().name })) as Class[]);
    });

    return () => { unsubQuestions(); unsubClasses(); unsubConfig(); };
  }, []);

  const handleAnswerChange = (qId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [qId]: value })); 
  };

  const progress = Math.round((Object.keys(answers).length / questions.length) * 100) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventInfo.isOpen) return alert("Maaf, pendaftaran sudah ditutup.");
    if (Object.keys(answers).length < questions.length) return alert("Harap isi semua pertanyaan.");

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
    } catch (err) {
      alert("Terjadi kesalahan. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-400 font-bold text-xs uppercase tracking-widest">Menyiapkan Form...</p>
    </div>
  );

  if (!eventInfo.isOpen) return (
    <div className="max-w-md mx-auto mt-20 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 text-center animate-in zoom-in">
      <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <i className="fas fa-lock text-3xl"></i>
      </div>
      <h2 className="text-3xl font-black text-slate-900 mb-4">Portal Ditutup</h2>
      <p className="text-slate-500">Sesi pengambilan data saat ini tidak aktif. Silakan hubungi panitia untuk informasi lebih lanjut.</p>
    </div>
  );

  if (submitted) return (
    <div className="max-w-md mx-auto mt-20 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 text-center animate-in zoom-in">
      <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <i className="fas fa-heart text-4xl animate-bounce"></i>
      </div>
      <h2 className="text-3xl font-black text-slate-900 mb-4">Terima Kasih!</h2>
      <p className="text-slate-500">Suaramu sangat berarti untuk perubahan sekolah yang lebih baik.</p>
      <button onClick={() => window.location.reload()} className="mt-8 text-indigo-600 font-bold text-sm underline">Kirim Jawaban Lain?</button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex justify-between items-center mb-10 px-4">
        <div className="flex gap-2">
            {[1, 2, 3].map(s => (
                <div key={s} className={`h-2 rounded-full transition-all duration-700 ${step >= s ? 'w-12 bg-indigo-600' : 'w-4 bg-slate-200'}`}></div>
            ))}
        </div>
        {step === 3 && <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{progress}% Selesai</span>}
      </div>

      <div className="bg-white/80 backdrop-blur-xl p-10 md:p-14 rounded-[3.5rem] shadow-2xl border border-white shadow-indigo-100/50">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h1 className="text-4xl font-black text-slate-900 mb-4 leading-tight">{eventInfo.title}</h1>
            <p className="text-slate-500 mb-10 text-lg leading-relaxed">{eventInfo.desc}</p>
            <div className="space-y-6">
              <div className="group">
                <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Siapa namamu?"
                  className="w-full px-7 py-5 bg-slate-100/50 border-2 border-transparent focus:border-indigo-500 rounded-[2rem] outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                />
              </div>
              <button 
                disabled={!userName.trim()}
                onClick={() => setStep(2)}
                className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                MULAI SEKARANG <i className="fas fa-chevron-right ml-2"></i>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <h2 className="text-3xl font-black text-slate-900 mb-8">Pilih Kelasmu</h2>
            <div className="grid grid-cols-2 gap-4 mb-10 max-h-[40vh] overflow-y-auto p-2 scrollbar-hide">
              {classes.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClass(c.name)}
                  className={`p-5 rounded-3xl border-2 font-bold transition-all text-sm ${
                    selectedClass === c.name 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-lg' 
                    : 'border-slate-100 bg-white text-slate-600 hover:border-indigo-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
              {classes.length === 0 && <p className="col-span-2 text-center py-10 text-slate-300 italic">Belum ada kelas yang terdaftar.</p>}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 py-5 text-slate-400 font-black">KEMBALI</button>
              <button 
                disabled={!selectedClass}
                onClick={() => setStep(3)}
                className="flex-[2] py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                LANJUTKAN
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-right-4 space-y-10">
            <div className="border-b border-slate-100 pb-6 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Aspirasimu</h2>
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">{selectedClass} • {userName}</p>
                </div>
            </div>

            <div className="space-y-12 max-h-[55vh] overflow-y-auto pr-4 scrollbar-thin">
              {questions.map((q, idx) => (
                <div key={q.id} className="space-y-4">
                  <label className="block text-lg font-black text-slate-800">
                    <span className="text-indigo-600 mr-2">{idx + 1}.</span> {q.text}
                  </label>
                  
                  {q.type === 'rating' ? (
                    <div className="flex justify-between items-center gap-2">
                      {[1, 2, 3, 4, 5].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAnswerChange(q.id, val)}
                          className={`flex-1 py-4 rounded-2xl font-black transition-all border-2 ${
                            answers[q.id] === val 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' 
                            : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-200'
                          }`}
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
                      className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all h-36 resize-none font-bold text-slate-700 placeholder:text-slate-200"
                      placeholder="Tuliskan jawaban lengkapmu di sini..."
                    ></textarea>
                  )}
                </div>
              ))}
              {questions.length === 0 && <p className="text-center py-20 text-slate-300 italic">Maaf, belum ada pertanyaan yang aktif.</p>}
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-50">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-5 text-slate-400 font-black">KEMBALI</button>
              <button 
                type="submit"
                disabled={questions.length === 0}
                className="flex-[2] py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-2xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
              >
                SUBMIT DATA
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PublicPortal;
