import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { supabase } from '@/lib/supabase';
import type { KanbanCategory, Ticket } from '@/lib/types';
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_DOT, STATUS_LABELS } from '@/lib/types';
import { GripVertical, Loader2, Plus, Trash2, X } from 'lucide-react';

interface KanbanBoardProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
}

const NEW_CATEGORY = { name: '', description: '', color: '#2563EB' };

export default function KanbanBoard({ tickets, onSelectTicket }: KanbanBoardProps) {
  const [boardTickets, setBoardTickets] = useState<Ticket[]>(tickets);
  const [categories, setCategories] = useState<KanbanCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(NEW_CATEGORY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBoardTickets(tickets);
  }, [tickets]);

  useEffect(() => {
    (async () => {
      const { data, error: queryError } = await supabase
        .from('kanban_categories')
        .select('*')
        .order('position', { ascending: true });
      if (queryError) setError('Não foi possível carregar as categorias do quadro.');
      setCategories(data || []);
      setLoading(false);
    })();
  }, []);

  const uncategorized = useMemo(
    () => boardTickets.filter((t) => !t.board_category_id),
    [boardTickets],
  );

  const moveTicket = async (ticketId: string, categoryId: string | null) => {
    const previousTickets = boardTickets;
    setError(null);
    setDragOverCol(null);
    setBoardTickets((current) => current.map((ticket) => (
      ticket.id === ticketId ? { ...ticket, board_category_id: categoryId } : ticket
    )));
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ board_category_id: categoryId })
      .eq('id', ticketId);
    if (updateError) {
      setBoardTickets(previousTickets);
      setError('Não foi possível mover o ticket.');
    }
    setDraggedId(null);
  };

  const updateCategoryColor = async (category: KanbanCategory, color: string) => {
    const previousCategories = categories;
    setCategories((current) => current.map((item) => item.id === category.id ? { ...item, color } : item));
    const { error: updateError } = await supabase
      .from('kanban_categories')
      .update({ color })
      .eq('id', category.id);
    if (updateError) {
      setCategories(previousCategories);
      setError('Não foi possível atualizar a cor da categoria.');
    }
  };

  const createCategory = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('kanban_categories')
      .insert({
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        position: categories.length,
      })
      .select()
      .maybeSingle();
    if (insertError || !data) {
      setError('Não foi possível criar a categoria.');
    } else {
      setCategories((current) => [...current, data]);
      setForm(NEW_CATEGORY);
      setShowForm(false);
    }
    setSaving(false);
  };

  const deleteCategory = async (category: KanbanCategory) => {
    if (!window.confirm(`Excluir a categoria "${category.name}"? Os tickets serão mantidos.`)) return;
    const { error: deleteError } = await supabase.from('kanban_categories').delete().eq('id', category.id);
    if (deleteError) {
      setError('Não foi possível excluir a categoria.');
      return;
    }
    setCategories((current) => current.filter((item) => item.id !== category.id));
  };

  const handleDragStart = (e: DragEvent<HTMLButtonElement>, ticketId: string) => {
    setDraggedId(ticketId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticketId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) setDragOverCol(colId);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, categoryId: string | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    if (id) {
      setDraggedId(id);
      void moveTicket(id, categoryId);
    }
  };

  const renderTicket = (ticket: Ticket) => (
    <button
      key={ticket.id}
      draggable
      onDragStart={(e) => handleDragStart(e, ticket.id)}
      onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
      onClick={() => onSelectTicket(ticket)}
      className={`w-full text-left bg-white border rounded-xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing ${
        draggedId === ticket.id ? 'opacity-40 border-blue-400' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold text-gray-400">#{ticket.ticket_number}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${PRIORITY_COLORS[ticket.priority]}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITY_DOT[ticket.priority]}`} />
              {PRIORITY_LABELS[ticket.priority]}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 line-clamp-2">{ticket.subject}</p>
          <div className="flex items-center justify-between gap-2 mt-3">
            <span className="text-xs text-gray-500 truncate">{ticket.customer_name}</span>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{STATUS_LABELS[ticket.status]}</span>
          </div>
        </div>
      </div>
    </button>
  );

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-blue-500 animate-spin" /></div>;
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Organização visual</p>
          <h3 className="font-bold text-gray-900 mt-1">Quadro de atendimento</h3>
          <p className="text-sm text-gray-500 mt-1">Arraste os tickets para priorizar e organizar a fila.</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Fechar' : 'Nova categoria'}
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
            <label className="text-xs font-medium text-gray-600">Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: VIP" className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700" /></label>
            <label className="text-xs font-medium text-gray-600">Descrição<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Quando usar esta coluna" className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700" /></label>
            <label className="text-xs font-medium text-gray-600">Cor<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 h-9 w-14 p-1 bg-white border border-gray-200 rounded-lg" /></label>
            <button onClick={createCategory} disabled={saving || !form.name.trim()} className="h-9 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Criar'}</button>
          </div>
        </div>
      )}

      {error && <div className="px-5 py-3 bg-red-50 border-b border-red-100 text-sm text-red-600">{error}</div>}

      <div className="p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {categories.map((category) => {
            const categoryTickets = boardTickets.filter((t) => t.board_category_id === category.id);
            const isOver = dragOverCol === category.id;
            return (
              <div
                key={category.id}
                onDragOver={(e) => handleDragOver(e, category.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, category.id)}
                className={`w-72 rounded-2xl border p-3 min-h-80 transition-colors ${
                  isOver ? 'bg-blue-50 border-blue-400 border-2' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div
                  className="relative flex items-start justify-between gap-2 mb-3 rounded-xl px-3 py-2.5 overflow-hidden"
                  style={{ backgroundColor: category.color }}
                >
                  <label className="absolute inset-0 cursor-pointer" title={`Alterar cor da categoria ${category.name}`}>
                    <input
                      type="color"
                      value={category.color}
                      onChange={(event) => void updateCategoryColor(category, event.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      aria-label={`Alterar cor da categoria ${category.name}`}
                    />
                  </label>
                  <div className="relative flex items-start gap-2 min-w-0 text-white">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm truncate">{category.name}</h4>
                      <p className="text-xs text-white/80 mt-0.5">{categoryTickets.length} ticket{categoryTickets.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <button onClick={() => void deleteCategory(category)} className="relative p-1.5 text-white/70 hover:text-white hover:bg-black/10 rounded-lg" title="Excluir categoria"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {category.description && <p className="text-[11px] text-gray-400 mb-3">{category.description}</p>}
                <div className="space-y-2">{categoryTickets.map(renderTicket)}</div>
              </div>
            );
          })}
          <div
            onDragOver={(e) => handleDragOver(e, '__uncategorized')}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, null)}
            className={`w-72 rounded-2xl border border-dashed p-3 min-h-80 transition-colors ${
              dragOverCol === '__uncategorized' ? 'bg-blue-50 border-blue-400' : 'bg-gray-50/60 border-gray-300'
            }`}
          >
            <h4 className="font-bold text-sm text-gray-500">Sem categoria</h4>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">Arraste para remover a organização</p>
            <div className="space-y-2">{uncategorized.map(renderTicket)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
