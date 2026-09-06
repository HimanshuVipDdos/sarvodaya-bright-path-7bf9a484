import { motion } from "framer-motion";
import { Phone, MessageCircle } from "lucide-react";
import { SITE, whatsappHref, telHref } from "@/lib/site";

export function FloatingActions() {
  return (
    <div className="fixed bottom-5 right-4 z-40 flex flex-col gap-3">
      <motion.a
        href={whatsappHref()}
        target="_blank"
        rel="noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.08 }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-elegant"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="h-5 w-5" />
      </motion.a>
      <motion.a
        href={telHref()}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.08 }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant"
        aria-label={`Call ${SITE.phone}`}
      >
        <Phone className="h-5 w-5" />
      </motion.a>
    </div>
  );
}
