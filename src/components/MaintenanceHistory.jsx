import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Wrench, Calendar, User, DollarSign } from 'lucide-react';

export default function MaintenanceHistory({ equipmentId }) {
  const [history, setHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Preventiva',
    description: '',
    technician: '',
    cost: ''
  });

  const fetchHistory = async () => {
    try {
      const { data } = await api.get(`/equipments/${equipmentId}/maintenance`);
      setHistory(data);
    } catch (err) {
      console.error('Erro ao buscar histórico');
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [equipmentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/equipments/${equipmentId}/maintenance`, newEntry);
      toast.success('Registro de manutenção salvo!');
      setShowForm(false);
      setNewEntry({
        date: new Date().toISOString().split('T')[0],
        type: 'Preventiva',
        description: '',
        technician: '',
        cost: ''
      });
      fetchHistory();
    } catch (err) {
      toast.error('Erro ao registrar manutenção');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
        <h3 className="text-xs font-bold text-dim uppercase tracking-[0.2em]">Registros Encontrados ({history.length})</h3>
        <button 
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="bg-[#D4AF37]/10 text-[#D4AF37] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#D4AF37]/20 transition-all flex items-center gap-2"
        >
          <Plus size={14} strokeWidth={3} />
          Novo Registro
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/10 p-8 rounded-3xl space-y-6 animate-fade">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Data do Serviço</label>
              <input 
                type="date" 
                className="input-glass w-full py-3" 
                value={newEntry.date}
                onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Tipo de Intervenção</label>
              <select 
                className="input-glass w-full py-3 h-[52px] cursor-pointer"
                value={newEntry.type}
                onChange={(e) => setNewEntry({...newEntry, type: e.target.value})}
              >
                <option value="Preventiva">Manutenção Preventiva</option>
                <option value="Corretiva">Manutenção Corretiva</option>
                <option value="Upgrade">Upgrade / Melhoria</option>
                <option value="Limpeza">Limpeza Técnica</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Técnico Responsável</label>
              <input 
                type="text" 
                className="input-glass w-full py-3" 
                value={newEntry.technician}
                onChange={(e) => setNewEntry({...newEntry, technician: e.target.value})}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Custo Estimado (R$)</label>
              <input 
                type="number" 
                step="0.01" 
                className="input-glass w-full py-3" 
                value={newEntry.cost}
                onChange={(e) => setNewEntry({...newEntry, cost: e.target.value})}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Descrição Detalhada</label>
            <textarea 
              className="input-glass w-full min-h-[100px] py-3 resize-none" 
              value={newEntry.description}
              onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
              placeholder="Descreva as atividades realizadas..."
              required
            ></textarea>
          </div>
          <div className="flex gap-4 pt-2">
            <button type="submit" className="btn-primary py-3 px-8 text-sm">Salvar Registro</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-dim text-xs font-bold uppercase tracking-widest hover:text-white px-4 transition-colors">Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {history.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-3xl">
             <Wrench size={32} className="text-white/5 mx-auto mb-3" />
             <p className="text-sm font-medium text-dim">Nenhum histórico disponível para este ativo.</p>
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="bg-white/5 p-6 rounded-2xl border-l-4 border-[#D4AF37] hover:bg-white/[0.07] transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md mb-2 inline-block">
                    {item.type}
                  </span>
                  <p className="text-sm font-semibold text-white leading-relaxed">{item.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-dim flex items-center gap-2 justify-end">
                    <Calendar size={14} className="text-[#D4AF37]" />
                    {new Date(item.date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
              <div className="flex gap-6 pt-4 border-t border-white/5">
                <span className="flex items-center gap-2 text-xs font-medium text-dim">
                  <User size={14} /> {item.technician || 'Equipe Interna'}
                </span>
                {item.cost && (
                  <span className="flex items-center gap-2 text-xs font-bold text-white">
                    <DollarSign size={14} className="text-[#22c55e]" /> R$ {item.cost.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
