package com.mvp.api.common;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.springframework.data.domain.Page;

/**
 * The paged envelope every list endpoint returns.
 *
 * Our own record rather than Spring's {@code Page}, for two reasons that both
 * bite the frontend. {@code Page} serialises through {@code PageImpl}, whose
 * JSON shape Spring itself warns is unstable between versions; and springdoc
 * renders it as a generic blob, so `make types` produces a TypeScript type
 * full of optional fields the API always sends.
 *
 * {@code page} is zero-based, matching Spring Data and the {@code ?page=} the
 * client sends. Naming it that and 1-basing it would be the worst of both.
 *
 * @param <T> the element type -- springdoc resolves this per use site
 */
public record PagedResponse<T>(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<T> content,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int size,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int totalPages,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long totalElements,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean first,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean last) {

    public static <E, T> PagedResponse<T> of(Page<E> page, java.util.function.Function<E, T> mapper) {
        return new PagedResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalPages(),
                page.getTotalElements(),
                page.isFirst(),
                page.isLast());
    }
}
