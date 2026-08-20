import { useEffect, useState } from 'react'
import { api, type Note } from '@/api'
import './notes.css'

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .list()
      .then(setNotes)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    try {
      const created = await api.create(trimmed)
      // Prepend rather than refetch: the API orders by createdAt DESC, so the
      // newest note belongs at the front and the response already has the
      // server-assigned id and timestamp.
      setNotes((prev) => [created, ...prev])
      setTitle('')
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function toggle(note: Note) {
    try {
      const updated = await api.setDone(note.id, !note.done)
      setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(id: string) {
    try {
      await api.remove(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <main className="shell">
      <header>
        <h1>Notes</h1>
        <p className="sub">
          React (Vite) → Spring Boot → SQL Server. Every process runs in a container.
        </p>
      </header>

      <form onSubmit={add} className="composer">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Write a note…"
          maxLength={200}
          aria-label="Note title"
        />
        <button type="submit" disabled={!title.trim()}>
          Add
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="empty">No notes yet. The table is real and it is empty.</p>
      ) : (
        <ul className="notes">
          {notes.map((note) => (
            <li key={note.id} className={note.done ? 'done' : undefined}>
              <label>
                <input
                  type="checkbox"
                  checked={note.done}
                  onChange={() => toggle(note)}
                />
                <span className="title">{note.title}</span>
              </label>
              <time dateTime={note.createdAt}>
                {new Date(note.createdAt).toLocaleTimeString()}
              </time>
              <button
                className="remove"
                onClick={() => remove(note.id)}
                aria-label={`Delete ${note.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
