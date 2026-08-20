package com.mvp.api.place;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/**
 * Request and response shapes for {@code /api/places}.
 *
 * Public where the entity is not: these records are the feature's contract,
 * and `make types` turns them into apps/web/src/api-types.ts.
 */
public final class PlaceDtos {

    private PlaceDtos() {
    }

    /**
     * What the browser posts when the star is clicked. Everything here comes
     * from the Google Place Details call, so the server trusts none of it
     * beyond shape -- hence the bounds, which mirror V2's column widths.
     */
    public record SaveFavouritePlace(
            @NotBlank @Size(max = 255) String placeId,
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 500) String formattedAddress,
            // Boxed and @NotNull rather than a primitive double: a missing
            // field would otherwise silently bind to 0.0, which is a real
            // location in the Gulf of Guinea.
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng) {
    }

    // Every field REQUIRED, for the reason NoteDtos spells out: springdoc
    // treats an unannotated field as optional, and the frontend would then
    // null-check values the API always sends.
    public record FavouritePlaceResponse(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String placeId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String formattedAddress,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double lat,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double lng,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {

        static FavouritePlaceResponse from(FavouritePlace place) {
            return new FavouritePlaceResponse(
                    place.getId(),
                    place.getPlaceId(),
                    place.getName(),
                    place.getFormattedAddress(),
                    place.getLat(),
                    place.getLng(),
                    place.getCreatedAt());
        }
    }
}
