import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Alert, Button, Field, inputClass } from '../components/Ui'
import AuthLayout from './AuthLayout'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(form)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Log in"
      footer={<>New here? <Link to="/register" state={location.state} className="font-semibold text-olive underline underline-offset-4 hover:text-ink">Create an account</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Username or email">
          <input className={inputClass} autoComplete="username" required autoFocus value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </Field>
        <Field label="Password">
          <input type="password" className={inputClass} autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</Button>
      </form>
    </AuthLayout>
  )
}
