package com.mvp.api.place;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Request and response shapes for the server-side Places calls.
 *
 * The {@code Google*} records at the bottom are package-private and mirror
 * Google's wire format; the public ones are ours. Passing Google's shape
 * straight through would put {@code displayName.text} in the frontend's types
 * and make their API version our API version.
 */
public final class PlaceSearchDtos {

    private PlaceSearchDtos() {
    }

    public record PlaceSummary(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String placeId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String formattedAddress,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double lat,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double lng) {
    }

    public record PlaceSearchResults(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PlaceSummary> results,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Upstream round trip, milliseconds")
            long upstreamMs,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String source) {
    }

    public record PlaceDetail(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String placeId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String formattedAddress,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double lat,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double lng,
            // Nullable on purpose and therefore not REQUIRED: plenty of places
            // have no rating and no website, and claiming otherwise would make
            // the generated TypeScript lie.
            Double rating,
            String websiteUri) {
    }

    // --- Google's wire format, Places API (New) v1 -------------------------
    //
    // @JsonIgnoreProperties(ignoreUnknown) on every one: the field mask asks
    // for a subset, but Google adds fields, and a strict binder would turn a
    // harmless addition on their side into a 500 on ours.

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GoogleSearchResponse(List<GooglePlace> places) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GooglePlace(
            String id,
            GoogleText displayName,
            String formattedAddress,
            GoogleLatLng location,
            Double rating,
            String websiteUri) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GoogleText(String text) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GoogleLatLng(Double latitude, Double longitude) {
    }
}
