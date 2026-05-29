import { useEffect, useState } from 'react';
import { apiJSON } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import CarForm from './CarForm';
import type { Car } from '../../types';

const PAGE_SIZE = 10;

export default function Cars() {
  const { showToast } = useToast();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editCar, setEditCar] = useState<Partial<Car> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  async function load() {
    try {
      const data = await apiJSON<Car[]>('/cars');
      setCars(data);
    } catch {
      showToast('Failed to load cars', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function deleteCar() {
    if (!deleteId) return;
    try {
      await apiJSON(`/cars/${deleteId}`, { method: 'DELETE' });
      showToast('Car deleted', 'success');
      setDeleteId(null);
      load();
    } catch {
      showToast('Delete failed', 'error');
    }
  }

  async function toggleAvailable(car: Car) {
    try {
      await apiJSON(`/cars/${car.id}`, {
        method: 'PUT',
        body: JSON.stringify({ available: !car.available }),
      });
      showToast(`${car.brand} ${car.model} marked as ${!car.available ? 'available' : 'maintenance'}`, 'success');
      load();
    } catch {
      showToast('Update failed', 'error');
    }
  }

  const filtered = cars.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.brand.toLowerCase().includes(q) || c.model.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
  });

  const sliced = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading) return <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Manage Cars</h1>
          <p className="text-sm text-brand-muted mt-1">{cars.length} vehicles in fleet</p>
        </div>
        <button
          onClick={() => { setEditCar({}); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500 transition-colors"
        >
          + Add Car
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search by brand, model, type..."
        className="w-full max-w-sm bg-brand-surface border border-white/10 rounded-xl px-4 py-2 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50 transition-colors"
      />

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Image', 'Car', 'Type', 'Price/day', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sliced.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-brand-muted">No cars found</td></tr>
              )}
              {sliced.map((car) => (
                <tr key={car.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    {car.image ? (
                      <img src={car.image} alt={car.model} className="w-16 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-16 h-10 rounded-lg bg-brand-elevated flex items-center justify-center text-xl">🚗</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-brand-text font-medium">{car.brand} {car.model}</p>
                    <p className="text-xs text-brand-muted">{car.year}</p>
                  </td>
                  <td className="px-4 py-3 text-brand-muted text-xs">{car.type}</td>
                  <td className="px-4 py-3 text-brand-red font-bold">${car.price}</td>
                  <td className="px-4 py-3">
                    <Badge status={car.available ? 'available' : 'maintenance'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setEditCar(car); setFormOpen(true); }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-brand-muted hover:text-brand-text transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleAvailable(car)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-brand-muted hover:text-brand-text transition-colors"
                      >
                        {car.available ? 'Maintenance' : 'Available'}
                      </button>
                      <button
                        onClick={() => setDeleteId(car.id)}
                        className="px-2.5 py-1 rounded-lg text-xs text-brand-muted hover:text-red-400 hover:bg-red-500/5 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-white/5">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} maxWidth="max-w-2xl">
        <CarForm
          car={editCar}
          onSave={() => { setFormOpen(false); showToast('Car saved', 'success'); load(); }}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Car"
        message={`Permanently delete this car and all its bookings?`}
        confirmLabel="Delete"
        danger
        onConfirm={deleteCar}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
