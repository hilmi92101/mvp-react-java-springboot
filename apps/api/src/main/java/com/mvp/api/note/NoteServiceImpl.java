package com.mvp.api.note;

import com.mvp.api.common.PagedResponse;
import com.mvp.api.logging.ActivityLog;
import com.mvp.api.note.NoteDtos.CreateNote;
import com.mvp.api.note.NoteDtos.NoteResponse;
import com.mvp.api.note.NoteDtos.PagedNotes;
import com.mvp.api.note.NoteDtos.UpdateNote;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * The transaction boundary for {@code note/}, and the only place that sees the
 * entity.
 *
 * {@code update} is the interesting one: it loads the entity and mutates it
 * without ever calling {@code save()}. That works because the method is
 * transactional and the entity is therefore managed -- Hibernate flushes the
 * change at commit. Move the annotation off and the PATCH silently stops
 * persisting while still returning 200, which is why the playground page has a
 * card that proves the rollback rather than trusting the annotation.
 */
@Service
class NoteServiceImpl implements NoteService {

    /**
     * Clamped server-side, not a client-controlled parameter. The requirement
     * is ten records per page; a {@code ?size=} the caller picks would make
     * that a suggestion.
     */
    static final int PAGE_SIZE = 10;

    private final NoteRepository notes;
    private final ActivityLog activity;

    NoteServiceImpl(NoteRepository notes, ActivityLog activity) {
        this.notes = notes;
        this.activity = activity;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteResponse> list() {
        return notes.findAllByOrderByCreatedAtDesc().stream().map(NoteResponse::from).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PagedNotes listPaged(int page) {
        int safePage = Math.max(page, 0);
        PagedNotes result = PagedNotes.from(PagedResponse.of(
                notes.findAllByOrderByCreatedAtDesc(PageRequest.of(safePage, PAGE_SIZE)),
                NoteResponse::from));
        activity.record("Someone read page " + safePage + " of the notes ("
                + result.content().size() + " of " + result.totalElements() + " shown)");
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public NoteResponse get(UUID id) {
        return notes.findById(id).map(NoteResponse::from).orElseThrow(() -> notFound(id));
    }

    @Override
    @Transactional
    public NoteResponse create(CreateNote body) {
        NoteResponse saved = NoteResponse.from(notes.save(new Note(body.title())));
        activity.record("Someone added a note titled '" + body.title() + "'");
        return saved;
    }

    @Override
    @Transactional
    public NoteResponse update(UUID id, UpdateNote body) {
        Note note = notes.findById(id).orElseThrow(() -> notFound(id));
        if (body.done() != null) {
            note.setDone(body.done());
            activity.record("Someone marked '" + note.getTitle() + "' as "
                    + (body.done() ? "done" : "not done"));
        }
        if (body.title() != null) {
            activity.record("Someone renamed '" + note.getTitle() + "' to '" + body.title() + "'");
            note.setTitle(body.title());
        }
        // No save() -- see the class comment. The entity is managed.
        return NoteResponse.from(note);
    }

    @Override
    @Transactional
    public void delete(UUID id) {
        Note note = notes.findById(id).orElseThrow(() -> notFound(id));
        notes.delete(note);
        activity.record("Someone deleted the note '" + note.getTitle() + "'");
    }

    private static ResponseStatusException notFound(UUID id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "No note " + id);
    }
}
