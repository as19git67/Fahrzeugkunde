"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface Box {
  id: number;
  label: string;
  imagePath: string | null;
  hotspotX: number | null;
  hotspotY: number | null;
  hotspotW: number | null;
  hotspotH: number | null;
}

interface Position {
  id: number;
  label: string;
  hotspotX: number | null;
  hotspotY: number | null;
  hotspotW: number | null;
  hotspotH: number | null;
  boxes: Box[];
}

interface Compartment {
  id: number;
  label: string;
  imagePath: string | null;
  hotspotX: number | null;
  hotspotY: number | null;
  hotspotW: number | null;
  hotspotH: number | null;
  positions: Position[];
}

interface VehicleView {
  id: number;
  side: string;
  label: string;
  imagePath: string | null;
  compartments: Compartment[];
}

interface ItemData {
  id: number;
  name: string;
  article: string | null;
  description: string | null;
  imagePath: string | null;
  category: string | null;
  difficulty: number;
  positionId: number | null;
  boxId: number | null;
  locationLabel: string | null;
}

interface Vehicle {
  id: number;
  name: string;
  views: VehicleView[];
  items: ItemData[];
}

interface Props {
  vehicleId: number;
  onBack: () => void;
}

const SIDES = [
  { value: "left", label: "Links" },
  { value: "right", label: "Rechts" },
  { value: "back", label: "Hinten" },
  { value: "top", label: "Oben" },
  { value: "front", label: "Vorne" },
];

export function VehicleEditor({ vehicleId, onBack }: Props) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [activeTab, setActiveTab] = useState<"structure" | "items">("structure");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const res = await fetch(`/api/vehicles/${vehicleId}`);
    const data = await res.json();
    setVehicle(data);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [vehicleId]);

  if (loading || !vehicle) {
    return <div className="text-zinc-400 py-12 text-center">Lade...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">← Zurück</button>
        <h2 className="text-2xl font-black">{vehicle.name}</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabBtn active={activeTab === "structure"} onClick={() => setActiveTab("structure")}>
          🚒 Struktur
        </TabBtn>
        <TabBtn active={activeTab === "items"} onClick={() => setActiveTab("items")}>
          🔧 Beladung ({vehicle.items.length})
        </TabBtn>
      </div>

      {activeTab === "structure" && (
        <StructureEditor vehicle={vehicle} onReload={reload} />
      )}
      {activeTab === "items" && (
        <ItemsEditor vehicle={vehicle} onReload={reload} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
        active ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

// ---- Struktur Editor ----

function StructureEditor({ vehicle, onReload }: { vehicle: Vehicle; onReload: () => void }) {
  const [newViewSide, setNewViewSide] = useState("left");
  const [newViewLabel, setNewViewLabel] = useState("Fahrzeug links");
  const [addingView, setAddingView] = useState(false);
  const [expandedView, setExpandedView] = useState<number | null>(null);

  const handleAddView = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/vehicles/${vehicle.id}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: newViewSide, label: newViewLabel }),
    });
    setAddingView(false);
    await onReload();
  };

  const handleViewImage = async (viewId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "views");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const { path } = await res.json();
    await fetch(`/api/views/${viewId}/compartments`, {
      // Nutze PATCH auf view direkt — wir patchen den View
    });
    // Für Einfachheit: View-Update via eigenen PATCH
    await fetch(`/api/vehicle-views/${viewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePath: path }),
    });
    await onReload();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ansichten */}
      {vehicle.views.map((view) => (
        <div key={view.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpandedView(expandedView === view.id ? null : view.id)}
            className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-white">{view.label}</span>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                {view.compartments.length} Fächer
              </span>
            </div>
            <span className="text-zinc-400">{expandedView === view.id ? "▲" : "▼"}</span>
          </button>

          <AnimatePresence>
            {expandedView === view.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 border-t border-zinc-800 flex flex-col gap-4">
                  {/* Bild Upload für View */}
                  <ImageUpload
                    label="Fahrzeugseite Bild"
                    currentPath={view.imagePath}
                    onUpload={(file) => handleViewImage(view.id, file)}
                  />

                  {/* Fächer */}
                  <CompartmentList viewId={view.id} compartments={view.compartments} onReload={onReload} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Neue Ansicht */}
      {addingView ? (
        <form onSubmit={handleAddView} className="bg-zinc-900 border border-red-500/30 rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="font-bold">Neue Fahrzeugseite</h3>
          <select
            value={newViewSide}
            onChange={(e) => {
              setNewViewSide(e.target.value);
              setNewViewLabel(`Fahrzeug ${SIDES.find(s => s.value === e.target.value)?.label.toLowerCase()}`);
            }}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400"
          >
            {SIDES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input
            type="text"
            value={newViewLabel}
            onChange={(e) => setNewViewLabel(e.target.value)}
            placeholder="Label"
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400"
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl">Anlegen</button>
            <button type="button" onClick={() => setAddingView(false)} className="bg-zinc-800 text-zinc-400 hover:text-white px-4 py-2 rounded-xl">Abbrechen</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAddingView(true)}
          className="border-2 border-dashed border-zinc-700 hover:border-red-500 rounded-2xl p-4 text-zinc-500 hover:text-white transition-all font-semibold"
        >
          + Fahrzeugseite hinzufügen
        </button>
      )}
    </div>
  );
}

function CompartmentList({
  viewId,
  compartments,
  onReload,
}: {
  viewId: number;
  compartments: Compartment[];
  onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/views/${viewId}/compartments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setAdding(false);
    setLabel("");
    await onReload();
  };

  const handleCompImage = async (compId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "compartments");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const { path } = await res.json();
    await fetch(`/api/compartments/${compId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePath: path }),
    });
    await onReload();
  };

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-zinc-400">Fächer / Rolladen</h4>
      {compartments.map((c) => (
        <div key={c.id} className="bg-zinc-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === c.id ? null : c.id)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-zinc-700/50 transition-colors text-left"
          >
            <span className="font-semibold text-white">{c.label}</span>
            <span className="text-xs text-zinc-500">{c.positions.length} Positionen</span>
          </button>
          <AnimatePresence>
            {expanded === c.id && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 border-t border-zinc-700 flex flex-col gap-3">
                  <ImageUpload
                    label="Fach-Bild (geöffnet)"
                    currentPath={c.imagePath}
                    onUpload={(file) => handleCompImage(c.id, file)}
                  />
                  <PositionList compartmentId={c.id} positions={c.positions} onReload={onReload} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {adding ? (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z.B. G1"
            required
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-1.5 text-white text-sm outline-none focus:border-red-400"
          />
          <button type="submit" className="bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-xl">OK</button>
          <button type="button" onClick={() => setAdding(false)} className="text-zinc-500 hover:text-white px-2">✕</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-zinc-500 hover:text-red-400 text-sm transition-colors text-left">
          + Fach hinzufügen
        </button>
      )}
    </div>
  );
}

function PositionList({
  compartmentId,
  positions,
  onReload,
}: {
  compartmentId: number;
  positions: Position[];
  onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/compartments/${compartmentId}/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setAdding(false);
    setLabel("");
    await onReload();
  };

  return (
    <div className="flex flex-col gap-1">
      <h5 className="text-xs text-zinc-500 font-semibold">Positionen (Ort)</h5>
      {positions.map((p) => (
        <div key={p.id} className="flex flex-col gap-1 bg-zinc-700/50 rounded-lg px-2 py-1">
          <div className="text-sm text-zinc-300">{p.label}</div>
          <BoxList positionId={p.id} boxes={p.boxes} onReload={onReload} />
        </div>
      ))}
      {adding ? (
        <form onSubmit={handleAdd} className="flex gap-2 mt-1">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z.B. oben links"
            required
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-red-400"
          />
          <button type="submit" className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-lg">OK</button>
          <button type="button" onClick={() => setAdding(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs text-zinc-500 hover:text-red-400 transition-colors text-left mt-1">
          + Position
        </button>
      )}
    </div>
  );
}

function BoxList({
  positionId,
  boxes,
  onReload,
}: {
  positionId: number;
  boxes: Box[];
  onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/positions/${positionId}/boxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setAdding(false);
    setLabel("");
    await onReload();
  };

  return (
    <div className="flex flex-col gap-1 pl-3 border-l border-zinc-600/60">
      {boxes.map((b) => (
        <div key={b.id} className="text-xs text-zinc-400">
          📦 {b.label}
        </div>
      ))}
      {adding ? (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z.B. orange Kiste"
            required
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-orange-400"
          />
          <button type="submit" className="bg-orange-600 text-white text-xs font-bold px-2 py-1 rounded-lg">OK</button>
          <button type="button" onClick={() => setAdding(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs text-zinc-500 hover:text-orange-400 transition-colors text-left">
          + Kiste (optional)
        </button>
      )}
    </div>
  );
}

// ---- Items Editor ----

function ItemsEditor({ vehicle, onReload }: { vehicle: Vehicle; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemData | null>(null);

  // Flache Liste aller Ziele (Position oder Box) mit Pfad
  const allTargets = vehicle.views.flatMap((v) =>
    v.compartments.flatMap((c) =>
      c.positions.flatMap((p) => {
        const posTarget = {
          kind: "position" as const,
          id: p.id,
          positionId: p.id,
          boxId: null as number | null,
          label: `${v.label} → ${c.label} → ${p.label}`,
          shortLabel: `${c.label}, ${p.label}`,
        };
        const boxTargets = p.boxes.map((b) => ({
          kind: "box" as const,
          id: b.id,
          positionId: p.id,
          boxId: b.id as number | null,
          label: `${v.label} → ${c.label} → ${p.label} → 📦 ${b.label}`,
          shortLabel: `${c.label}, ${p.label}, ${b.label}`,
        }));
        return [posTarget, ...boxTargets];
      })
    )
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Item-Liste */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {vehicle.items.map((item) => (
          <div
            key={item.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex gap-3 cursor-pointer hover:border-zinc-600 transition-colors"
            onClick={() => { setEditingItem(item); setShowForm(true); }}
          >
            {item.imagePath ? (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                <Image src={item.imagePath} alt={item.name} fill className="object-contain p-1" sizes="64px" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-2xl flex-shrink-0">🔧</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white truncate">
                {item.article && <span className="text-zinc-400 mr-1">{item.article}</span>}
                {item.name}
              </div>
              {item.locationLabel && (
                <div className="text-xs text-zinc-500 mt-0.5">{item.locationLabel}</div>
              )}
              {item.category && (
                <div className="text-xs text-red-400 mt-0.5">{item.category}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Neues Item / Editieren */}
      {showForm ? (
        <ItemForm
          vehicleId={vehicle.id}
          item={editingItem}
          targets={allTargets}
          onSave={() => { setShowForm(false); setEditingItem(null); onReload(); }}
          onCancel={() => { setShowForm(false); setEditingItem(null); }}
          onDelete={async () => {
            if (editingItem) {
              await fetch(`/api/items/${editingItem.id}`, { method: "DELETE" });
              setShowForm(false);
              setEditingItem(null);
              await onReload();
            }
          }}
        />
      ) : (
        <button
          onClick={() => { setEditingItem(null); setShowForm(true); }}
          className="border-2 border-dashed border-zinc-700 hover:border-red-500 rounded-2xl p-4 text-zinc-500 hover:text-white transition-all font-semibold"
        >
          + Ausrüstungsgegenstand hinzufügen
        </button>
      )}
    </div>
  );
}

interface Target {
  kind: "position" | "box";
  id: number;
  positionId: number;
  boxId: number | null;
  label: string;
  shortLabel: string;
}

function ItemForm({
  vehicleId,
  item,
  targets,
  onSave,
  onCancel,
  onDelete,
}: {
  vehicleId: number;
  item: ItemData | null;
  targets: Target[];
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [article, setArticle] = useState(item?.article ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [difficulty, setDifficulty] = useState(item?.difficulty ?? 1);
  // Kodiere aktuelles Ziel als "pos:<id>" oder "box:<id>"
  const initialTargetKey =
    item?.boxId ? `box:${item.boxId}` : item?.positionId ? `pos:${item.positionId}` : "";
  const [targetKey, setTargetKey] = useState<string>(initialTargetKey);
  const [locationLabel, setLocationLabel] = useState(item?.locationLabel ?? "");
  const [imagePath, setImagePath] = useState(item?.imagePath ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "items");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { path } = await res.json();
      setImagePath(path);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Ziel auflösen: "pos:<id>" oder "box:<id>"
      let positionId: number | null = null;
      let boxId: number | null = null;
      if (targetKey.startsWith("pos:")) {
        positionId = parseInt(targetKey.slice(4));
      } else if (targetKey.startsWith("box:")) {
        const t = targets.find((x) => x.kind === "box" && x.id === parseInt(targetKey.slice(4)));
        if (t) {
          positionId = t.positionId;
          boxId = t.boxId;
        }
      }
      const body = {
        vehicleId,
        name,
        article: article || null,
        description: description || null,
        category: category || null,
        difficulty,
        positionId,
        boxId,
        locationLabel: locationLabel || null,
        imagePath: imagePath || null,
      };

      if (item) {
        await fetch(`/api/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSave}
      className="bg-zinc-900 border border-red-500/30 rounded-2xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">{item ? "Gegenstand bearbeiten" : "Neuer Gegenstand"}</h3>
        {item && (
          <button
            type="button"
            onClick={onDelete}
            className="text-red-500 hover:text-red-400 text-sm transition-colors"
          >
            Löschen
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Artikel</label>
          <select
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400 text-sm"
          >
            <option value="">— kein Artikel —</option>
            <option value="der">der</option>
            <option value="die">die</option>
            <option value="das">das</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Seilwinde"
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Kategorie</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="bergung, atemschutz, ..."
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs text-zinc-400">Beschreibung</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurzbeschreibung des Gegenstands"
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Aufbewahrungsort (Text)</label>
          <input
            type="text"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="G1, orange Kiste"
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Position / Kiste (Navigation)</label>
          <select
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400 text-sm"
          >
            <option value="">— keine —</option>
            {targets.map((t) => (
              <option key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Schwierigkeit</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(parseInt(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white outline-none focus:border-red-400 text-sm"
          >
            <option value={1}>1 – Einfach</option>
            <option value={2}>2 – Mittel</option>
            <option value={3}>3 – Schwer</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Bild</label>
          <ImageUpload
            label=""
            currentPath={imagePath}
            onUpload={handleImageUpload}
            uploading={uploading}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 text-white font-bold px-5 py-2 rounded-xl transition-colors text-sm"
        >
          {saving ? "Speichere..." : item ? "Speichern" : "Hinzufügen"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-zinc-800 text-zinc-400 hover:text-white px-5 py-2 rounded-xl transition-colors text-sm"
        >
          Abbrechen
        </button>
      </div>
    </motion.form>
  );
}

// ---- Shared ----

function ImageUpload({
  label,
  currentPath,
  onUpload,
  uploading = false,
}: {
  label: string;
  currentPath: string | null;
  onUpload: (file: File) => void;
  uploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-xs text-zinc-400">{label}</label>}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl p-3 cursor-pointer transition-colors flex items-center gap-3"
      >
        {currentPath ? (
          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
            <Image src={currentPath} alt="Vorschau" fill className="object-contain" sizes="48px" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 text-xl flex-shrink-0">
            📷
          </div>
        )}
        <span className="text-zinc-500 text-sm">
          {uploading ? "Lade hoch..." : currentPath ? "Bild ersetzen" : "Bild hochladen"}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
      />
    </div>
  );
}
