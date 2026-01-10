import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";

export default function ResignConfirmDialog({ open, onCancel, onConfirm }) {
  const { t } = useLanguage();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#fdfbf7] border border-[#d4c5b0] rounded-xl p-6 shadow-2xl max-w-sm w-full"
          >
            <h3 className="text-xl font-bold text-[#4a3728] mb-2">{t('game.resign_confirm_title')}</h3>
            <p className="text-[#6b5138] mb-6">{t('game.resign_confirm_desc')}</p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={onCancel}
                className="border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]"
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white">
                {t('game.resign')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}