package com.mvp.api.config;

import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * One hand-written correction to the generated OpenAPI document.
 *
 * {@code GET /api/notes} returns two shapes -- a flat array without
 * {@code ?page=}, an envelope with it -- and that is expressible in OpenAPI as
 * {@code oneOf: [array of NoteResponse, PagedNotes]}. It is <em>not</em>
 * expressible in springdoc's annotation model: {@code @Schema(oneOf = ...)}
 * takes classes, and "array of X" is not a class. The attempt produced
 * {@code NoteList: unknown} in api-types.ts, which is worse than no type at
 * all -- it typechecks against anything.
 *
 * So the annotation states the intent and this fixes the document. The
 * alternative was a second path for the paged shape, which the plan rejected
 * in Question 6 to keep the existing frontend callers untouched.
 */
@Configuration
class OpenApiConfig {

    @Bean
    OpenApiCustomizer notesListReturnsTwoShapes() {
        return openApi -> {
            var notes = openApi.getPaths() == null ? null : openApi.getPaths().get("/api/notes");
            if (notes == null || notes.getGet() == null || notes.getGet().getResponses() == null) {
                // Defensive because this runs against whatever springdoc built:
                // a renamed path should degrade to an unpatched document, not
                // fail the whole /v3/api-docs request with an NPE.
                return;
            }
            var ok = notes.getGet().getResponses().get("200");
            if (ok == null) {
                return;
            }

            Schema<?> flatArray = new ArraySchema()
                    .items(new Schema<>().$ref("#/components/schemas/NoteResponse"))
                    .description("Every note, newest first -- returned when ?page= is absent");
            Schema<?> paged = new Schema<>()
                    .$ref("#/components/schemas/PagedNotes")
                    .description("One page of 10 -- returned when ?page= is given");

            ok.setContent(new Content().addMediaType(
                    "application/json",
                    new MediaType().schema(new ComposedSchema().oneOf(List.of(flatArray, paged)))));

            // The placeholder class that only existed to give oneOf something
            // to point at. Left behind it becomes a mystery type in the docs.
            if (openApi.getComponents() != null && openApi.getComponents().getSchemas() != null) {
                openApi.getComponents().getSchemas().remove("NoteList");
            }
        };
    }
}
