/**
 * Shared behaviour for clickable admin list rows/cards (Inquiries, Orders,
 * Products, Fabric Inventory). Keeps the interaction identical everywhere.
 *
 * Usage on a <tr> / <li> that also has tabindex="0" + role + :aria-label:
 *   @click="rowActivate($event, () => open(item))"
 *   @keydown="rowKeydown($event, () => open(item))"
 *
 * Every action control inside the row must carry `data-row-action` and
 * `@click.stop` so a click on it never also opens the item.
 */

/** Open the item unless the click landed on a nested interactive control. */
export function rowActivate(event, open) {
  const el = event.target
  if (el && typeof el.closest === 'function' && el.closest('a, button, input, select, textarea, [data-row-action]')) {
    return
  }
  open()
}

/**
 * Enter / Space activate the row — but only when the row element itself is
 * focused, never when focus is on a child control (whose own key handling
 * already ran and whose keydown bubbles up here).
 */
export function rowKeydown(event, open) {
  if (event.target !== event.currentTarget) return
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    open()
  }
}
