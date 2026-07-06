"use client";

import { useEffect } from "react";

export default function InternoError({ error, reset }) {
  useEffect(() => {
    console.error("/interno error", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0f1419] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-slate-900/90 p-8 text-center space-y-4">
        <h1 className="text-lg font-bold text-red-300">Error al cargar /interno</h1>
        <p className="text-sm text-slate-400">
          Si ves pantalla en blanco, detén el servidor, borra la carpeta{" "}
          <code className="text-amber-400">.next</code> y vuelve a ejecutar{" "}
          <code className="text-amber-400">npm run dev</code>.
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-900 text-xs font-bold uppercase tracking-wider"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
