package com.mvp.api.note;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/**
 * Request and response shapes, kept separate from the entity on purpose.
 *
 * Serialising Note directly would publish the JPA mapping as the public API
 * contract, so a column rename becomes a breaking change for the frontend --
 * and the frontend's types are generated from this contract by `make types`.
 * Records make the split cheap enough that there is no excuse to skip it.
 */
public final class NoteDtos {

    private NoteDtos() {
    }

    public record CreateNote(
            @NotBlank @Size(max = 200) String title) {
    }

    public record UpdateNote(
            Boolean done,
            @Size(max = 200) String title) {
    }

    // Every field is annotated REQUIRED, and that is load-bearing rather than
    // decorative. springdoc treats an unannotated field as optional, so without
    // these `make types` generates `id?: string` for a value the API always
    // sends, and the frontend null-checks things that cannot be null.
    //
    // JSpecify's @NullMarked would be the tidier way to say this and springdoc
    // 3.1 does not read it -- verified on the sibling project, not assumed.
    public record NoteResponse(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean done,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {

        static NoteResponse from(Note note) {
            return new NoteResponse(
                    note.getId(),
                    note.getTitle(),
                    note.isDone(),
                    note.getCreatedAt());
        }
    }
}
