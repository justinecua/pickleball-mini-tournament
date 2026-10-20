import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Alert, Button, Field, inputClass } from '../components/Ui'
import AuthLayout from './AuthLayout'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setErrors({ confirm: 'Passwords do not match.' })
      return
    }
    setBusy(true)
    setErrors({})
    try {
      const { confirm: _confirm, ...details } = form
      await signUp(details)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setErrors(Object.keys(err.fields).length ? err.fields : { non_field_errors: err.message })
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Sign up"
      footer={<>Already have an account? <Link to="/login" state={location.state} className="font-semibold text-olive underline underline-offset-4 hover:text-ink">Log in</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {(errors.non_field_errors || errors.detail) && <Alert>{errors.non_field_errors || errors.detail}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.first_name}>
            <input className={inputClass} autoComplete="given-name" value={form.first_name} onChange={set('first_name')} />
          </Field>
          <Field label="Last name" error={errors.last_name}>
            <input className={inputClass} autoComplete="family-name" value={form.last_name} onChange={set('last_name')} />
          </Field>
        </div>
        <Field label="Username" error={errors.username}>
          <input className={inputClass} autoComplete="username" required value={form.username} onChange={set('username')} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" className={inputClass} autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" error={errors.password} hint="At least 8 characters.">
            <input type="password" className={inputClass} autoComplete="new-password" required value={form.password} onChange={set('password')} />
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            <input type="password" className={inputClass} autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
          </Field>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
      </form>
    </AuthLayout>
  )
}
