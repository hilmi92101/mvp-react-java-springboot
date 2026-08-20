package com.mvp.api.external;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * What {@code GET /api/external/rates} returns.
 *
 * Deliberately not Frankfurter's response passed straight through. Re-shaping
 * it costs four lines and means a change on their side is a compile error here
 * rather than a silent contract change for the frontend.
 */
public final class ExternalDtos {

    private ExternalDtos() {
    }

    public record RatesResponse(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "MYR") String base,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
            // BigDecimal, not double. These are money; a rate that round-trips
            // as 4.7299999999999995 is the kind of detail that makes a demo
            // look broken.
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<String, BigDecimal> rates,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Upstream round trip, milliseconds")
            long upstreamMs,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Which third party answered")
            String source) {
    }

    /** Frankfurter's own shape. Package-private -- it never leaves the feature. */
    record FrankfurterRates(String base, LocalDate date, Map<String, BigDecimal> rates) {
    }
}
