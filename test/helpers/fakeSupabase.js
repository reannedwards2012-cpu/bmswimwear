/**
 * Minimal chainable stand-in for the supabase-js query builder, enough for the
 * server utils under test. Each `.from()` starts a fresh builder. Awaiting the
 * chain (or calling `.maybeSingle()` / `.single()`) resolves to the next queued
 * response `{ data, error }`; every executed query is recorded in `_calls` with
 * its table, op, payload and ordered filters for assertions.
 */
export function createFakeSupabase(responses = []) {
  const queue = [...responses]
  const calls = []

  function builder(table) {
    const state = { table, op: 'select', payload: null, filters: [] }

    const exec = () => {
      calls.push({
        table: state.table,
        op: state.op,
        payload: state.payload,
        filters: state.filters.map((f) => [...f])
      })
      const next = queue.length ? queue.shift() : { data: [], error: null }
      return Promise.resolve(next)
    }

    const api = {
      update(p) {
        state.op = 'update'
        state.payload = p
        return api
      },
      insert(p) {
        state.op = 'insert'
        state.payload = p
        return api
      },
      select() {
        return api
      },
      eq(k, v) {
        state.filters.push(['eq', k, v])
        return api
      },
      is(k, v) {
        state.filters.push(['is', k, v])
        return api
      },
      lt(k, v) {
        state.filters.push(['lt', k, v])
        return api
      },
      gte(k, v) {
        state.filters.push(['gte', k, v])
        return api
      },
      or(s) {
        state.filters.push(['or', s])
        return api
      },
      maybeSingle: exec,
      single: exec,
      then(onFulfilled, onRejected) {
        return exec().then(onFulfilled, onRejected)
      }
    }
    return api
  }

  return {
    from: (t) => builder(t),
    _calls: calls,
    _queue: queue
  }
}

/** True if `calls[i].filters` contains an exact `[op, key, value]` triple. */
export function hasFilter(call, op, key, value) {
  return call.filters.some(
    (f) => f[0] === op && f[1] === key && (value === undefined || f[2] === value)
  )
}
