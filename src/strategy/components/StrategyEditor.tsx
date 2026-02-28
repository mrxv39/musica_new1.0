/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\StrategyEditor.tsx
 *
 * Spot UI = situations (DB)
 * - select muestra todas las situation keys
 * - botones: Nuevo / Renombrar / Borrar (con warning si hay subs)
 */
import { useMemo } from "react";
import type { OrRanges, OrRangesPlan, PlayerPos, SubStrategyPayload } from "../types";
import { computeSituacionFromPositions } from "../utils";
import OrRangesPanel from "./OrRangesPanel";
import { SelectField } from "./editor/EditorFields";
import { cardStyle, headerRow } from "./editor/editorStyles";
import P1Card from "./editor/P1Card";
import VillainCard from "./editor/VillainCard";

type Props = {
  value: SubStrategyPayload;
  onChange: (next: SubStrategyPayload) => void;

  showOrPanel?: boolean;

  // compat (tests)
  orRanges?: OrRanges;
  onChangeOrRanges?: (next: OrRanges) => void;

  orRangesPlan?: OrRangesPlan;
  onChangeOrRangesPlan?: (next: OrRangesPlan) => void;

  // ✅ situations (DB)
  situationOptions?: string[];
  onCreateSituation?: (key: string) => Promise<void> | void;
  onRenameSituation?: (from: string, to: string) => Promise<void> | void;
  onDeleteSituation?: (key: string) => Promise<void> | void;
  onDeleteSituationForce?: (key: string) => Promise<void> | void;
};

const POS: PlayerPos[] = ["BTN", "SB", "BB"];

const EMPTY_OR: OrRanges = {
  OR_TO_CALL_ANY: "",
  OPEN_PUSH: "",
  OR_TO_CALL_SMALL: "",
  OR_TO_FOLD: "",
};

export default function StrategyEditor({
  value,
  onChange,
  showOrPanel = false,
  orRanges,
  onChangeOrRanges,
  orRangesPlan,
  onChangeOrRangesPlan,

  situationOptions,
  onCreateSituation,
  onRenameSituation,
  onDeleteSituation,
  onDeleteSituationForce,
}: Props) {
  const computedSituacion = useMemo(() => {
    return computeSituacionFromPositions(value.hero_pos, value.p2_pos, value.p3_pos);
  }, [value.hero_pos, value.p2_pos, value.p3_pos]);

  function patch(p: Partial<SubStrategyPayload>) {
    const next: SubStrategyPayload = { ...value, ...p };
    next.situacion = String((next as any).situacion ?? "");
    onChange(next);
  }

  const effectiveOrRanges = orRanges ?? value.orRanges ?? EMPTY_OR;

  const handleOrRangesChange =
    onChangeOrRanges ??
    ((next: OrRanges) => {
      patch({ orRanges: next });
    });

  const effectivePlan = orRangesPlan ?? value.orRangesPlan;

  const handlePlanChange =
    onChangeOrRangesPlan ??
    ((next: OrRangesPlan) => {
      patch({ orRangesPlan: next });
    });

  // options fallback: para no romper tests ni render si aún no cargó DB
  const SITUATIONS = (situationOptions && situationOptions.length ? situationOptions : [String((value as any)?.situacion ?? "unknown")]).filter(
    (x) => String(x).trim().length > 0
  ) as unknown as string[];

  const currentSituation = String((value as any)?.situacion ?? (SITUATIONS[0] ?? "unknown"));

  const canManage = !!onCreateSituation && !!onRenameSituation && !!onDeleteSituation && !!onDeleteSituationForce;

  const onNew = async () => {
    if (!onCreateSituation) return;
    const k = window.prompt("Nueva situation key:", "BTN_vs_SB_BB_FISH_FISH");
    if (!k) return;
    await onCreateSituation(String(k));
    patch({ situacion: String(k).trim() } as any);
  };

  const onRename = async () => {
    if (!onRenameSituation) return;
    const from = currentSituation;
    const to = window.prompt(`Renombrar situation:\n${from}\n\nNuevo key:`, from);
    if (!to) return;
    await onRenameSituation(from, String(to).trim());
    patch({ situacion: String(to).trim() } as any);
  };

  const onDelete = async () => {
    if (!onDeleteSituation || !onDeleteSituationForce) return;
    const key = currentSituation;

    try {
      await onDeleteSituation(key);
      // si se borra, limpia selección local (el hook ya refresca)
      patch({ situacion: "" } as any);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);

      // Nuestro contrato: SITUATION_HAS_SUBS:<n>
      if (msg.startsWith("SITUATION_HAS_SUBS:")) {
        const n = msg.split(":")[1] ?? "?";
        const ok = window.confirm(
          `La situation "${key}" tiene ${n} subestrategias vinculadas.\n\nSi borras, se borrarán TAMBIÉN (cascada).\n\n¿Quieres continuar?`
        );
        if (!ok) return;

        await onDeleteSituationForce(key);
        patch({ situacion: "" } as any);
        return;
      }

      // otro error
      window.alert(`No se pudo borrar:\n${msg}`);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={headerRow}>
        <div style={{ fontWeight: 700 }}>Editor</div>
        <div style={{ opacity: 0.7 }}>posicion: {computedSituacion}</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <SelectField
            label="Spot"
            value={currentSituation as any}
            options={SITUATIONS as any}
            onChange={(v) => patch({ situacion: String(v) } as any)}
          />

          {canManage ? (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => void onNew()} style={{ padding: "6px 10px", borderRadius: 8 }}>
                + Nueva
              </button>
              <button type="button" onClick={() => void onRename()} style={{ padding: "6px 10px", borderRadius: 8 }}>
                Renombrar
              </button>
              <button type="button" onClick={() => void onDelete()} style={{ padding: "6px 10px", borderRadius: 8 }}>
                Borrar
              </button>
            </div>
          ) : null}
        </div>

        <SelectField
          label="Hero Pos"
          value={value.hero_pos}
          options={POS as unknown as string[]}
          onChange={(v) => patch({ hero_pos: v as PlayerPos })}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <P1Card value={value} patch={patch} />
        <VillainCard which="p2" title="P2" value={value} patch={patch} />
        <VillainCard which="p3" title="P3" value={value} patch={patch} />
      </div>

      {showOrPanel ? (
        <div style={{ marginTop: 12 }}>
          <OrRangesPanel
            situationKey={currentSituation}
            value={effectiveOrRanges}
            onChange={handleOrRangesChange}
            plan={effectivePlan}
            onChangePlan={handlePlanChange}
            p1_stack_min={value.p1_stack_min}
            p1_stack_max={value.p1_stack_max}
          />
        </div>
      ) : null}
    </div>
  );
}
