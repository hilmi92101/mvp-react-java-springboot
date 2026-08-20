package com.mvp.api.note;

import com.mvp.api.note.NoteDtos.CreateNote;
import com.mvp.api.note.NoteDtos.NoteResponse;
import com.mvp.api.note.NoteDtos.PagedNotes;
import com.mvp.api.note.NoteDtos.UpdateNote;
import java.util.List;
import java.util.UUID;

/**
 * The {@code note/} feature's barrel -- the one type another feature may hold.
 *
 * Added here so the transaction boundary can move off the controller. It sat
 * there because this feature predates the folder-structure standard; a
 * {@code @Transactional} on an HTTP handler ties the transaction's lifetime to
 * the request's, which is the wrong unit the moment one request does two things.
 */
public interface NoteService {

    /** Every note, newest first. The un-paged shape the notes page still uses. */
    List<NoteResponse> list();

    /**
     * One page of notes, newest first.
     *
     * @param page zero-based; a negative value is clamped to 0 rather than
     *             throwing, because a 400 for {@code ?page=-1} tells a browsing
     *             human nothing they can act on
     */
    PagedNotes listPaged(int page);

    NoteResponse get(UUID id);

    NoteResponse create(CreateNote body);

    NoteResponse update(UUID id, UpdateNote body);

    void delete(UUID id);
}
