// components/admin/shared/ui/EntityDrawer.tsx
import React, { useEffect } from 'react';

interface EntityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const EntityDrawer: React.FC<EntityDrawerProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
        <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={onClose}></div>
        <div className={`fixed top-0 end-0 h-full w-96 bg-light-card dark:bg-dark-card shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
                <header className="p-4 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text">{title}</h2>
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary text-2xl">&times;</button>
                </header>
                <div className="flex-grow p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    </>
  );
};
