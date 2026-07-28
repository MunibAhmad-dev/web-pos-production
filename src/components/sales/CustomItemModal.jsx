import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input } from '@/components/form/fields';

export default function CustomItemModal({ open, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    if (!name.trim() || !price) return;
    onAdd({ name: name.trim(), unitPrice: Number(price), qty: Number(qty) || 1 });
    setName('');
    setPrice('');
    setQty(1);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Custom Item"
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim() || !price}>
            Add to Cart
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Item name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Custom repair fee" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input label="Quantity" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
