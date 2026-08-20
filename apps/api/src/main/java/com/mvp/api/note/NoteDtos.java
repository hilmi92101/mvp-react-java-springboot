package com.mvp.api.note;

import com.mvp.api.common.PagedResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
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

    /**
     * What {@code GET /api/notes?page=0} returns.
     *
     * A concrete record and not {@code PagedResponse<NoteResponse>} directly,
     * for one reason: springdoc names a generic schema
     * {@code PagedResponseNoteResponse} and, depending on how the type is
     * resolved, can widen {@code content} to {@code object[]}. Either outcome
     * lands in api-types.ts and the playground page loses its types. The
     * generic still does the work -- see {@link #from} -- this record just
     * gives the OpenAPI document a name and a resolved element type.
     */
    public record PagedNotes(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<NoteResponse> content,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int size,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int totalPages,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long totalElements,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean first,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean last) {

        static PagedNotes from(PagedResponse<NoteResponse> page) {
            return new PagedNotes(
                    page.content(),
                    page.page(),
                    page.size(),
                    page.totalPages(),
                    page.totalElements(),
                    page.first(),
                    page.last());
        }
    }
}
