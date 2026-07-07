"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Client } from "../types";

export type ClientEditPayload = {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  address: string;
  bio: string;
  styleProfile: {
    bio: string;
    tags: string[];
  };
  alerts: string[];
};

type ClientEditModalProps = {
  client: Client;
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: (payload: ClientEditPayload) => void;
  onClose: () => void;
};

const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const parseAlerts = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export default function ClientEditModal({
  client,
  isSubmitting = false,
  error = null,
  onConfirm,
  onClose,
}: ClientEditModalProps) {
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email);
  const [phone, setPhone] = useState(client.phone);
  const [birthday, setBirthday] = useState(client.birthday);
  const [address, setAddress] = useState(client.address);
  const [bio, setBio] = useState(client.bio);
  const [styleBio, setStyleBio] = useState(client.styleProfile.bio);
  const [styleTags, setStyleTags] = useState(client.styleProfile.tags.join(", "));
  const [alertsText, setAlertsText] = useState(client.alerts.join("\n"));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setName(client.name);
    setEmail(client.email);
    setPhone(client.phone);
    setBirthday(client.birthday);
    setAddress(client.address);
    setBio(client.bio);
    setStyleBio(client.styleProfile.bio);
    setStyleTags(client.styleProfile.tags.join(", "));
    setAlertsText(client.alerts.join("\n"));
  }, [client]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!name.trim()) {
      setLocalError("El nombre es obligatorio.");
      return;
    }

    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      setLocalError("El teléfono es obligatorio.");
      return;
    }

    if (normalizedPhone.replace(/\D/g, "").length < 10) {
      setLocalError("Ingresa un teléfono válido de 10 dígitos.");
      return;
    }

    onConfirm({
      name: name.trim(),
      email: email.trim(),
      phone: normalizedPhone,
      birthday: birthday.trim() || "No especificado",
      address: address.trim() || "No especificada",
      bio: bio.trim(),
      styleProfile: {
        bio: styleBio.trim(),
        tags: parseTags(styleTags),
      },
      alerts: parseAlerts(alertsText),
    });
  };

  const displayError = error || localError;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface max-w-lg w-full rounded-2xl border border-primary/10 luxury-shadow overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3 sticky top-0 bg-surface z-10">
          <div>
            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block">
              Editar cliente
            </span>
            <h3 className="font-display text-lg font-bold text-primary mt-0.5">
              {client.name}
            </h3>
            <p className="text-[10px] text-outline font-mono mt-1">ID: {client.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-outline hover:text-primary transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Nombre completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                required
                minLength={10}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Fecha de nacimiento
              </label>
              <input
                type="text"
                value={birthday}
                onChange={(event) => setBirthday(event.target.value)}
                placeholder="14 de Abril, 1990"
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Ubicación / ciudad
              </label>
              <input
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Biografía / notas generales
            </label>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans text-primary bg-surface outline-none focus:border-secondary h-20 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Perfil de estilo
            </label>
            <textarea
              value={styleBio}
              onChange={(event) => setStyleBio(event.target.value)}
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans text-primary bg-surface outline-none focus:border-secondary h-16 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Etiquetas de estilo
            </label>
            <input
              type="text"
              value={styleTags}
              onChange={(event) => setStyleTags(event.target.value)}
              placeholder="Gel, French, Minimalista"
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans text-primary bg-surface outline-none focus:border-secondary"
            />
            <p className="text-[10px] text-outline">Separa con comas.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Alertas médicas / cuidados
            </label>
            <textarea
              value={alertsText}
              onChange={(event) => setAlertsText(event.target.value)}
              placeholder="Una alerta por línea"
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans text-primary bg-surface outline-none focus:border-secondary h-20 resize-none"
            />
          </div>

          {displayError ? (
            <p className="text-xs text-red-600 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {displayError}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg border border-primary/10 text-xs font-bold uppercase tracking-wider text-outline hover:bg-surface-container-low transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
