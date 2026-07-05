import { useState } from 'react';
import { 
  Search, 
  UserPlus, 
  SlidersHorizontal,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ChevronRight,
  Sparkles,
  Award
} from 'lucide-react';
import { Client } from '../types';
import { formatMXN } from '../data';

interface ClientsViewProps {
  clients: Client[];
  onOpenNewClient: () => void;
  onSelectClient: (id: string) => void;
}

export default function ClientsView({
  clients,
  onOpenNewClient,
  onSelectClient
}: ClientsViewProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected Service Filter
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  
  // Selected Frequency Filter
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');

  const handleServiceCheckbox = (service: string) => {
    if (selectedServices.includes(service)) {
      setSelectedServices(selectedServices.filter(s => s !== service));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleResetFilters = () => {
    setSelectedServices([]);
    setFrequencyFilter('all');
    setSearchTerm('');
  };

  // Filter clients dynamically
  const filteredClients = clients.filter(client => {
    // 1. Search term match
    const matchesSearch = 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm);

    // 2. Service filter match (if style bio mentions the service keywords)
    const matchesService = selectedServices.length === 0 || selectedServices.some(service => {
      return client.styleProfile.bio.toLowerCase().includes(service.toLowerCase()) ||
             client.styleProfile.tags.some(t => t.toLowerCase().includes(service.toLowerCase())) ||
             client.bio.toLowerCase().includes(service.toLowerCase());
    });

    // 3. Frequency filter match
    let matchesFrequency = true;
    if (frequencyFilter === 'weekly') {
      matchesFrequency = client.visitsCount >= 15; // recurrent VIPs
    } else if (frequencyFilter === 'monthly') {
      matchesFrequency = client.visitsCount < 15;
    }

    return matchesSearch && matchesService && matchesFrequency;
  });

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">Base de Datos CRM</span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">Directorio de Clientes</h2>
          <p className="text-on-surface-variant text-sm mt-1">Gestión de relaciones, historial y perfiles de estilo premium.</p>
        </div>
        <div>
          <button 
            onClick={onOpenNewClient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-secondary" />
            <span>Registrar Cliente VIP</span>
          </button>
        </div>
      </div>

      {/* Main CRM Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Filter Panel */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow h-fit space-y-6">
          <div className="flex items-center justify-between border-b border-primary/5 pb-3">
            <span className="font-display font-bold text-sm text-primary flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-secondary" />
              Filtrar Clientes
            </span>
            <button 
              onClick={handleResetFilters}
              className="text-[10px] text-outline hover:text-primary font-bold uppercase tracking-widest"
            >
              Restaurar
            </button>
          </div>

          {/* Service Filters */}
          <div className="space-y-3">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">Servicios Preferidos</span>
            <div className="space-y-2 text-xs">
              {[
                { id: 'manicure', label: 'Gel Manicure' },
                { id: 'sculpt', label: 'Sculpt Extensions' },
                { id: 'art', label: 'Nail Artistry' },
                { id: 'treatment', label: 'Restorative Treatment' }
              ].map((item) => (
                <label key={item.id} className="flex items-center gap-2.5 cursor-pointer text-on-surface-variant hover:text-primary select-none font-medium">
                  <input 
                    type="checkbox"
                    checked={selectedServices.includes(item.label)}
                    onChange={() => handleServiceCheckbox(item.label)}
                    className="rounded border-outline text-primary focus:ring-primary w-4 h-4 accent-primary"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Frequency Filters */}
          <div className="space-y-3 pt-4 border-t border-primary/5">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">Frecuencia de Citas</span>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-on-surface-variant hover:text-primary font-medium">
                <input 
                  type="radio"
                  name="frequency"
                  checked={frequencyFilter === 'all'}
                  onChange={() => setFrequencyFilter('all')}
                  className="text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>Todos</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-on-surface-variant hover:text-primary font-medium">
                <input 
                  type="radio"
                  name="frequency"
                  checked={frequencyFilter === 'weekly'}
                  onChange={() => setFrequencyFilter('weekly')}
                  className="text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>Alta Frecuencia (&gt;15 citas)</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-on-surface-variant hover:text-primary font-medium">
                <input 
                  type="radio"
                  name="frequency"
                  checked={frequencyFilter === 'monthly'}
                  onChange={() => setFrequencyFilter('monthly')}
                  className="text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>Frecuencia Regular (&lt;15 citas)</span>
              </label>
            </div>
          </div>

          {/* Cumulative Spending Indicator */}
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/5 space-y-2">
            <span className="text-[9px] text-outline uppercase font-bold tracking-widest">Estado de Cartera</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-display font-bold text-primary">
                {formatMXN(clients.reduce((sum, c) => sum + c.totalSpent, 0))}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant">Inversión acumulada de {clients.length} clientes VIP registrados.</p>
          </div>
        </div>

        {/* Right 3 Columns: Client Table directory */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search bar widget */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-primary/5 luxury-shadow flex items-center gap-3">
            <Search className="w-5 h-5 text-outline" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, correo electrónico, teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow bg-transparent border-none outline-none text-sm text-primary placeholder-outline font-sans"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="text-xs text-outline hover:text-primary font-bold"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* CRM List Card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
            {filteredClients.length === 0 ? (
              <div className="py-16 text-center text-outline text-sm space-y-2">
                <p className="font-bold">No se encontraron clientes.</p>
                <p className="text-xs">Prueba reajustando tus filtros o busca otro nombre.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-primary/5">
                      <th className="py-4 px-6">Cliente VIP</th>
                      <th className="py-4 px-6">Contacto</th>
                      <th className="py-4 px-6">Servicio Favorito</th>
                      <th className="py-4 px-6 text-right">Inversión Total</th>
                      <th className="py-4 px-6 text-center">Visitas</th>
                      <th className="py-4 px-6 text-right">Perfil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {filteredClients.map((client) => {
                      // Portrait fallback
                      const portraitUrl = client.id === 'SA-2022' 
                        ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuCuHW-1-qfdtVzBxWvPpA-OqcaHbLR1_sK9e-e4oMb3OdUFEqW9YMQzFqDNl9t2rp0ekLfel-_kxYikI3SVkqrpBNthi7_u_DQhjCyO2kp2ocsT8TBdtEiFgNr6tpHULi0-sqdQtMu8hpU5Mp4IarqXCeiQjxWxDefBUb_aMlSQPpvEhQKnLA2sdECrsqUfvNUGZgDBMo04FYaWG9Q5hcUfPy9-J9OwrUo3qaW9Wx07Qae9thQ1EcOGIe76Lw2lddDnjFoxccVEgZE'
                        : `https://api.dicebear.com/7.x/adventurer/svg?seed=${client.name}`;
                      
                      return (
                        <tr 
                          key={client.id}
                          onClick={() => onSelectClient(client.id)}
                          className="hover:bg-surface-container-low/30 transition-all group cursor-pointer"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <img 
                                referrerPolicy="no-referrer"
                                src={portraitUrl} 
                                alt={client.name} 
                                className="w-10 h-10 rounded-full object-cover border border-primary/10"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-sans font-bold text-xs text-primary group-hover:underline">
                                    {client.name}
                                  </p>
                                  {client.isPlatinum && (
                                    <span className="text-[8px] font-sans font-bold bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.2 rounded uppercase">
                                      VIP
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-outline font-mono">ID: #{client.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-0.5 text-[10px] text-on-surface-variant font-medium">
                              <p className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-outline" /> {client.email}
                              </p>
                              <p className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-outline" /> {client.phone}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-1">
                              <span className="inline-block text-[10px] font-bold text-primary font-sans bg-primary/5 px-2 py-0.5 rounded-full">
                                {client.styleProfile.tags[0] || 'Por definir'}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {client.styleProfile.tags.slice(0, 2).map((tag, idx) => (
                                  <span key={idx} className="text-[8px] font-mono text-outline">#{tag}</span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <p className="text-xs font-display font-extrabold text-primary">
                              {formatMXN(client.totalSpent)}
                            </p>
                            <p className="text-[9px] text-outline font-sans">Prom: {formatMXN(client.averageTicket)}</p>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className="text-xs font-mono font-bold text-primary">
                              {client.visitsCount}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button className="text-outline group-hover:text-primary transition-colors p-1">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
