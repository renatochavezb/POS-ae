import { useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  Coins, 
  Plus, 
  Check, 
  Bookmark, 
  TrendingUp, 
  Award,
  Filter
} from 'lucide-react';
import { Service } from '../types';
import { INITIAL_STAFF, formatServicePrice } from '../data';

interface ServicesViewProps {
  services: Service[];
  onOpenNewAppointment: (clientName?: string, defaultTime?: string, prefilledServiceId?: string) => void;
}

export default function ServicesView({
  services,
  onOpenNewAppointment
}: ServicesViewProps) {
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'Uñas', label: 'Uñas' },
    { id: 'Manos y pies', label: 'Manos y pies' },
    { id: 'Cejas y mirada', label: 'Cejas y mirada' },
    { id: 'Cabello, estética y cuerpo', label: 'Cabello y cuerpo' },
  ];

  const filteredServices = selectedCategory === 'all' 
    ? services 
    : services.filter(srv => srv.category === selectedCategory);

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      {/* Top Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">Catálogo de Belleza</span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">Servicios de Alta Gama</h2>
          <p className="text-on-surface-variant text-sm mt-1">Tratamientos estéticos meticulosamente diseñados para el cuidado integral.</p>
        </div>
        <div className="p-1.5 bg-surface-container-lowest rounded-xl border border-primary/5 luxury-shadow flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                selectedCategory === cat.id 
                  ? 'bg-primary text-on-primary shadow-sm shadow-primary/15' 
                  : 'text-outline hover:text-primary hover:bg-surface-container-low'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredServices.map((service) => {
          
          // Format duration elegantly e.g. "75" -> "1h 15m" or "45m"
          const hours = Math.floor(service.duration / 60);
          const mins = service.duration % 60;
          const durationStr = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;

          return (
            <div 
              key={service.id}
              className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden flex flex-col group transition-all duration-300 hover:-translate-y-1.5"
            >
              {/* Image banner header */}
              <div className="h-56 overflow-hidden relative">
                <img 
                  referrerPolicy="no-referrer"
                  src={service.image} 
                  alt={service.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
                
                {/* Category Floating badge */}
                <span className="absolute top-4 left-4 text-[9px] font-sans font-bold uppercase bg-white/90 backdrop-blur text-primary px-3 py-1 rounded-full border border-primary/5 shadow-sm">
                  {service.category}
                </span>
                {service.exclusive && (
                  <span className="absolute top-4 right-4 text-[9px] font-sans font-bold uppercase bg-secondary text-on-secondary px-3 py-1 rounded-full shadow-sm">
                    Exclusivo
                  </span>
                )}

                {/* Duration Floating badge */}
                <span className="absolute bottom-4 right-4 text-[9px] font-sans font-extrabold uppercase bg-primary text-on-primary px-3 py-1 rounded-full flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-secondary" />
                  {durationStr}
                </span>
              </div>

              {/* Information body content */}
              <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display font-bold text-lg text-primary group-hover:text-secondary transition-colors line-clamp-1">
                      {service.name}
                    </h3>
                    <p className={`font-display font-black text-lg shrink-0 ${service.price > 0 ? 'text-primary' : 'text-outline'}`}>
                      {formatServicePrice(service.price)}
                    </p>
                  </div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-widest">{service.subtitle}</p>
                  <p className="text-[10px] text-secondary font-semibold">
                    {service.staffIds
                      .map((id) => INITIAL_STAFF.find((member) => member.id === id)?.name)
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="text-xs text-on-surface-variant font-medium leading-relaxed font-sans line-clamp-3">
                    {service.description}
                  </p>
                </div>

                {/* Booking call-to-action button */}
                <button 
                  onClick={() => onOpenNewAppointment(undefined, undefined, service.id)}
                  className="w-full py-2.5 rounded-xl border border-primary/10 hover:border-primary text-primary hover:bg-primary hover:text-on-primary transition-all font-sans text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 group/btn"
                >
                  <Plus className="w-4 h-4 text-secondary group-hover/btn:text-white" />
                  <span>Reservar Servicio</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footnote statement */}
      <div className="p-6 bg-surface-container-low/50 rounded-2xl border border-primary/5 text-center max-w-xl mx-auto space-y-2">
        <Award className="w-8 h-8 text-secondary mx-auto" />
        <h4 className="font-display font-bold text-sm text-primary">Estándares de Excelencia studio aé</h4>
        <p className="text-xs text-outline leading-relaxed max-w-sm mx-auto">
          Todos nuestros servicios emplean exclusivamente instrumental esterilizado en autoclave y cosmética cruelty-free libre de tóxicos.
        </p>
      </div>
    </div>
  );
}
