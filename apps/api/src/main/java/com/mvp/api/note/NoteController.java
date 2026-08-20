package com.mvp.api.note;

import com.mvp.api.note.NoteDtos.CreateNote;
import com.mvp.api.note.NoteDtos.NoteResponse;
import com.mvp.api.note.NoteDtos.UpdateNote;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteRepository notes;

    public NoteController(NoteRepository notes) {
        this.notes = notes;
    }

    @GetMapping
    public List<NoteResponse> list() {
        return notes.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(NoteResponse::from)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse create(@Valid @RequestBody CreateNote body) {
        return NoteResponse.from(notes.save(new Note(body.title())));
    }

    // PATCH and not PUT: the UI's checkbox sends `done` alone and has no reason
    // to know the title. A PUT that accepted a partial body would be lying
    // about its own semantics.
    @PatchMapping("/{id}")
    @Transactional
    public NoteResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateNote body) {
        Note note = notes.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No note " + id));
        if (body.done() != null) {
            note.setDone(body.done());
        }
        if (body.title() != null) {
            note.setTitle(body.title());
        }
        return NoteResponse.from(note);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        if (!notes.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No note " + id);
        }
        notes.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
