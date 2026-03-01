import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';

const LanguageSelector = ({ style }) => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        setIsOpen(false);
    };

    const getLanguageName = (lng) => {
        switch (lng) {
            case 'en': return 'English';
            case 'hi': return 'हिंदी';
            case 'kn': return 'ಕನ್ನಡ';
            default: return 'English';
        }
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block', ...style }} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    transition: 'all 0.2s',
                    minWidth: '100px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={16} />
                    {getLanguageName(i18n.language)}
                </div>
                <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '120px',
                        zIndex: 1000
                    }}
                >
                    <button onClick={() => changeLanguage('en')} style={dropdownItemStyle(i18n.language === 'en')}>English</button>
                    <button onClick={() => changeLanguage('hi')} style={dropdownItemStyle(i18n.language === 'hi')}>हिंदी</button>
                    <button onClick={() => changeLanguage('kn')} style={dropdownItemStyle(i18n.language === 'kn')}>ಕನ್ನಡ</button>
                </div>
            )}
        </div>
    );
};

const dropdownItemStyle = (isActive) => ({
    padding: '10px 16px',
    border: 'none',
    backgroundColor: isActive ? '#f1f5f9' : 'white',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '14px',
    color: isActive ? '#2563eb' : '#1e293b',
    fontWeight: isActive ? '700' : '500',
    width: '100%',
    transition: 'background 0.2s',
    display: 'block'
});

export default LanguageSelector;
