import { useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import { useApi, useRefresh } from '../../hooks'
import { Alert, Loading, Page } from '../../components/Ui'

export default function UsersAdmin() {
  const { user: me, reloadUser } = useAuth()
  const users = useApi(api.users)
  const { refresh } = useRefresh()
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  if (!users.data) return <Loading error={users.error} />

  async function update(user, body) {
    setError(null)
    try {
      await api.updateUser(user.id, body)
      if (user.id === me.id) await reloadUser()
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(user) {
    if (!window.confirm(`Delete the account "${user.username}"? This cannot be undone.`)) return
    try {
      await api.deleteUser(user.id)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const q = query.toLowerCase()
  const visible = users.data.filter((u) =>
    [u.username, u.email, u.first_name, u.last_name].some((v) => v?.toLowerCase().includes(q)))

  return (
    <Page kicker="Site admin" title="Users" intro="Every account on PickleXP. Admins can manage any tournament.">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input className="w-full max-w-xs rounded-md border-0 bg-card px-4 py-2 text-sm border border-line focus:border-olive focus:ring-2 focus:ring-lime/50 focus:outline-none"
          placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <p className="text-sm font-bold text-ink/60">{users.data.length} {users.data.length === 1 ? 'account' : 'accounts'}</p>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="overflow-x-auto rounded-xl bg-card shadow-sm border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-ink text-left text-[11px] uppercase tracking-wider text-white/70">
            <tr>
              <th className="px-5 py-3 font-semibold">User</th>
              <th className="px-3 py-3 font-semibold">Joined</th>
              <th className="px-3 py-3 font-semibold">Admin</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <p className="font-semibold">{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</p>
                  <p className="text-xs text-ink/55">@{u.username} · {u.email || 'no email'}</p>
                </td>
                <td className="px-3 text-ink/60">{new Date(u.date_joined).toLocaleDateString()}</td>
                <td className="px-3">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-olive" checked={u.is_staff}
                      disabled={u.id === me.id} onChange={(e) => update(u, { is_staff: e.target.checked })} />
                    <span className={`text-xs font-bold ${u.is_staff ? 'text-olive' : 'text-ink/45'}`}>{u.is_staff ? 'Admin' : 'Player'}</span>
                  </label>
                </td>
                <td className="px-5 text-right">
                  {u.id !== me.id && (
                    <button onClick={() => remove(u)} className="text-xs font-bold text-red-600 hover:underline">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  )
}
