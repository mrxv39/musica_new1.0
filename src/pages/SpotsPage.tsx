import { useEffect, useState } from "react";
import {
  listSpots,
  createSpot,
  deleteSpot,
  listStrategiesForSpot,
  createStrategy,
  deleteStrategy
} from "../db/spots";
import SpotsStrategyEditor from "./SpotsStrategyEditor";

function ensureSpotsPayload(input: any) {
  const p = (input && typeof input === "object") ? { ...input } : {};
  const ob = (p.or_blocks && typeof p.or_blocks === "object") ? { ...p.or_blocks } : {};

  const required = [
    "OR_TO_CALL_ANY",
    "OPEN_PUSH",
    "OR_TO_CALL_SMALL",
    "OR_TO_FOLD",
    "LIMP_CALL_ANY",
    "LIMP_CALL_SMALL",
    "LIMP_FOLD",
  ];

  for (const k of required) {
    const cur = ob[k];
    if (!cur || typeof cur !== "object") {
      ob[k] = { min: 0, max: 0, range: "" };
    } else {
      ob[k] = {
        min: Number.isFinite(Number(cur.min)) ? Number(cur.min) : 0,
        max: Number.isFinite(Number(cur.max)) ? Number(cur.max) : 0,
        range: (cur.range ?? "") + "",
      };
    }
  }

  return { ...p, or_blocks: ob };
}

export default function SpotsPage() {
  const [spots, setSpots] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<any>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [newSpotName, setNewSpotName] = useState("");
  const [newStrategyName, setNewStrategyName] = useState("");

  async function reloadSpots() {
    const data = await listSpots();
    setSpots(data);
  }

  async function reloadStrategies(spotId: number) {
    const data = await listStrategiesForSpot(spotId);
    setStrategies(data);
  }

  useEffect(() => {
    reloadSpots();
  }, []);

  async function handleCreateSpot() {
    if (!newSpotName.trim()) return;
    await createSpot(newSpotName.trim());
    setNewSpotName("");
    reloadSpots();
  }

  async function handleDeleteSpot(id: number) {
    await deleteSpot(id);
    setSelectedSpot(null);
    setStrategies([]);
    setSelectedStrategy(null);
    reloadSpots();
  }

  async function handleCreateStrategy() {
    if (!selectedSpot || !newStrategyName.trim()) return;
    await createStrategy(selectedSpot.id, newStrategyName.trim(), ensureSpotsPayload({}));
    setNewStrategyName("");
    reloadStrategies(selectedSpot.id);
  }

  async function handleDeleteStrategy(id: number) {
    await deleteStrategy(id);
    setSelectedStrategy(null);
    reloadStrategies(selectedSpot.id);
  }

  return (
    <div>
      <h2>Spots</h2>

      <input
        value={newSpotName}
        onChange={(e) => setNewSpotName(e.target.value)}
        placeholder="New spot name"
      />
      <button onClick={handleCreateSpot}>Create Spot</button>

      <ul>
        {spots.map((s) => (
          <li key={s.id}>
            <strong
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSelectedSpot(s);
                setSelectedStrategy(null);
                reloadStrategies(s.id);
              }}
            >
              {s.name}
            </strong>
            <button onClick={() => handleDeleteSpot(s.id)}>Delete</button>
          </li>
        ))}
      </ul>

      {selectedSpot && (
        <>
          <h3>Strategies for: {selectedSpot.name}</h3>

          <input
            value={newStrategyName}
            onChange={(e) => setNewStrategyName(e.target.value)}
            placeholder="New strategy name"
          />
          <button onClick={handleCreateStrategy}>Add Strategy</button>

          <ul>
            {strategies.map((st) => (
              <li
                key={st.id}
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedStrategy(st)}
              >
                {st.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStrategy(st.id);
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedStrategy && (
        <SpotsStrategyEditor strategy={selectedStrategy} />
      )}
    </div>
  );
}


