import { motion, type HTMLMotionProps } from "framer-motion";
import React from "react";

type AnimatedButtonProps = HTMLMotionProps<"button">;

export const AnimatedButton = ({ children, ...props }: AnimatedButtonProps) => (
  <motion.button
    whileHover={{ scale: 1.07, boxShadow: "0 4px 24px #a5b4fc33" }}
    whileTap={{ scale: 0.96 }}
    transition={{ type: "spring", stiffness: 400, damping: 20 }}
    className="rounded-xl px-5 py-2 font-semibold bg-slate-900 text-white shadow-lg border-2 border-slate-300 hover:bg-slate-800 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-white"
    {...props}
  >
    {children}
  </motion.button>
);
