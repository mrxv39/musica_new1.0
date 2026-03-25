# Improvements & Observations Session 2026-03-18

## Instructions
- Add observations, bugs, or improvements as you find them
- Use format: `- [ ] [CATEGORY] Description | Notes`
- Categories: BUG, FEATURE, UX, PERF, CRASH, UI, etc.
- Update status: `[ ]` = pending, `[x]` = fixed/done

---

## Observations from Live Testing

### ✅ RESUELTO: Overlay UI para estrategias en tiempo real

**Problema**: Antes mostraba 3 ventanas emergentes (move, mano, betmin/betmax) en tiempo real cuando detectaba estrategia.

**Causa Found**: Las invocaciones Tauri (`show_overlay`, `hide_overlay`) fueron removidas del TypeScript. El backend estaba 100% completo.

**Solución**: Restauré las invocaciones en `useHandsPageWorkerActions.ts`
- ✅ Backend Rust: Completo (show_overlay, hide_overlay, get_mesas_overlay_state)
- ✅ HTML overlays: Existen y funcionales (overlay.html, overlay_info.html, overlay_button.html)
- ✅ TypeScript: RESTAURADO (commit 8d33f23)
- ✅ Polling mechanism: Working (800ms interval)

**Sistema completo**:
1. Usuario hace click "Run Workers"
2. Frontend invoca `show_overlay()` → Rust muestra 4 ventanas overlay
3. overlay_info.html hace polling a `get_mesas_overlay_state()` cada 800ms
4. Cuando strategy_ready=true, muestra 3 pills por mesa: hand_class, bet (min/max), move
5. Al parar workers: `hide_overlay()` oculta las ventanas

### Critical Issues
<!-- Add critical bugs here -->

### High Priority Improvements
<!-- Add important improvements here -->

### Nice-to-Have Features
<!-- Add feature requests here -->

### Performance Issues
<!-- Add performance observations here -->

### UI/UX Issues
<!-- Add UI/UX improvements here -->

### Other Notes
<!-- General notes and observations -->

---

## Summary
- **Date**: 2026-03-18
- **Tester**: Usuario
- **Status**: In Progress
