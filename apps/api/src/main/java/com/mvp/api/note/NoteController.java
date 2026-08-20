package com.mvp.api.note;

import com.mvp.api.note.NoteDtos.CreateNote;
import com.mvp.api.note.NoteDtos.NoteResponse;
import com.mvp.api.note.NoteDtos.PagedNotes;
import com.mvp.api.note.NoteDtos.UpdateNote;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP in, HTTP out. No {@code @Transactional} here any more -- it moved to
 * {@link NoteServiceImpl}, which is where the unit of work actually is.
 */
@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteService notes;

    public NoteController(NoteService notes) {
        this.notes = notes;
    }

    /**
     * Two shapes on one path, chosen by whether {@code ?page=} is present.
     *
     * A separate {@code /notes/paged} was the alternative and it would have
     * been tidier REST. This won because the notes page and {@code api.ts}
     * already call bare {@code GET /api/notes} and expect a flat array:
     * conditional keeps them untouched, and the two shapes are distinguishable
     * by the caller that asked for them.
     */
    @GetMapping
    @Operation(summary = "List notes -- a flat array, or a page of 10 when ?page= is given")
    // The method returns Object, so springdoc has nothing to infer from. This
    // annotation names the paged half; the flat-array half is added to the
    // document by OpenApiConfig, because "array of NoteResponse" cannot be
    // written as a class inside oneOf. Both are needed -- see that class.
    @ApiResponse(
            responseCode = "200",
            content = @Content(schema = @Schema(implementation = PagedNotes.class)))
    public Object list(@RequestParam(required = false) Integer page) {
        return page == null ? notes.list() : notes.listPaged(page);
    }

    @GetMapping("/{id}")
    public NoteResponse get(@PathVariable UUID id) {
        return notes.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse create(@Valid @RequestBody CreateNote body) {
        return notes.create(body);
    }

    // PATCH and not PUT: the UI's checkbox sends `done` alone and has no reason
    // to know the title. A PUT that accepted a partial body would be lying
    // about its own semantics.
    @PatchMapping("/{id}")
    public NoteResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateNote body) {
        return notes.update(id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        notes.delete(id);
        return ResponseEntity.noContent().build();
    }
}
