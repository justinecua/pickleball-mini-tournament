import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Alert, Loading, Page } from '../components/Ui'

/** Old-style /join/<code> links: find the invite's tournament and go to its registration page. */
export default function InviteRedirect() {
  const { code } = useParams()
  const [state, setState] = useState({ data: null, error: null })
  useEffect(() => {
    api.invite(code).then((data) => setState({ data, error: null })).catch((error) => setState({ data: null, error }))
  }, [code])
  if (state.data) return <Navigate to={`/t/${state.data.tournament.slug}/join/${code}`} replace />
  if (!state.error) return <Loading />
  return (
    <Page kicker="Invitation" title="Invite not found">
      <Alert>That invite link isn&apos;t valid. Check the code with your partner.</Alert>
      <Link to="/" className="mt-6 inline-block text-sm font-semibold text-olive hover:underline">Browse tournaments</Link>
    </Page>
  )
}
