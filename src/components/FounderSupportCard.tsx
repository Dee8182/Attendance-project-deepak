import React, { useState } from 'react';
import { ShieldCheck, Mail, Phone, MessageSquare, X } from 'lucide-react';

interface UserInfo { name?: string; phone?: string; email?: string; }

export const FounderSupportCard: React.FC<{ currentUser?: UserInfo }> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleWhatsAppRedirect = () => {
    const userName = currentUser?.name || 'नया यूज़र';
    const userPhone = currentUser?.phone || 'दर्ज नहीं';
    const userEmail = currentUser?.email || 'दर्ज नहीं';
    const msg = `नमस्ते दीपक कुमार जी (Founder),\nमैं आपके अटेंडेंस ऐप से बोल रहा हूँ।\n\n*जानकारी:*\n👤 नाम: ${userName}\n📞 फोन: ${userPhone}\n📧 ईमेल: ${userEmail}\n\n*सवाल/समस्या:* `;
    window.open(`https://wa.me/message/FWLWBWX7MRTMD1?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 bg-emerald-500 text-white p-3 rounded-full shadow-lg hover:bg-emerald-600 transition-all z-50 animate-bounce"
        title="Contact Founder"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-emerald-100">
            <div className="bg-emerald-500 p-5 text-white relative">
              <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 hover:text-emerald-100">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-6 h-6 text-white" />
                <span className="text-[10px] font-bold uppercase bg-emerald-600 px-2 py-0.5 rounded-full">VERIFIED FOUNDER</span>
              </div>
              <h3 className="text-xl font-bold">Deepak Kumar</h3>
              <p className="text-xs text-emerald-100">अटेंडेंस प्रोजेक्ट के एकमात्र मालिक और निर्माता</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">ऑफिशियल ईमेल</p>
                  <p className="text-sm font-semibold select-all">deepakk86346@gmail.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">व्हाट्सएप संपर्क</p>
                  <p className="text-sm font-semibold select-all">+91 81820 20276</p>
                </div>
              </div>
              <button
                onClick={handleWhatsAppRedirect}
                className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-md hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
                Click to Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
