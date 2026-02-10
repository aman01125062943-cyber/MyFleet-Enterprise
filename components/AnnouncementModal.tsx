import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // Adjusted path if needed
import { X, Sparkles } from 'lucide-react';

const AnnouncementModal: React.FC = () => {
    const [show, setShow] = useState(false);
    const [data, setData] = useState<{ title: string, body: string, date: string, version: string } | null>(null);

    useEffect(() => {
        checkAnnouncement();
    }, []);

    const checkAnnouncement = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).maybeSingle();
            if (!profile?.org_id) return;

            const { data: orgData } = await supabase.from('organizations').select('subscription_plan').eq('id', profile.org_id).maybeSingle();
            const currentPlan = orgData?.subscription_plan || 'trial';

            const { data: config } = await supabase.from('public_config').select('show_announcement, announcement_data').eq('id', 1).single();
            if (!config?.show_announcement || !config?.announcement_data) return;

            const ann = config.announcement_data;
            const targetPlans = ann.target_plans || [];

            // Check targeting: if targetPlans is empty, it means target everyone
            const isTargeted = targetPlans.length === 0 || targetPlans.includes(currentPlan);
            if (!isTargeted) return;

            const lastSeenVersion = localStorage.getItem('last_seen_announcement_version');
            if (lastSeenVersion !== ann.version) {
                setData(ann);
                setShow(true);
            }
        } catch (err) {
            console.error('Announcement check failed:', err);
        }
    };

    const handleClose = () => {
        if (data?.version) {
            localStorage.setItem('last_seen_announcement_version', data.version);
        }
        setShow(false);
    };

    if (!show || !data) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl relative border border-white/10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">

                {/* Header Graphic */}
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-10 -mt-10"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-tr-full -ml-8 -mb-8"></div>

                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20">
                            <Sparkles className="w-6 h-6 text-yellow-300" />
                        </div>
                        <h2 className="text-2xl font-bold mb-1">{data.title}</h2>
                        <div className="text-blue-100 text-sm opacity-90">{data.date}</div>
                    </div>

                    <button
                        onClick={handleClose}
                        className="absolute top-4 left-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-md"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="prose dark:prose-invert text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {data.body}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <button
                            onClick={handleClose}
                            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                        >
                            حسناً، فهمت
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnnouncementModal;
