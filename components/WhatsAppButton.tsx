import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

export function WhatsAppButton() {
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [isExpanded, setIsExpanded] = useState(false);
    const buttonRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const fetchWhatsApp = async () => {
            const { data } = await supabase
                .from("public_config")
                .select("whatsapp_number")
                .single();

            if (data?.whatsapp_number) {
                setWhatsappNumber(data.whatsapp_number);
            }
        };

        fetchWhatsApp();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        }

        if (isExpanded) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isExpanded]);

    if (!whatsappNumber) return null;

    const handleClick = (e: React.MouseEvent) => {
        if (!isExpanded) {
            e.preventDefault();
            setIsExpanded(true);
        }
        // If expanded, let the default link behavior happen (navigate to WhatsApp)
    };

    return (
        <a
            ref={buttonRef}
            href={`https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent("السلام عليكم، لدي استفسار بخصوص خدماتكم.")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className={`fixed bottom-6 right-6 z-[9999] bg-[#25D366] text-white p-3 rounded-full shadow-2xl transition-all duration-500 ease-in-out flex items-center gap-2 overflow-hidden cursor-pointer ${isExpanded ? 'active pr-6 hover:scale-105' : 'hover:scale-110 active:scale-95 animate-bounce hover:animate-none'}`}
            aria-label="Contact on WhatsApp"
            style={{ maxWidth: isExpanded ? '400px' : '56px' }}
        >
            <div className="relative shrink-0">
                {!isExpanded && <span className="absolute inset-0 rounded-full animate-ping bg-white/50 opacity-75 duration-1000"></span>}
                <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white relative z-10" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
            </div>
            {isExpanded && (
                <span className="text-sm font-bold whitespace-nowrap animate-in fade-in slide-in-from-right-2 duration-300">
                    اضغط هنا للتحدث معنا عبر واتساب
                </span>
            )}
        </a>
    );
}
