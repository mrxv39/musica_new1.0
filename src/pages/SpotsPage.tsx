/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\SpotsPage.tsx

import { useEffect, useState } from "react";
import {
  listSpots,
  createSpot,
  deleteSpot,
  listStrategiesForSpot,
  createStrategy,
  deleteStrategy,
  SpotRow,
  StrategyRow,
} from "../db/spots";

export default function SpotsPage() {
  const [spots, setSpots] = useState<SpotRow[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<SpotRow | null>(null);
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [newSpotName, setNewSpotName] = useState("");
  const [newStrategyName, setNewStrategyName] = useState("");

  async function loadSpots() {
    const rows = await listSpots();
    setSpots(rows);
  }

  async function loadStrategies(spotId: number) {
    const rows = await listStrategiesForSpot(spotId);
    setStrategies(rows);
  }

  useEffect(() => {
    loadSpots();
  }, []);

  useEffect(() => {
    if (selectedSpot) loadStrategies(selectedSpot.id);
    else setStrategies([]);
  }, [selectedSpot]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Spots</h2>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="New spot name"
          value={newSpotName}
          onChange={(e) => setNewSpotName(e.target.value)}
        />
        <button
          onClick={async () => {
            await createSpot(newSpotName);
            setNewSpotName("");
            await loadSpots();
          }}
        >
          Create Spot
        </button>
      </div>

      <ul>
        {spots.map((spot) => (
          <li key={spot.id}>
            <span
              style={{
                cursor: "pointer",
                fontWeight: selectedSpot?.id === spot.id ? "bold" : "normal",
              }}
              onClick={() => setSelectedSpot(spot)}
            >
              {spot.name}
            </span>
            <button
              style={{ marginLeft: 8 }}
              onClick={async () => {
                await deleteSpot(spot.id);
                if (selectedSpot?.id === spot.id) setSelectedSpot(null);
                await loadSpots();
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {selectedSpot && (
        <>
          <h3 style={{ marginTop: 24 }}>
            Strategies for: {selectedSpot.name}
          </h3>

          <div style={{ marginBottom: 16 }}>
            <input
              placeholder="New strategy name"
              value={newStrategyName}
              onChange={(e) => setNewStrategyName(e.target.value)}
            />
            <button
              onClick={async () => {
                await createStrategy(selectedSpot.id, newStrategyName);
                setNewStrategyName("");
                await loadStrategies(selectedSpot.id);
              }}
            >
              Add Strategy
            </button>
          </div>

          <ul>
            {strategies.map((s) => (
              <li key={s.id}>
                {s.name}
                <button
                  style={{ marginLeft: 8 }}
                  onClick={async () => {
                    await deleteStrategy(s.id);
                    await loadStrategies(selectedSpot.id);
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
