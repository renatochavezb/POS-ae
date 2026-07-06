"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Save, X } from "lucide-react";
import posApi from "@/libs/posApi";
import { Staff } from "../types";

const STAFF_ROLE_OPTIONS = [
  "Perfil más completo",
  "Generalista en crecimiento",
  "Especialista 100% uñas",
  "Uñas + mirada y cejas",
  "Estética",
  "Comodín de uñas",
];

const STAFF_SHIFT_OPTIONS = [
  "Completo",
  "Mañana (09:00 - 15:00)",
  "Tarde (15:00 - 21:00)",
];

type StaffEditProfileModalProps = {
  staff: Staff;
  isOpen: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    role: string;
    specialty: string;
    shift: string;
    email: string;
    phone: string;
    rating: number;
    commissionPercent: number;
    bio: string;
    image: string;
  }) => void;
  onPhotoUpdated?: (updated: Staff) => void;
};

export default function StaffEditProfileModal({
  staff,
  isOpen,
  isSubmitting = false,
  error = null,
  onClose,
  onSave,
  onPhotoUpdated,
}: StaffEditProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(staff.name);
  const [role, setRole] = useState(staff.role);
  const [specialty, setSpecialty] = useState(staff.specialty);
  const [shift, setShift] = useState(staff.shift);
  const [email, setEmail] = useState(staff.email);
  const [phone, setPhone] = useState(staff.phone);
  const [rating, setRating] = useState(String(staff.rating));
  const [commissionPercent, setCommissionPercent] = useState(String(staff.commissionPercent));
  const [bio, setBio] = useState(staff.bio);
  const [image, setImage] = useState(staff.image);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setName(staff.name);
    setRole(staff.role);
    setSpecialty(staff.specialty);
    setShift(staff.shift);
    setEmail(staff.email);
    setPhone(staff.phone);
    setRating(String(staff.rating));
    setCommissionPercent(String(staff.commissionPercent));
    setBio(staff.bio);
    setImage(staff.image);
    setPhotoError(null);
  }, [isOpen, staff]);

  const roleOptions = STAFF_ROLE_OPTIONS.includes(staff.role)
    ? STAFF_ROLE_OPTIONS
    : [staff.role, ...STAFF_ROLE_OPTIONS];

  const shiftOptions = STAFF_SHIFT_OPTIONS.includes(staff.shift)
    ? STAFF_SHIFT_OPTIONS
    : [staff.shift, ...STAFF_SHIFT_OPTIONS];

  if (!isOpen) return null;

  const isLocalPhoto = image.startsWith("/staff/");

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      const updated = await posApi.uploadStaffPhoto(staff.id, file);
      setImage(updated.image);
      onPhotoUpdated?.(updated);
    } catch (uploadError) {
      console.error(uploadError);
      setPhotoError("No se pudo subir la foto. Verifica que sea JPG, PNG o WEBP.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const parsedRating = Number.parseFloat(rating);
    const parsedCommission = Number.parseInt(commissionPercent, 10);

    onSave({
      name: name.trim(),
      role,
      specialty: specialty.trim(),
      shift,
      email: email.trim(),
      phone: phone.trim(),
      rating: Number.isFinite(parsedRating) ? parsedRating : staff.rating,
      commissionPercent: Number.isFinite(parsedCommission) ? parsedCommission : staff.commissionPercent,
      bio: bio.trim(),
      image: image.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest max-w-lg w-full max-h-[90vh] rounded-2xl border border-primary/5 luxury-shadow overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3 shrink-0">
          <div>
            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block mb-1">
              Equipo
            </span>
            <h3 className="font-display text-xl font-bold text-primary">Editar perfil</h3>
            <p className="text-xs text-outline mt-1">
              {staff.name} · código {staff.id}
            </p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Rol / Rango
              </label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Turno
              </label>
              <select
                value={shift}
                onChange={(event) => setShift(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              >
                {shiftOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Especialidad técnica
            </label>
            <input
              type="text"
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Rating
              </label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Comisión (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={commissionPercent}
                onChange={(event) => setCommissionPercent(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Foto de perfil
            </label>

            <div className="flex items-center gap-4">
              <img
                referrerPolicy="no-referrer"
                src={image || "/branding/studio-ae-logo.png"}
                alt={name}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary/10 bg-surface-container-low shrink-0"
              />

              <div className="space-y-2 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || isUploadingPhoto}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/10 text-primary text-[10px] font-sans font-bold uppercase tracking-wider hover:bg-surface-container-low transition-colors disabled:opacity-40"
                >
                  <Camera className="w-4 h-4 text-secondary" />
                  {isUploadingPhoto ? "Subiendo..." : "Elegir foto"}
                </button>
                <p className="text-[10px] text-outline leading-relaxed">
                  {isLocalPhoto
                    ? `Foto local en public/staff${image.replace("/staff", "")}`
                    : "Sube una foto y se guardará en public/staff/ del proyecto."}
                </p>
                {isLocalPhoto && (
                  <p className="text-[10px] text-on-surface-variant font-mono truncate">
                    Ruta en la app: {image}
                  </p>
                )}
              </div>
            </div>

            {photoError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {photoError}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Biografía
            </label>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary h-24 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-primary/10 text-outline hover:text-primary rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-sans font-bold uppercase tracking-wider bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
